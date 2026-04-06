import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";
import { createBridgeSchema } from "./base";

export class IntegrationBridgeCreate extends OpenAPIRoute {
  schema = {
    summary: "Create an integration bridge",
    description: "Auto-route messages between systems (webhook→dispatcher, inbox→slack, etc.)",
    request: {
      body: {
        content: {
          "application/json": { schema: createBridgeSchema },
        },
      },
    },
    responses: {
      200: { description: "Bridge created" },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = createBridgeSchema.parse(body);
    const db = c.env.DB;

    await db
      .prepare(`
        INSERT INTO integration_bridges
        (name, description, source_type, source_filter, dest_type, dest_name, dest_config, transform, transform_config, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        data.name,
        data.description || null,
        data.source_type,
        data.source_filter ? JSON.stringify(data.source_filter) : null,
        data.dest_type,
        data.dest_name,
        data.dest_config ? JSON.stringify(data.dest_config) : null,
        data.transform,
        data.transform_config ? JSON.stringify(data.transform_config) : null,
        new Date().toISOString()
      )
      .run();

    return c.json({
      success: true,
      name: data.name,
      source: `${data.source_type}`,
      dest: `${data.dest_type}:${data.dest_name}`,
    });
  }
}

export class IntegrationBridgeList extends OpenAPIRoute {
  schema = {
    summary: "List integration bridges",
    responses: { 200: { description: "Bridges list" } },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const bridges = await db
      .prepare("SELECT * FROM integration_bridges ORDER BY name")
      .all();

    return c.json({
      success: true,
      bridges: (bridges.results || []).map((b: Record<string, unknown>) => ({
        ...b,
        source_filter: b.source_filter ? JSON.parse(b.source_filter as string) : null,
        dest_config: b.dest_config ? JSON.parse(b.dest_config as string) : null,
        transform_config: b.transform_config ? JSON.parse(b.transform_config as string) : null,
      })),
    });
  }
}

export class IntegrationBridgeTrigger extends OpenAPIRoute {
  schema = {
    summary: "Manually trigger a bridge",
    description: "Process pending items through a bridge",
    request: {
      params: z.object({ name: z.string() }),
      query: z.object({
        limit: z.coerce.number().int().default(10),
      }),
    },
    responses: {
      200: { description: "Bridge triggered" },
      404: { description: "Bridge not found" },
    },
  };

  async handle(c: AppContext) {
    const name = c.req.param("name");
    const limit = parseInt(c.req.query("limit") || "10");
    const db = c.env.DB;
    const now = new Date().toISOString();

    // Get bridge config
    const bridge = await db
      .prepare("SELECT * FROM integration_bridges WHERE name = ? AND active = 1")
      .bind(name)
      .first();

    if (!bridge) {
      return c.json({ success: false, error: "Bridge not found" }, 404);
    }

    const sourceType = bridge.source_type as string;
    const destType = bridge.dest_type as string;
    const destName = bridge.dest_name as string;
    const sourceFilter = bridge.source_filter ? JSON.parse(bridge.source_filter as string) : {};

    let items: Record<string, unknown>[] = [];
    let processed = 0;

    // Get items from source
    if (sourceType === "inbox") {
      let sql = "SELECT * FROM inbox WHERE status = 'pending'";
      const params: string[] = [];

      if (sourceFilter.channel) {
        sql += " AND channel = ?";
        params.push(sourceFilter.channel);
      }
      if (sourceFilter.message_type) {
        sql += " AND message_type = ?";
        params.push(sourceFilter.message_type);
      }

      sql += ` ORDER BY priority DESC, created_at ASC LIMIT ${limit}`;

      const result = await db.prepare(sql).bind(...params).all();
      items = (result.results || []) as Record<string, unknown>[];
    } else if (sourceType === "webhook") {
      let sql = "SELECT * FROM webhook_log WHERE routed_to IS NULL OR routed_to = ''";
      const params: string[] = [];

      if (sourceFilter.platform) {
        sql += " AND platform = ?";
        params.push(sourceFilter.platform);
      }

      sql += ` ORDER BY created_at ASC LIMIT ${limit}`;

      const result = await db.prepare(sql).bind(...params).all();
      items = (result.results || []) as Record<string, unknown>[];
    }

    // Route to destination
    for (const item of items) {
      try {
        const content = (item.content as string) || (item.payload as string) || "";

        if (destType === "dispatcher") {
          // Get dispatcher and send
          const dispatcher = await db
            .prepare("SELECT * FROM dispatchers WHERE name = ? AND active = 1")
            .bind(destName)
            .first();

          if (dispatcher) {
            const headers: Record<string, string> = { "Content-Type": "application/json" };
            const authToken = dispatcher.auth_token as string | null;
            if (authToken && dispatcher.auth_type === "bearer") {
              headers["Authorization"] = `Bearer ${authToken}`;
            }

            await fetch(dispatcher.endpoint_url as string, {
              method: "POST",
              headers,
              body: JSON.stringify({ content }),
            });

            processed++;
          }
        } else if (destType === "inbox") {
          // Route to another inbox channel
          await db
            .prepare(`
              INSERT INTO inbox (channel, from_agent, message_type, content, metadata, created_at)
              VALUES (?, 'bridge', 'bridged', ?, ?, ?)
            `)
            .bind(destName, content, JSON.stringify({ bridge: name, source_id: item.id }), now)
            .run();
          processed++;
        }

        // Mark source as processed if it's inbox
        if (sourceType === "inbox") {
          await db
            .prepare("UPDATE inbox SET status = 'processed', claimed_by = ? WHERE id = ?")
            .bind(`bridge:${name}`, item.id)
            .run();
        }
      } catch (error) {
        console.error(`Bridge ${name} failed for item ${item.id}:`, error);
      }
    }

    // Update bridge stats
    await db
      .prepare("UPDATE integration_bridges SET total_bridged = total_bridged + ? WHERE name = ?")
      .bind(processed, name)
      .run();

    return c.json({
      success: true,
      bridge: name,
      processed,
      total_items: items.length,
    });
  }
}
