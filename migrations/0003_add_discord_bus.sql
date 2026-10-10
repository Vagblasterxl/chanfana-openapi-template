-- Migration number: 0003 	 2026-10-10T00:00:00.000Z

-- Inter-agent message bus. The column list mirrors the live `polar-mcp` Worker
-- byte for byte (including its nullable columns and `DEFAULT 0` flags) so this
-- implementation can be pointed at the same D1 database without a schema
-- divergence. Do not tighten the constraints here without migrating that
-- Worker first.
CREATE TABLE IF NOT EXISTS comms_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender TEXT,
    recipient TEXT,
    message_type TEXT,
    payload TEXT,
    processed INTEGER DEFAULT 0,
    ack_sent INTEGER DEFAULT 0,
    created_at TEXT,
    classification TEXT
);

CREATE INDEX IF NOT EXISTS idx_comms_messages_recipient_open
    ON comms_messages (recipient, processed);

-- Which Discord account speaks for which agent, and which Polar customer that
-- agent bills as. The Polar customer is the load-bearing field: a Discord user
-- id proves only who is typing, while the capability flags that authorize the
-- command come from `polar_entitlements` via this mapping. An unbound Discord
-- user therefore has no capabilities at all, which is the intended default.
CREATE TABLE IF NOT EXISTS discord_identities (
    discord_user_id TEXT PRIMARY KEY NOT NULL,
    agent_id TEXT NOT NULL,
    polar_customer_id TEXT,
    discord_username TEXT,
    guild_id TEXT,
    bound_by TEXT NOT NULL,
    bound_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_discord_identities_agent
    ON discord_identities (agent_id);

-- Interaction log, keyed by Discord's interaction id. Discord retries an
-- interaction whose response it did not receive within three seconds, so the
-- same command can arrive twice; a replay is answered without running the
-- command again. Without this a dropped response turns one `/omega send` into
-- two bus rows.
CREATE TABLE IF NOT EXISTS discord_interactions (
    interaction_id TEXT PRIMARY KEY NOT NULL,
    command TEXT NOT NULL,
    discord_user_id TEXT,
    received_at DATETIME NOT NULL
);
