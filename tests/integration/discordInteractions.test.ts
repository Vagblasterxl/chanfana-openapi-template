import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { beforeAll, describe, expect, it } from "vitest";
import worker from "../../src/index";
import { commandManifest } from "../../src/discord/registration";

const OPERATOR_ID = "100000000000000001";
const OUTSIDER_ID = "100000000000000002";
const RECEIVER_ID = "100000000000000003";

// Seeded by migration 0002: Receiver holds comms.send, Warden does not.
const RECEIVER_PRODUCT = "cb2d4696-adbc-4f92-a214-1f67c19e3b8f";
const WARDEN_PRODUCT = "2c1fb64e-717f-47f6-943f-86e8ccfe5e41";

let keyPair: CryptoKeyPair;
let publicKeyHex: string;
let otherKeyPair: CryptoKeyPair;

beforeAll(async () => {
  keyPair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  otherKeyPair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  publicKeyHex = hex(
    new Uint8Array(await crypto.subtle.exportKey("raw", keyPair.publicKey)),
  );
});

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signature(
  privateKey: CryptoKey,
  timestamp: string,
  body: string,
): Promise<string> {
  const mac = await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    new TextEncoder().encode(`${timestamp}${body}`),
  );
  return hex(new Uint8Array(mac));
}

interface PostOptions {
  timestamp?: number;
  signWith?: CryptoKey;
  signatureOverride?: string;
  publicKey?: string | undefined;
  operatorIds?: string;
  omitHeaders?: boolean;
  rawBody?: string;
}

