import { getCustomerEntitlements } from "../polar/store";
import {
  type InteractionReply,
  type Invoker,
  type ParsedCommand,
  optionInteger,
  optionString,
  reply,
} from "./interactions";
import {
  ackBusMessage,
  bindIdentity,
  busHealth,
  type DiscordIdentity,
  lookupIdentity,
  readInbox,
  sendBusMessage,
} from "./store";

/**
 * Slash-command dispatch for the mesh.
 *
 * Authorization chain, deliberately in this order:
 *
 *   Discord user id  ->  discord_identities  ->  Polar customer
 *                                            ->  polar_entitlements.capabilities
 *
 * A Discord user id proves only who is typing. What they may *do* comes from
 * the Polar subscription their binding points at, which is the same source the
 * rest of the mesh authorizes against — so revoking a subscription in Polar
 * revokes their Discord commands too, with nothing to remember to also turn
 * off. An unbound user therefore holds no capabilities, which is the intended
 * default for everyone who simply happens to be in the guild.
 *
 * `DISCORD_OPERATOR_IDS` exists only to break the bootstrap cycle: before any
 * binding exists nobody can hold `registry.admin`, so nobody could create the
 * first one. It is a Worker secret, so the allowlist is not forgeable from
 * Discord, and it grants exactly one command — `bind`.
 */

const CAP_COMMS_SEND = "comms.send";
const CAP_REGISTRY_ADMIN = "registry.admin";

/** Discord rejects a message body over 2000 characters outright. */
const DISCORD_CONTENT_LIMIT = 1900;
const DEFAULT_INBOX_LIMIT = 5;
const MAX_INBOX_LIMIT = 25;
const AGENT_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,63}$/i;

export interface CommandContext {
  db: D1Database;
  invoker: Invoker;
  guildId: string | null;
  channelId: string | null;
  interactionId: string;
  operatorIds: Set<string>;
  now: string;
}

interface Caller {
  identity: DiscordIdentity | null;
  capabilities: string[];
  isOperator: boolean;
}

export function parseOperatorIds(value: string | undefined): Set<string> {
  if (!value) {
    return new Set();
  }
  return new Set(
    value
      .split(/[,;\s]+/)
      .map((id) => id.trim())
      .filter((id) => id !== ""),
  );
}

export async function dispatchCommand(
  command: ParsedCommand,
  ctx: CommandContext,
): Promise<InteractionReply> {
  const caller = await resolveCaller(ctx);

  switch (command.name) {
    case "omega.status":
      return await handleStatus(ctx, caller);
    case "omega.whoami":
      return handleWhoami(caller);
    case "omega.bind":
      return await handleBind(command, ctx, caller);
    case "omega.send":
      return await handleSend(command, ctx, caller);
    case "omega.inbox":
      return await handleInbox(command, ctx, caller);
    case "omega.ack":
      return await handleAck(command, ctx, caller);
    default:
      return reply(
        `Unknown command \`/${command.name.replace(/\./g, " ")}\`. ` +
          "Available: `status`, `whoami`, `bind`, `send`, `inbox`, `ack`.",
      );
  }
}

async function resolveCaller(ctx: CommandContext): Promise<Caller> {
  const identity = await lookupIdentity(ctx.db, ctx.invoker.id);
  const isOperator = ctx.operatorIds.has(ctx.invoker.id);

  if (!identity?.polar_customer_id) {
    return { identity, capabilities: [], isOperator };
  }

  const { capabilities } = await getCustomerEntitlements(
    ctx.db,
    identity.polar_customer_id,
  );
  return { identity, capabilities, isOperator };
}

