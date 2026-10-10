import { z } from "zod";

/**
 * The slice of Discord's interaction model this endpoint needs. Schemas are
 * `.passthrough()` so a field Discord adds later travels through untouched
 * instead of failing the parse.
 */

export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
} as const;

export const InteractionResponseType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
} as const;

/** Only the invoking user sees an ephemeral reply. */
export const EPHEMERAL = 64;

const discordUser = z
  .object({
    id: z.string(),
    username: z.string().optional(),
  })
  .passthrough();

const commandOption: z.ZodType<CommandOption> = z.lazy(() =>
  z
    .object({
      name: z.string(),
      type: z.number().int(),
      value: z.union([z.string(), z.number(), z.boolean()]).optional(),
      options: z.array(commandOption).optional(),
    })
    .passthrough(),
);

export interface CommandOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: CommandOption[];
}

export const discordInteraction = z
  .object({
    id: z.string(),
    type: z.number().int(),
    application_id: z.string().optional(),
    guild_id: z.string().optional(),
    channel_id: z.string().optional(),
    token: z.string().optional(),
    data: z
      .object({
        id: z.string().optional(),
        name: z.string(),
        type: z.number().int().optional(),
        options: z.array(commandOption).optional(),
      })
      .passthrough()
      .optional(),
    // `member` in a guild, `user` in a DM. Exactly one is present.
    member: z.object({ user: discordUser }).passthrough().optional(),
    user: discordUser.optional(),
  })
  .passthrough();

export type DiscordInteraction = z.infer<typeof discordInteraction>;

export interface Invoker {
  id: string;
  username: string | null;
}

export function invokerOf(interaction: DiscordInteraction): Invoker | null {
  const user = interaction.member?.user ?? interaction.user;
  if (!user) {
    return null;
  }
  return { id: user.id, username: user.username ?? null };
}

export interface ParsedCommand {
  /** Dotted path, e.g. `omega.send`, so dispatch is a single string compare. */
  name: string;
  options: Map<string, string | number | boolean>;
}

/**
 * Flattens a command invocation to `name` plus a flat option map. Discord nests
 * subcommands as an option of type 1 (and subcommand groups as type 2) that
 * carries the real arguments, so `/omega send recipient:x` arrives as
 * `data.options[0].options`, not as `data.options`.
 */
export function parseCommand(
  interaction: DiscordInteraction,
): ParsedCommand | null {
  if (!interaction.data) {
    return null;
  }

  const path = [interaction.data.name];
  let options = interaction.data.options ?? [];

  // At most one group and one subcommand can nest, but loop rather than
  // unrolling two levels by hand.
  while (options.length === 1 && (options[0].type === 1 || options[0].type === 2)) {
    path.push(options[0].name);
    options = options[0].options ?? [];
  }

  const flat = new Map<string, string | number | boolean>();
  for (const option of options) {
    if (option.value !== undefined) {
      flat.set(option.name, option.value);
    }
  }

  return { name: path.join("."), options: flat };
}

export function optionString(
  command: ParsedCommand,
  name: string,
): string | null {
  const value = command.options.get(name);
  if (value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text === "" ? null : text;
}

export function optionInteger(
  command: ParsedCommand,
  name: string,
): number | null {
  const value = command.options.get(name);
  if (value === undefined) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isInteger(parsed) ? parsed : null;
}

export interface InteractionReply {
  type: number;
  data?: { content: string; flags?: number };
}

/** Replies are ephemeral by default: bus contents are not channel chatter. */
export function reply(content: string, flags: number = EPHEMERAL): InteractionReply {
  return {
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: { content, flags },
  };
}

export const PONG: InteractionReply = { type: InteractionResponseType.PONG };