async function post(payload: unknown, options: PostOptions = {}) {
  const body = options.rawBody ?? JSON.stringify(payload);
  const timestamp = String(options.timestamp ?? Math.floor(Date.now() / 1000));

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (!options.omitHeaders) {
    headers["x-signature-timestamp"] = timestamp;
    headers["x-signature-ed25519"] =
      options.signatureOverride ??
      (await signature(
        options.signWith ?? keyPair.privateKey,
        timestamp,
        body,
      ));
  }

  const overrides: Record<string, unknown> = {
    DISCORD_PUBLIC_KEY:
      "publicKey" in options ? options.publicKey : publicKeyHex,
    DISCORD_OPERATOR_IDS: options.operatorIds ?? OPERATOR_ID,
  };

  const ctx = createExecutionContext();
  const response = await worker.fetch(
    new Request("http://local.test/discord/interactions", {
      method: "POST",
      headers,
      body,
    }),
    { ...env, ...overrides } as typeof env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return response;
}

interface SlashOptions {
  userId?: string;
  username?: string;
  guildId?: string;
  channelId?: string;
  interactionId?: string;
  group?: string;
}

/** Builds the nesting Discord actually sends for `/omega <sub> k:v ...`. */
function slash(
  subcommand: string,
  args: Record<string, string | number> = {},
  options: SlashOptions = {},
) {
  const argOptions = Object.entries(args).map(([name, value]) => ({
    name,
    type: typeof value === "number" ? 4 : 3,
    value,
  }));

  let tree: unknown[] = [
    { name: subcommand, type: 1, options: argOptions },
  ];
  if (options.group) {
    tree = [{ name: options.group, type: 2, options: tree }];
  }

  return {
    id: options.interactionId ?? `int_${crypto.randomUUID()}`,
    application_id: "app_1",
    type: 2,
    guild_id: options.guildId ?? "guild_1",
    channel_id: options.channelId ?? "111",
    token: "tok",
    version: 1,
    data: { id: "cmd_1", name: "omega", type: 1, options: tree },
    member: {
      user: {
        id: options.userId ?? OPERATOR_ID,
        username: options.username ?? "operator",
      },
    },
  };
}

async function content(response: Response): Promise<string> {
  const parsed = await response.json<{ data?: { content?: string } }>();
  return parsed.data?.content ?? "";
}

async function grantCustomer(
  customerId: string,
  productId: string,
  capabilities: string[],
  active = true,
) {
  await env.DB.prepare(
    `INSERT INTO polar_entitlements (
       subscription_id, customer_id, external_customer_id, product_id,
       product_name, status, active, capabilities, source, event_type,
       event_id, occurred_at, updated_at
     ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'product_benefits', 'subscription.updated', ?, ?, ?)`,
  )
    .bind(
      `sub_${customerId}`,
      customerId,
      productId,
      "test product",
      active ? "active" : "canceled",
      active ? 1 : 0,
      JSON.stringify(capabilities),
      `evt_${customerId}`,
      "2026-10-01T00:00:00.000Z",
      "2026-10-01T00:00:00.000Z",
    )
    .run();
}

async function bind(
  discordUserId: string,
  agentId: string,
  customerId: string | null,
) {
  await env.DB.prepare(
    `INSERT INTO discord_identities (
       discord_user_id, agent_id, polar_customer_id, discord_username,
       guild_id, bound_by, bound_at
     ) VALUES (?, ?, ?, 'test', 'guild_1', 'test', '2026-10-01T00:00:00.000Z')`,
  )
    .bind(discordUserId, agentId, customerId)
    .run();
}

async function busRows(recipient?: string) {
  const statement = recipient
    ? env.DB.prepare(
        "SELECT * FROM comms_messages WHERE recipient = ? ORDER BY id ASC",
      ).bind(recipient)
    : env.DB.prepare("SELECT * FROM comms_messages ORDER BY id ASC");
  const { results } = await statement.all<Record<string, unknown>>();
  return results;
}

describe("Discord interaction verification", () => {
  it("answers Discord's PING with a PONG", async () => {
    const response = await post({ id: "int_ping", type: 1 });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ type: 1 });
  });

  it("rejects an interaction with no signature headers", async () => {
    const response = await post({ id: "int_x", type: 1 }, { omitHeaders: true });
    expect(response.status).toBe(401);
  });

  it("rejects a signature from a different key", async () => {
    const response = await post(
      { id: "int_x", type: 1 },
      { signWith: otherKeyPair.privateKey },
    );
    expect(response.status).toBe(401);
    const parsed = await response.json<{ errors: { message: string }[] }>();
    expect(parsed.errors[0].message).toContain("signature_mismatch");
  });

  it("rejects a correctly signed body that was altered in transit", async () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const original = JSON.stringify({ id: "int_x", type: 1 });
    const tampered = JSON.stringify({ id: "int_x", type: 2 });

    const response = await post(null, {
      rawBody: tampered,
      timestamp: Number(timestamp),
      signatureOverride: await signature(
        keyPair.privateKey,
        timestamp,
        original,
      ),
    });

    expect(response.status).toBe(401);
  });

  it("rejects a stale timestamp", async () => {
    const response = await post(
      { id: "int_x", type: 1 },
      { timestamp: Math.floor(Date.now() / 1000) - 600 },
    );
    expect(response.status).toBe(401);
    const parsed = await response.json<{ errors: { message: string }[] }>();
    expect(parsed.errors[0].message).toContain("timestamp_out_of_tolerance");
  });

  it("rejects a non-numeric timestamp", async () => {
    const body = JSON.stringify({ id: "int_x", type: 1 });
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new Request("http://local.test/discord/interactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-signature-timestamp": "not-a-number",
          "x-signature-ed25519": await signature(
            keyPair.privateKey,
            "not-a-number",
            body,
          ),
        },
        body,
      }),
      { ...env, DISCORD_PUBLIC_KEY: publicKeyHex } as typeof env,
      ctx,
    );
    await waitOnExecutionContext(ctx);
    expect(response.status).toBe(401);
  });

  it("fails closed when DISCORD_PUBLIC_KEY is not configured", async () => {
    const response = await post(
      slash("send", { recipient: "agent-2", message: "unverified" }),
      { publicKey: undefined },
    );

    // Refused, not accepted unverified — even though this signature is the one
    // a correctly configured Worker would have accepted.
    expect(response.status).toBe(503);
    const parsed = await response.json<{ errors: { message: string }[] }>();
    expect(parsed.errors[0].message).toContain("not configured");
    expect(await busRows()).toHaveLength(0);
  });

  it("treats a malformed public key as an outage, not as a bad signature", async () => {
    const response = await post(
      { id: "int_x", type: 1 },
      { publicKey: "not-32-bytes-of-hex" },
    );
    expect(response.status).toBe(503);
  });

  it("rejects a verified body that is not JSON", async () => {
    const response = await post(null, { rawBody: "{not json" });
    expect(response.status).toBe(400);
  });

  it("answers a non-command interaction without touching the bus", async () => {
    const response = await post({ id: "int_component", type: 3 });
    expect(response.status).toBe(200);
    expect(await content(response)).toContain("slash commands only");
    expect(await busRows()).toHaveLength(0);
  });
});