function denied(capability: string, caller: Caller): InteractionReply {
  if (!caller.identity) {
    return reply(
      "Not bound. This Discord account is not mapped to an agent, so it holds " +
        "no capabilities. An operator binds it with `/omega bind`.",
    );
  }
  if (!caller.identity.polar_customer_id) {
    return reply(
      `Bound to \`${caller.identity.agent_id}\` but with no Polar customer, so ` +
        "no capabilities resolve. Re-bind with the `customer` option set.",
    );
  }
  return reply(
    `\`${capability}\` required. \`${caller.identity.agent_id}\` currently holds ` +
      `${caller.capabilities.length > 0 ? caller.capabilities.map((c) => `\`${c}\``).join(", ") : "nothing"}. ` +
      "Capabilities come from the Polar subscription — attach the benefit there.",
  );
}

function holds(caller: Caller, capability: string): boolean {
  return caller.capabilities.includes(capability);
}

async function handleStatus(
  ctx: CommandContext,
  caller: Caller,
): Promise<InteractionReply> {
  const { total, processed } = await busHealth(ctx.db);
  const open = total - processed;
  return reply(
    `**Bus** ${total} message${total === 1 ? "" : "s"}, ${open} open, ${processed} acknowledged.\n` +
      `**You** ${caller.identity ? `\`${caller.identity.agent_id}\`` : "unbound"}` +
      `${caller.isOperator ? " · operator" : ""}.`,
  );
}

function handleWhoami(caller: Caller): InteractionReply {
  if (!caller.identity) {
    return reply("Unbound — no agent, no Polar customer, no capabilities.");
  }
  const lines = [
    `**Agent** \`${caller.identity.agent_id}\``,
    `**Polar customer** ${caller.identity.polar_customer_id ? `\`${caller.identity.polar_customer_id}\`` : "_none — capabilities cannot resolve_"}`,
    `**Capabilities** ${caller.capabilities.length > 0 ? caller.capabilities.map((c) => `\`${c}\``).join(", ") : "_none_"}`,
    `**Bound** ${caller.identity.bound_at} by \`${caller.identity.bound_by}\``,
  ];
  if (caller.isOperator) {
    lines.push("**Operator** yes — may run `bind`");
  }
  return reply(lines.join("\n"));
}

async function handleBind(
  command: ParsedCommand,
  ctx: CommandContext,
  caller: Caller,
): Promise<InteractionReply> {
  if (!caller.isOperator && !holds(caller, CAP_REGISTRY_ADMIN)) {
    return denied(CAP_REGISTRY_ADMIN, caller);
  }

  const agentId = optionString(command, "agent");
  if (!agentId || !AGENT_ID_PATTERN.test(agentId)) {
    return reply(
      "`agent` is required and must look like an agent id " +
        "(letters, digits, `.`, `_`, `:`, `-`).",
    );
  }

  // Binding someone else is the normal case: an operator fills in the fleet.
  const targetId = optionString(command, "user") ?? ctx.invoker.id;
  if (!/^\d{5,32}$/.test(targetId)) {
    return reply(
      "`user` must be a Discord user id (the numeric id, not a @mention).",
    );
  }
  const customerId = optionString(command, "customer");
  const username =
    targetId === ctx.invoker.id ? ctx.invoker.username : optionString(command, "username");

  await bindIdentity(
    ctx.db,
    {
      discord_user_id: targetId,
      agent_id: agentId,
      polar_customer_id: customerId,
      discord_username: username,
      guild_id: ctx.guildId,
      bound_by: ctx.invoker.id,
    },
    ctx.now,
  );

  const caveat = customerId
    ? ""
    : "\n⚠ No `customer` given, so this binding resolves to **no capabilities**. " +
      "`send`, `inbox` and `ack` will all refuse until it is re-bound with one.";

  return reply(
    `Bound \`${targetId}\` → \`${agentId}\`` +
      `${customerId ? ` (Polar customer \`${customerId}\`)` : ""}.${caveat}`,
  );
}

async function handleSend(
  command: ParsedCommand,
  ctx: CommandContext,
  caller: Caller,
): Promise<InteractionReply> {
  if (!holds(caller, CAP_COMMS_SEND)) {
    return denied(CAP_COMMS_SEND, caller);
  }

  const recipient = optionString(command, "recipient");
  const text = optionString(command, "message");
  if (!recipient || !AGENT_ID_PATTERN.test(recipient)) {
    return reply("`recipient` is required and must be an agent id.");
  }
  if (!text) {
    return reply("`message` is required.");
  }

  const sender = caller.identity?.agent_id ?? `discord:${ctx.invoker.id}`;
  const messageType = optionString(command, "type") ?? "discord.relay";

  // Keeps the payload shape the existing discord-relay consumers already read
  // (`text`, `from`, `channel_id`, `via`) and adds the provenance the original
  // hand-rolled probe had no way to carry.
  const id = await sendBusMessage(
    ctx.db,
    {
      sender,
      recipient,
      message_type: messageType,
      payload: {
        text,
        from: sender,
        channel_id: ctx.channelId,
        via: "discord-relay",
        discord_user_id: ctx.invoker.id,
        discord_username: ctx.invoker.username,
        guild_id: ctx.guildId,
        interaction_id: ctx.interactionId,
      },
    },
    ctx.now,
  );

  return reply(
    `Queued **#${id}** for \`${recipient}\` as \`${messageType}\`, from \`${sender}\`.`,
  );
}

