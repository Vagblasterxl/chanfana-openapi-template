/**
 * D1 access for the Discord ingress: the shared message bus, the Discord ->
 * agent identity map, and the interaction replay log.
 */

export interface BusMessage {
  id: number;
  sender: string | null;
  recipient: string | null;
  message_type: string | null;
  payload: string | null;
  created_at: string | null;
  classification: string | null;
}

export interface DiscordIdentity {
  discord_user_id: string;
  agent_id: string;
  polar_customer_id: string | null;
  discord_username: string | null;
  guild_id: string | null;
  bound_by: string;
  bound_at: string;
}

/**
 * Claim this interaction id. Returns `false` when Discord has already delivered
 * it, which means the command ran and only the reply was lost — re-running it
 * would double-post to the bus.
 */
export async function claimInteraction(
  db: D1Database,
  interactionId: string,
  command: string,
  discordUserId: string | null,
  receivedAt: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "INSERT OR IGNORE INTO discord_interactions (interaction_id, command, discord_user_id, received_at) VALUES (?, ?, ?, ?)",
    )
    .bind(interactionId, command, discordUserId, receivedAt)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function lookupIdentity(
  db: D1Database,
  discordUserId: string,
): Promise<DiscordIdentity | null> {
  return await db
    .prepare("SELECT * FROM discord_identities WHERE discord_user_id = ?")
    .bind(discordUserId)
    .first<DiscordIdentity>();
}

export async function bindIdentity(
  db: D1Database,
  identity: Omit<DiscordIdentity, "bound_at">,
  boundAt: string,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO discord_identities (
         discord_user_id, agent_id, polar_customer_id, discord_username,
         guild_id, bound_by, bound_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(discord_user_id) DO UPDATE SET
         agent_id = excluded.agent_id,
         polar_customer_id = excluded.polar_customer_id,
         discord_username = excluded.discord_username,
         guild_id = excluded.guild_id,
         bound_by = excluded.bound_by,
         bound_at = excluded.bound_at`,
    )
    .bind(
      identity.discord_user_id,
      identity.agent_id,
      identity.polar_customer_id,
      identity.discord_username,
      identity.guild_id,
      identity.bound_by,
      boundAt,
    )
    .run();
}

export async function sendBusMessage(
  db: D1Database,
  message: {
    sender: string;
    recipient: string;
    message_type: string;
    payload: unknown;
  },
  createdAt: string,
): Promise<number> {
  const result = await db
    .prepare(
      "INSERT INTO comms_messages (sender, recipient, message_type, payload, processed, ack_sent, created_at, classification) VALUES (?, ?, ?, ?, 0, 0, ?, NULL)",
    )
    .bind(
      message.sender,
      message.recipient,
      message.message_type,
      // D1 `.bind()` throws on non-primitives, and agents send objects.
      typeof message.payload === "string"
        ? message.payload
        : JSON.stringify(message.payload ?? ""),
      createdAt,
    )
    .run();

  return Number(result.meta?.last_row_id ?? 0);
}

export async function readInbox(
  db: D1Database,
  recipient: string,
  limit: number,
): Promise<BusMessage[]> {
  const { results } = await db
    .prepare(
      "SELECT id, sender, recipient, message_type, payload, created_at, classification FROM comms_messages WHERE recipient = ? AND processed = 0 ORDER BY id ASC LIMIT ?",
    )
    .bind(recipient, limit)
    .all<BusMessage>();
  return results;
}

/**
 * Acknowledge a message. Scoped to the recipient so a bound agent can only
 * clear its own queue — the bus id is a guessable integer, and a caller holding
 * `comms.send` must not be able to silence another agent's inbox with it.
 * Returns `false` when no open message with that id is addressed to them.
 */
export async function ackBusMessage(
  db: D1Database,
  id: number,
  recipient: string,
): Promise<boolean> {
  const result = await db
    .prepare(
      "UPDATE comms_messages SET processed = 1, ack_sent = 1 WHERE id = ? AND recipient = ? AND processed = 0",
    )
    .bind(id, recipient)
    .run();
  return (result.meta?.changes ?? 0) > 0;
}

export async function busHealth(
  db: D1Database,
): Promise<{ total: number; processed: number }> {
  const row = await db
    .prepare(
      "SELECT COUNT(*) AS total, COALESCE(SUM(processed), 0) AS processed FROM comms_messages",
    )
    .first<{ total: number; processed: number }>();
  return { total: row?.total ?? 0, processed: row?.processed ?? 0 };
}