describe("Discord command authorization", () => {
  it("refuses an unbound Discord account and writes nothing", async () => {
    const response = await post(
      slash("send", { recipient: "agent-2", message: "hello" }, {
        userId: OUTSIDER_ID,
      }),
    );

    expect(response.status).toBe(200);
    expect(await content(response)).toContain("Not bound");
    expect(await busRows()).toHaveLength(0);
  });

  it("refuses bind from a non-operator with no registry.admin", async () => {
    const response = await post(
      slash("bind", { agent: "agent-9" }, { userId: OUTSIDER_ID }),
    );
    expect(await content(response)).toContain("Not bound");

    const row = await env.DB.prepare(
      "SELECT COUNT(*) AS n FROM discord_identities",
    ).first<{ n: number }>();
    expect(row?.n).toBe(0);
  });

  it("lets an operator bind another account to an agent and customer", async () => {
    const response = await post(
      slash("bind", {
        agent: "agent-3",
        customer: "cus_receiver",
        user: RECEIVER_ID,
      }),
    );

    expect(await content(response)).toContain("agent-3");

    const stored = await env.DB.prepare(
      "SELECT * FROM discord_identities WHERE discord_user_id = ?",
    )
      .bind(RECEIVER_ID)
      .first<Record<string, unknown>>();
    expect(stored?.agent_id).toBe("agent-3");
    expect(stored?.polar_customer_id).toBe("cus_receiver");
    expect(stored?.bound_by).toBe(OPERATOR_ID);
  });

  it("warns when a binding is created with no Polar customer", async () => {
    const response = await post(slash("bind", { agent: "agent-4" }));
    expect(await content(response)).toContain("no capabilities");
  });

  it("refuses a bound account whose binding carries no customer", async () => {
    await bind(RECEIVER_ID, "agent-3", null);
    const response = await post(
      slash("send", { recipient: "agent-2", message: "hi" }, {
        userId: RECEIVER_ID,
      }),
    );
    expect(await content(response)).toContain("no Polar customer");
    expect(await busRows()).toHaveLength(0);
  });

  it("refuses a capability the subscription does not grant", async () => {
    // Warden holds mesh.dispatch / registry.admin / vault.read — not comms.send.
    await grantCustomer("cus_warden", WARDEN_PRODUCT, [
      "mesh.dispatch",
      "registry.admin",
      "vault.read",
    ]);
    await bind(RECEIVER_ID, "agent-1", "cus_warden");

    const response = await post(
      slash("send", { recipient: "agent-2", message: "hi" }, {
        userId: RECEIVER_ID,
      }),
    );

    const text = await content(response);
    expect(text).toContain("comms.send` required");
    expect(text).toContain("mesh.dispatch");
    expect(await busRows()).toHaveLength(0);
  });

  it("refuses once the Polar subscription is no longer active", async () => {
    // Revoking in Polar has to revoke the Discord command, with nothing else
    // to remember to turn off.
    await grantCustomer(
      "cus_lapsed",
      RECEIVER_PRODUCT,
      ["comms.send"],
      false,
    );
    await bind(RECEIVER_ID, "agent-3", "cus_lapsed");

    const response = await post(
      slash("send", { recipient: "agent-2", message: "hi" }, {
        userId: RECEIVER_ID,
      }),
    );

    expect(await content(response)).toContain("comms.send` required");
    expect(await busRows()).toHaveLength(0);
  });

  it("allows bind for a holder of registry.admin who is not an operator", async () => {
    await grantCustomer("cus_warden", WARDEN_PRODUCT, ["registry.admin"]);
    await bind(OUTSIDER_ID, "agent-1", "cus_warden");

    const response = await post(
      slash("bind", { agent: "agent-7", user: RECEIVER_ID }, {
        userId: OUTSIDER_ID,
      }),
      { operatorIds: "" },
    );

    expect(await content(response)).toContain("agent-7");
  });

  it("rejects an agent id that is not shaped like one", async () => {
    const response = await post(
      slash("bind", { agent: "../../etc/passwd", user: RECEIVER_ID }),
    );
    expect(await content(response)).toContain("must look like an agent id");
  });
});

