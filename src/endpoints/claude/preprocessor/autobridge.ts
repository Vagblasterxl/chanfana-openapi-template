import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";
import { autobridgeRequestSchema, buildPrompt, requestBuilders, responseExtractors } from "./base";

export class AutobridgeCreate extends OpenAPIRoute {
  schema = {
    summary: "Create an autobridge",
    description: "Watch an inbox channel and auto-process messages through a preprocessor config",
    request: {
      body: {
        content: {
          "application/json": { schema: autobridgeRequestSchema },
        },
      },
    },
    responses: {
      200: { description: "Autobridge created" },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = autobridgeRequestSchema.parse(body);
    const db = c.env.DB;

    // Verify config exists
    const config = await db
      .prepare("SELECT * FROM preprocessor_configs WHERE name = ?")
      .bind(data.preprocessor_config)
      .first();

    if (!config) {
      return c.json({ success: false, error: `Config '${data.preprocessor_config}' not found` }, 404);
    }

    const result = await db
      .prepare(`
        INSERT INTO preprocessor_autobridges
        (name, source_channel, filter_message_type, filter_from_agent, preprocessor_config, output_channel, batch_size, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        data.name,
        data.source_channel,
        data.filter_message_type || null,
        data.filter_from_agent || null,
        data.preprocessor_config,
        data.output_channel,
        data.batch_size,
        new Date().toISOString()
      )
      .run();

    return c.json({
      success: true,
      autobridge: {
        id: result.meta.last_row_id,
        name: data.name,
        source_channel: data.source_channel,
        output_channel: data.output_channel,
      },
    });
  }
}

export class AutobridgeList extends OpenAPIRoute {
  schema = {
    summary: "List autobridges",
    responses: { 200: { description: "Autobridges list" } },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const bridges = await db
      .prepare("SELECT * FROM preprocessor_autobridges ORDER BY name")
      .all();

    return c.json({
      success: true,
      autobridges: bridges.results || [],
    });
  }
}

export class AutobridgeTrigger extends OpenAPIRoute {
  schema = {
    summary: "Trigger an autobridge",
    description: "Process pending messages from source channel through the preprocessor and push results to output channel",
    request: {
      params: z.object({ name: z.string() }),
    },
    responses: {
      200: { description: "Autobridge triggered" },
      404: { description: "Autobridge not found" },
    },
  };

  async handle(c: AppContext) {
    const name = c.req.param("name");
    const db = c.env.DB;
    const now = new Date().toISOString();

    // Get autobridge config
    const bridge = await db
      .prepare("SELECT * FROM preprocessor_autobridges WHERE name = ? AND active = 1")
      .bind(name)
      .first();

    if (!bridge) {
      return c.json({ success: false, error: "Autobridge not found" }, 404);
    }

    // Get preprocessor config
    const config = await db
      .prepare("SELECT * FROM preprocessor_configs WHERE name = ? AND active = 1")
      .bind(bridge.preprocessor_config)
      .first();

    if (!config) {
      return c.json({ success: false, error: `Config '${bridge.preprocessor_config}' not found` }, 404);
    }

    // Get worker
    const worker = await db
      .prepare("SELECT * FROM worker_registry WHERE name = ? AND status = 'active'")
      .bind(config.worker_name)
      .first();

    if (!worker) {
      return c.json({ success: false, error: `Worker '${config.worker_name}' not found` }, 404);
    }

    // Pull pending messages from source channel
    let sql = `SELECT * FROM inbox WHERE channel = ? AND status = 'pending'`;
    const params: (string | number)[] = [bridge.source_channel as string];

    if (bridge.filter_message_type) {
      sql += " AND message_type = ?";
      params.push(bridge.filter_message_type as string);
    }
    if (bridge.filter_from_agent) {
      sql += " AND from_agent = ?";
      params.push(bridge.filter_from_agent as string);
    }

    sql += ` ORDER BY priority DESC, created_at ASC LIMIT ${bridge.batch_size || 10}`;

    const messages = await db.prepare(sql).bind(...params).all();

    if (!messages.results || messages.results.length === 0) {
      return c.json({
        success: true,
        processed: 0,
        message: "No pending messages in source channel",
      });
    }

    // Build headers for worker
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const authToken = worker.auth_token as string | null;
    if (worker.auth_type === "bearer" && authToken) {
      const token = authToken.startsWith("$")
        ? String(c.env[authToken.slice(1) as keyof typeof c.env] || "")
        : authToken;
      headers["Authorization"] = `Bearer ${token}`;
    }

    let processed = 0;
    const errors: string[] = [];

    // Process each message
    for (const msg of messages.results as Record<string, unknown>[]) {
      try {
        // Build prompt from config template
        const content = msg.content as string;
        const userPrompt = config.user_prompt_template
          ? buildPrompt(config.user_prompt_template as string, content)
          : content;

        const request = requestBuilders.openai(
          config.system_prompt as string || "Process the following.",
          userPrompt,
          config.max_tokens as number || 4096,
          config.temperature as number || 0.3
        );

        // Call preprocessor
        const response = await fetch(worker.url as string, {
          method: "POST",
          headers,
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          throw new Error(`Worker returned ${response.status}`);
        }

        const responseData = await response.json() as Record<string, unknown>;
        const result = responseExtractors.openai(responseData);

        // Push result to output channel
        await db
          .prepare(`
            INSERT INTO inbox (channel, from_agent, message_type, content, metadata, created_at)
            VALUES (?, 'autobridge', ?, ?, ?, ?)
          `)
          .bind(
            bridge.output_channel,
            config.mode,
            result,
            JSON.stringify({ source_id: msg.id, autobridge: name, config: bridge.preprocessor_config }),
            now
          )
          .run();

        // Mark source message as processed
        await db
          .prepare("UPDATE inbox SET status = 'processed', claimed_by = ? WHERE id = ?")
          .bind(`autobridge:${name}`, msg.id)
          .run();

        processed++;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        errors.push(`Message ${msg.id}: ${errMsg}`);

        // Mark as failed
        await db
          .prepare("UPDATE inbox SET status = 'claimed', claimed_by = ? WHERE id = ?")
          .bind(`autobridge:${name}:failed`, msg.id)
          .run();
      }
    }

    // Update autobridge stats
    await db
      .prepare("UPDATE preprocessor_autobridges SET last_triggered_at = ?, total_processed = total_processed + ? WHERE name = ?")
      .bind(now, processed, name)
      .run();

    return c.json({
      success: true,
      processed,
      total_attempted: messages.results.length,
      errors: errors.length > 0 ? errors : undefined,
      output_channel: bridge.output_channel,
    });
  }
}
