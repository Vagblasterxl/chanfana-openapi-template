import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";

// ─── Schema ──────────────────────────────────────────────────────────────────
const MessageSchema = z.object({
  id: z.number(),
  channel: z.string(),
  sender: z.string(),
  body: z.string(),
  metadata: z.string().nullable(),
  created_at: z.string(),
});

// ─── POST /oracle/setup — Create the comms table ────────────────────────────
export class OracleSetup extends OpenAPIRoute {
  public schema = {
    tags: ["Oracle"],
    summary: "Initialize the Oracle comms table in D1",
    operationId: "oracle-setup",
    responses: {
      "200": {
        description: "Setup result",
        ...contentJson(z.object({ success: z.boolean(), message: z.string() })),
      },
    },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    await db.exec(`
      CREATE TABLE IF NOT EXISTS oracle_messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        channel    TEXT    NOT NULL DEFAULT 'general',
        sender     TEXT    NOT NULL,
        body       TEXT    NOT NULL,
        metadata   TEXT,
        created_at TEXT    NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_oracle_channel    ON oracle_messages(channel);
      CREATE INDEX IF NOT EXISTS idx_oracle_created_at ON oracle_messages(created_at);
    `);
    return { success: true, message: "Oracle comms table ready" };
  }
}

// ─── POST /oracle/send — Post a message to a channel ────────────────────────
export class OracleSend extends OpenAPIRoute {
  public schema = {
    tags: ["Oracle"],
    summary: "Send a message to the Oracle",
    operationId: "oracle-send",
    request: {
      body: contentJson(
        z.object({
          channel: z.string().optional().default("general").describe("Channel name (default: general)"),
          sender: z.string().describe("Who's sending — agent name, instance id, whatever"),
          body: z.string().describe("The message content"),
          metadata: z.string().optional().describe("Optional JSON blob for structured data"),
        }),
      ),
    },
    responses: {
      "200": {
        description: "Message sent",
        ...contentJson(z.object({ success: z.boolean(), result: MessageSchema })),
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { channel, sender, body, metadata } = data.body;
    const db = c.env.DB;

    const result = await db
      .prepare(
        `INSERT INTO oracle_messages (channel, sender, body, metadata)
         VALUES (?, ?, ?, ?)
         RETURNING *`,
      )
      .bind(channel || "general", sender, body, metadata || null)
      .first();

    return { success: true, result };
  }
}

// ─── GET /oracle/read/:channel — Read messages from a channel ───────────────
export class OracleRead extends OpenAPIRoute {
  public schema = {
    tags: ["Oracle"],
    summary: "Read messages from an Oracle channel",
    operationId: "oracle-read",
    request: {
      params: z.object({
        channel: z.string().describe("Channel name to read from"),
      }),
      query: z.object({
        limit: z.coerce.number().optional().default(50).describe("Max messages to return (default 50)"),
        since_id: z.coerce.number().optional().describe("Only return messages with id > this value (for polling)"),
        since: z.string().optional().describe("Only messages after this ISO timestamp"),
      }),
    },
    responses: {
      "200": {
        description: "Messages",
        ...contentJson(
          z.object({
            success: z.boolean(),
            result: z.object({
              channel: z.string(),
              messages: z.array(MessageSchema),
              count: z.number(),
            }),
          }),
        ),
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { channel } = data.params;
    const { limit, since_id, since } = data.query;
    const db = c.env.DB;

    let sql = "SELECT * FROM oracle_messages WHERE channel = ?";
    const binds: unknown[] = [channel];

    if (since_id) {
      sql += " AND id > ?";
      binds.push(since_id);
    }
    if (since) {
      sql += " AND created_at > ?";
      binds.push(since);
    }

    sql += " ORDER BY id DESC LIMIT ?";
    binds.push(limit || 50);

    const stmt = db.prepare(sql);
    const { results } = await stmt.bind(...binds).all();

    return {
      success: true,
      result: {
        channel,
        messages: results,
        count: results.length,
      },
    };
  }
}

// ─── GET /oracle/channels — List all active channels ────────────────────────
export class OracleChannels extends OpenAPIRoute {
  public schema = {
    tags: ["Oracle"],
    summary: "List all Oracle channels with message counts",
    operationId: "oracle-channels",
    responses: {
      "200": {
        description: "Channel list",
        ...contentJson(
          z.object({
            success: z.boolean(),
            result: z.array(
              z.object({
                channel: z.string(),
                message_count: z.number(),
                last_message_at: z.string().nullable(),
              }),
            ),
          }),
        ),
      },
    },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const { results } = await db
      .prepare(
        `SELECT channel,
                COUNT(*)       AS message_count,
                MAX(created_at) AS last_message_at
         FROM oracle_messages
         GROUP BY channel
         ORDER BY last_message_at DESC`,
      )
      .all();

    return { success: true, result: results };
  }
}

// ─── GET /oracle/latest — Latest messages across ALL channels ───────────────
export class OracleLatest extends OpenAPIRoute {
  public schema = {
    tags: ["Oracle"],
    summary: "Get the latest messages across all channels",
    operationId: "oracle-latest",
    request: {
      query: z.object({
        limit: z.coerce.number().optional().default(20).describe("Max messages (default 20)"),
      }),
    },
    responses: {
      "200": {
        description: "Latest messages",
        ...contentJson(
          z.object({
            success: z.boolean(),
            result: z.array(MessageSchema),
          }),
        ),
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const db = c.env.DB;
    const { results } = await db
      .prepare("SELECT * FROM oracle_messages ORDER BY id DESC LIMIT ?")
      .bind(data.query.limit || 20)
      .all();

    return { success: true, result: results };
  }
}

// ─── DELETE /oracle/channel/:channel — Wipe a channel ───────────────────────
export class OracleClear extends OpenAPIRoute {
  public schema = {
    tags: ["Oracle"],
    summary: "Clear all messages from a channel",
    operationId: "oracle-clear",
    request: {
      params: z.object({
        channel: z.string().describe("Channel to clear"),
      }),
    },
    responses: {
      "200": {
        description: "Clear result",
        ...contentJson(z.object({ success: z.boolean(), deleted: z.number() })),
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const db = c.env.DB;
    const info = await db
      .prepare("DELETE FROM oracle_messages WHERE channel = ?")
      .bind(data.params.channel)
      .run();

    return { success: true, deleted: info.meta.changes };
  }
}