describe("Discord bus relay", () => {
  beforeAll(() => {});

  async function asReceiver(
    subcommand: string,
    args: Record<string, string | number> = {},
    options: SlashOptions = {},
  ) {
    return await post(
      slash(subcommand, args, { ...options, userId: RECEIVER_ID }),
    );
  }

  it("relays a command onto the bus in the discord-relay payload shape", async () => {
    await grantCustomer("cus_receiver", RECEIVER_PRODUCT, [
      "comms.send",
      "memory.write",
    ]);
    await bind(RECEIVER_ID, "agent-3", "cus_receiver");

    const response = await asReceiver("send", {
      recipient: "agent-2",
      message: "spin up the ingress",
    });

    expect(await content(response)).toContain("agent-2");

    const rows = await busRows("agent-2");
    expect(rows).toHaveLength(1);
    expect(rows[0].sender).toBe("agent-3");
    expect(rows[0].message_type).toBe("discord.relay");
    expect(rows[0].processed).toBe(0);

    const payload = JSON.parse(String(rows[0].payload));
    // The four fields the existing discord-relay consumers already read.
    expect(payload.text).toBe("spin up the ingress");
    expect(payload.from).toBe("agent-3");
    expect(payload.channel_id).toBe("111");
    expect(payload.via).toBe("discord-relay");
    // Provenance the hand-rolled probe had no way to carry.
    expect(payload.discord_user_id).toBe(RECEIVER_ID);
    expect(payload.guild_id).toBe("guild_1");
  });

  it("honours an explicit message_type", async () => {
    await grantCustomer("cus_receiver", RECEIVER_PRODUCT, ["comms.send"]);
    await bind(RECEIVER_ID, "agent-3", "cus_receiver");

    await asReceiver("send", {
      recipient: "agent-2",
      message: "status?",
      type: "mesh.query",
    });

    const rows = await busRows("agent-2");
    expect(rows[0].message_type).toBe("mesh.query");
  });

  it("does not apply a retried interaction twice", async () => {
    await grantCustomer("cus_receiver", RECEIVER_PRODUCT, ["comms.send"]);
    await bind(RECEIVER_ID, "agent-3", "cus_receiver");

    const payload = slash(
      "send",
      { recipient: "agent-2", message: "only once" },
      { userId: RECEIVER_ID, interactionId: "int_retry" },
    );

    const first = await post(payload);
    const second = await post(payload);

    expect(await content(first)).toContain("Queued");
    expect(await content(second)).toContain("already ran");
    expect(await busRows("agent-2")).toHaveLength(1);
  });

  it("lists the caller's own open messages by default", async () => {
    await grantCustomer("cus_receiver", RECEIVER_PRODUCT, ["comms.send"]);
    await bind(RECEIVER_ID, "agent-3", "cus_receiver");
    await env.DB.prepare(
      "INSERT INTO comms_messages (sender, recipient, message_type, payload, processed, ack_sent, created_at, classification) VALUES ('agent-1', 'agent-3', 'mesh.task', ?, 0, 0, '2026-10-01T00:00:00Z', 'TASK')",
    )
      .bind(JSON.stringify({ text: "verify the ingress", via: "discord-relay" }))
      .run();

    const response = await asReceiver("inbox");
    const text = await content(response);
    expect(text).toContain("agent-3");
    expect(text).toContain("verify the ingress");
    expect(text).toContain("TASK");
  });

  it("reports an empty inbox plainly", async () => {
    await grantCustomer("cus_receiver", RECEIVER_PRODUCT, ["comms.send"]);
    await bind(RECEIVER_ID, "agent-3", "cus_receiver");
    expect(await content(await asReceiver("inbox"))).toContain(
      "no open messages",
    );
  });

  it("acknowledges a message addressed to the caller", async () => {
    await grantCustomer("cus_receiver", RECEIVER_PRODUCT, ["comms.send"]);
    await bind(RECEIVER_ID, "agent-3", "cus_receiver");
    const inserted = await env.DB.prepare(
      "INSERT INTO comms_messages (sender, recipient, message_type, payload, processed, ack_sent, created_at) VALUES ('agent-1', 'agent-3', 'mesh.task', 'x', 0, 0, '2026-10-01T00:00:00Z')",
    ).run();
    const id = Number(inserted.meta.last_row_id);

    expect(await content(await asReceiver("ack", { id }))).toContain(
      `#${id}`,
    );

    const row = await env.DB.prepare(
      "SELECT processed, ack_sent FROM comms_messages WHERE id = ?",
    )
      .bind(id)
      .first<{ processed: number; ack_sent: number }>();
    expect(row?.processed).toBe(1);
    expect(row?.ack_sent).toBe(1);
  });

  it("cannot acknowledge another agent's message", async () => {
    await grantCustomer("cus_receiver", RECEIVER_PRODUCT, ["comms.send"]);
    await bind(RECEIVER_ID, "agent-3", "cus_receiver");
    const inserted = await env.DB.prepare(
      "INSERT INTO comms_messages (sender, recipient, message_type, payload, processed, ack_sent, created_at) VALUES ('agent-1', 'agent-8', 'mesh.task', 'x', 0, 0, '2026-10-01T00:00:00Z')",
    ).run();
    const id = Number(inserted.meta.last_row_id);

    expect(await content(await asReceiver("ack", { id }))).toContain(
      "No open message",
    );

    const row = await env.DB.prepare(
      "SELECT processed FROM comms_messages WHERE id = ?",
    )
      .bind(id)
      .first<{ processed: number }>();
    expect(row?.processed).toBe(0);
  });

  it("reads a subcommand nested under a group", async () => {
    await grantCustomer("cus_receiver", RECEIVER_PRODUCT, ["comms.send"]);
    await bind(RECEIVER_ID, "agent-3", "cus_receiver");

    const response = await post(
      slash(
        "send",
        { recipient: "agent-2", message: "nested" },
        { userId: RECEIVER_ID, group: "bus" },
      ),
    );

    // `/omega bus send` is a different command path, so it falls through to the
    // help text rather than being silently treated as `/omega send`.
    expect(await content(response)).toContain("Unknown command");
  });
});

