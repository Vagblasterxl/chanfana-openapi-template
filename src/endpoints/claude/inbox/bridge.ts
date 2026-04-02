import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

const bridgeSchema = z.object({
  name: z.string().min(1),
  source_type: z.enum(["inbox", "memory", "comms"]),
  target_type: z.enum(["r2", "worker", "webhook"]),
  target_url: z.string().min(1),           // R2 bucket URL or worker endpoint
  target_auth: z.string().optional(),       // auth token
  filter_channel: z.string().optional(),    // only bridge specific channel
  filter_agent: z.string().optional(),      // only bridge specific agent
  transform: z.enum(["none", "compress", "json"]).default("none"),
});

export class BridgeCreate extends OpenAPIRoute {
  schema = {
    summary: "Create a bucket bridge",
    description: "Bridge messages from inbox/memory/comms to R2 buckets or external workers. The scooch mechanism.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: bridgeSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Bridge created",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              bridge_id: z.number(),
              name: z.string(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = bridgeSchema.parse(body);
    const db = c.env.DB;

    const result = await db
      .prepare(`
        INSERT INTO bucket_bridges (name, source_type, target_type, target_url, target_auth, filter_channel, filter_agent, transform)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        data.name,
        data.source_type,
        data.target_type,
        data.target_url,
        data.target_auth || null,
        data.filter_channel || null,
        data.filter_agent || null,
        data.transform
      )
      .run();

    return c.json({
      success: true,
      bridge_id: result.meta.last_row_id,
      name: data.name,
    });
  }
}

export class BridgeList extends OpenAPIRoute {
  schema = {
    summary: "List all bridges",
    responses: {
      200: {
        description: "Bridges list",
      },
    },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const bridges = await db.prepare("SELECT * FROM bucket_bridges ORDER BY name").all();
    return c.json({ bridges: bridges.results || [] });
  }
}

export class BridgeTrigger extends OpenAPIRoute {
  schema = {
    summary: "Manually trigger a bridge",
    description: "Push pending messages through a specific bridge to the target.",
    request: {
      params: z.object({
        name: z.string(),
      }),
      query: z.object({
        limit: z.coerce.number().int().default(50),
      }),
    },
    responses: {
      200: {
        description: "Bridge triggered",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              messages_sent: z.number(),
              target: z.string(),
            }),
          },
        },
      },
      404: {
        description: "Bridge not found",
      },
    },
  };

  async handle(c: AppContext) {
    const bridgeName = c.req.param("name");
    const limit = parseInt(c.req.query("limit") || "50");
    const db = c.env.DB;

    // Get bridge config
    const bridge = await db
      .prepare("SELECT * FROM bucket_bridges WHERE name = ? AND active = 1")
      .bind(bridgeName)
      .first();

    if (!bridge) {
      return c.json({ success: false, error: "Bridge not found" }, 404);
    }

    // Get messages based on source type
    let messages: Record<string, unknown>[] = [];
    const sourceType = bridge.source_type as string;

    if (sourceType === "inbox") {
      let sql = "SELECT * FROM inbox WHERE status = 'pending'";
      const params: string[] = [];

      if (bridge.filter_channel) {
        sql += " AND channel = ?";
        params.push(bridge.filter_channel as string);
      }
      if (bridge.filter_agent) {
        sql += " AND from_agent = ?";
        params.push(bridge.filter_agent as string);
      }
      sql += ` ORDER BY created_at ASC LIMIT ${limit}`;

      const result = await db.prepare(sql).bind(...params).all();
      messages = (result.results || []) as Record<string, unknown>[];
    } else if (sourceType === "memory") {
      let sql = "SELECT * FROM memories WHERE 1=1";
      const params: string[] = [];

      if (bridge.filter_agent) {
        sql += " AND agent_id = ?";
        params.push(bridge.filter_agent as string);
      }
      sql += ` ORDER BY created_at DESC LIMIT ${limit}`;

      const result = await db.prepare(sql).bind(...params).all();
      messages = (result.results || []) as Record<string, unknown>[];
    }

    if (messages.length === 0) {
      return c.json({ success: true, messages_sent: 0, target: bridge.target_url });
    }

    // Transform if needed
    let payload: string;
    const transform = bridge.transform as string;
    if (transform === "json") {
      payload = JSON.stringify(messages);
    } else if (transform === "compress") {
      // Simple compression: just stringify (real compression would use steno-compressor)
      payload = JSON.stringify(messages);
    } else {
      payload = JSON.stringify(messages);
    }

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (bridge.target_auth) {
      headers["Authorization"] = `Bearer ${bridge.target_auth}`;
    }

    // Send to target
    const targetType = bridge.target_type as string;
    try {
      if (targetType === "worker" || targetType === "webhook") {
        await fetch(bridge.target_url as string, {
          method: "POST",
          headers,
          body: payload,
        });
      } else if (targetType === "r2") {
        // For R2, we'd need to call r2-writer or similar
        // This is a placeholder - would call your r2-writer worker
        await fetch(bridge.target_url as string, {
          method: "POST",
          headers,
          body: payload,
        });
      }

      // Mark inbox messages as processed if that was the source
      if (sourceType === "inbox") {
        const ids = messages.map(m => m.id).join(",");
        await db
          .prepare(`UPDATE inbox SET status = 'processed' WHERE id IN (${ids})`)
          .run();
      }

      return c.json({
        success: true,
        messages_sent: messages.length,
        target: bridge.target_url,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Bridge trigger failed",
      }, 500);
    }
  }
}