async function handleInbox(
  command: ParsedCommand,
  ctx: CommandContext,
  caller: Caller,
): Promise<InteractionReply> {
  if (!holds(caller, CAP_COMMS_SEND)) {
    return denied(CAP_COMMS_SEND, caller);
  }

  const recipient = optionString(command, "recipient") ?? caller.identity?.agent_id;
  if (!recipient || !AGENT_ID_PATTERN.test(recipient)) {
    return reply("`recipient` is required and must be an agent id.");
  }

  const requested = optionInteger(command, "limit") ?? DEFAULT_INBOX_LIMIT;
  const limit = Math.min(Math.max(requested, 1), MAX_INBOX_LIMIT);
  const messages = await readInbox(ctx.db, recipient, limit);

  if (messages.length === 0) {
    return reply(`\`${recipient}\` has no open messages.`);
  }

  const lines = messages.map((message) => {
    const body = summarizePayload(message.payload);
    return `**#${message.id}** \`${message.message_type ?? "?"}\` from \`${message.sender ?? "?"}\`${message.classification ? ` · ${message.classification}` : ""} — ${body}`;
  });

  return reply(
    truncate(
      `\`${recipient}\` — ${messages.length} open (newest ${limit} shown)\n${lines.join("\n")}`,
    ),
  );
}

async function handleAck(
  command: ParsedCommand,
  ctx: CommandContext,
  caller: Caller,
): Promise<InteractionReply> {
  if (!holds(caller, CAP_COMMS_SEND)) {
    return denied(CAP_COMMS_SEND, caller);
  }

  const id = optionInteger(command, "id");
  if (id === null || id < 1) {
    return reply("`id` is required and must be a bus message id.");
  }
  const recipient = caller.identity?.agent_id;
  if (!recipient) {
    return reply("Not bound to an agent, so there is no inbox to acknowledge.");
  }

  const acked = await ackBusMessage(ctx.db, id, recipient);
  if (!acked) {
    // Deliberately does not distinguish "no such message" from "addressed to
    // someone else": the id is a guessable integer and the difference would
    // leak another agent's traffic.
    return reply(
      `No open message **#${id}** addressed to \`${recipient}\`.`,
    );
  }
  return reply(`Acknowledged **#${id}** for \`${recipient}\`.`);
}

function summarizePayload(payload: string | null): string {
  if (!payload) {
    return "_empty_";
  }
  try {
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed === "object" && typeof parsed.text === "string") {
      return truncate(parsed.text, 160);
    }
  } catch {
    // Not JSON; the bus column is free-form text, so show it as-is.
  }
  return truncate(payload, 160);
}

function truncate(value: string, limit: number = DISCORD_CONTENT_LIMIT): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}