describe("Discord introspection", () => {
  it("reports the caller's agent, customer, and capabilities", async () => {
    await grantCustomer("cus_receiver", RECEIVER_PRODUCT, [
      "comms.send",
      "memory.write",
    ]);
    await bind(RECEIVER_ID, "agent-3", "cus_receiver");

    const text = await content(
      await post(slash("whoami", {}, { userId: RECEIVER_ID })),
    );
    expect(text).toContain("agent-3");
    expect(text).toContain("cus_receiver");
    expect(text).toContain("comms.send");
    expect(text).toContain("memory.write");
  });

  it("tells an unbound caller they are unbound", async () => {
    const text = await content(
      await post(slash("whoami", {}, { userId: OUTSIDER_ID })),
    );
    expect(text).toContain("Unbound");
  });

  it("reports bus counts and operator status", async () => {
    await env.DB.prepare(
      "INSERT INTO comms_messages (sender, recipient, message_type, payload, processed, ack_sent, created_at) VALUES ('a', 'b', 't', 'x', 1, 1, '2026-10-01T00:00:00Z')",
    ).run();

    const text = await content(await post(slash("status")));
    expect(text).toContain("1 message");
    expect(text).toContain("operator");
  });

  it("falls through to help on an unknown subcommand", async () => {
    const text = await content(await post(slash("teleport")));
    expect(text).toContain("Unknown command");
  });
});

describe("Discord command manifest", () => {
  it("serves the command tree for registration", async () => {
    const ctx = createExecutionContext();
    const response = await worker.fetch(
      new Request("http://local.test/discord/commands"),
      env,
      ctx,
    );
    await waitOnExecutionContext(ctx);

    expect(response.status).toBe(200);
    const parsed = await response.json<{ name: string }[]>();
    expect(parsed[0].name).toBe("omega");
  });

  it("registers no subcommand the dispatcher does not handle", async () => {
    // The guard against the two halves drifting: a command advertised to
    // Discord but missing from the switch would answer users with help text.
    const subcommands = commandManifest[0].options.map((option) => option.name);
    expect(subcommands.length).toBeGreaterThan(0);

    for (const name of subcommands) {
      const text = await content(await post(slash(name)));
      expect(text, `/omega ${name} is advertised but not handled`).not.toContain(
        "Unknown command",
      );
    }
  });
});
