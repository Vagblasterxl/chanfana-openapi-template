import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";
import {
  createDispatcherSchema,
  dispatchSchema,
  formatSlackMessage,
  formatDiscordMessage,
  formatManusTask,
} from "./base";

export class DispatcherCreate extends OpenAPIRoute {
  schema = {
    summary: "Create an outbound dispatcher",
    description: "Register a dispatcher for sending to Discord, Slack, Manus, etc.",
    request: {
      body: {
        content: {
          "application/json": { schema: createDispatcherSchema },
        },
      },
    },
    responses: {
      200: { description: "Dispatcher created" },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = createDispatcherSchema.parse(body);
    const db = c.env.DB;

    await db
      .prepare(`
        INSERT INTO dispatchers
        (name, platform, endpoint_url, auth_type, auth_token, default_channel, rate_limit_per_minute, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        data.name,
        data.platform,
        data.endpoint_url,
        data.auth_type,
        data.auth_token || null,
        data.default_channel || null,
        data.rate_limit_per_minute,
        data.metadata ? JSON.stringify(data.metadata) : null,
        new Date().toISOString()
      )
      .run();

    return c.json({
      success: true,
      name: data.name,
      platform: data.platform,
    });
  }
}

export class DispatcherList extends OpenAPIRoute {
  schema = {
    summary: "List dispatchers",
    responses: { 200: { description: "Dispatchers list" } },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const dispatchers = await db
      .prepare("SELECT id, name, platform, endpoint_url, auth_type, default_channel, active, total_sent, last_sent_at FROM dispatchers ORDER BY name")
      .all();

    return c.json({
      success: true,
      dispatchers: dispatchers.results || [],
    });
  }
}

export class DispatcherUpdate extends OpenAPIRoute {
  schema = {
    summary: "Update a dispatcher",
    request: {
      params: z.object({ name: z.string() }),
      body: {
        content: {
          "application/json": { schema: createDispatcherSchema.partial() },
        },
      },
    },
    responses: { 200: { description: "Dispatcher updated" } },
  };

  async handle(c: AppContext) {
    const name = c.req.param("name");
    const body = await c.req.json();
    const db = c.env.DB;

    const fields = ["endpoint_url", "auth_type", "auth_token", "default_channel", "rate_limit_per_minute"];
    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: "No fields to update" }, 400);
    }

    values.push(name);
    await db
      .prepare(`UPDATE dispatchers SET ${updates.join(", ")} WHERE name = ?`)
      .bind(...values)
      .run();

    return c.json({ success: true, name });
  }
}

export class Dispatch extends OpenAPIRoute {
  schema = {
    summary: "Send via dispatcher",
    description: "Send a message/task through a registered dispatcher (to Discord, Slack, Manus, etc.)",
    request: {
      params: z.object({ name: z.string() }),
      body: {
        content: {
          "application/json": { schema: dispatchSchema },
        },
      },
    },
    responses: {
      200: { description: "Dispatched successfully" },
      404: { description: "Dispatcher not found" },
      500: { description: "Dispatch failed" },
    },
  };

  async handle(c: AppContext) {
    const name = c.req.param("name");
    const body = await c.req.json();
    const data = dispatchSchema.parse(body);
    const db = c.env.DB;
    const now = new Date().toISOString();

    // Get dispatcher
    const dispatcher = await db
      .prepare("SELECT * FROM dispatchers WHERE name = ? AND active = 1")
      .bind(name)
      .first();

    if (!dispatcher) {
      return c.json({ success: false, error: "Dispatcher not found" }, 404);
    }

    const platform = dispatcher.platform as string;
    const endpoint = dispatcher.endpoint_url as string;

    // Format payload based on platform
    let payload: Record<string, unknown>;
    const destination = data.destination || (dispatcher.default_channel as string);

    if (platform === "slack") {
      payload = formatSlackMessage(data.content, destination);
    } else if (platform === "discord") {
      payload = formatDiscordMessage(data.content, data.embed);
    } else if (platform === "manus") {
      payload = formatManusTask(data.content, data.metadata);
    } else {
      payload = { content: data.content, destination, ...data.metadata };
    }

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const authType = dispatcher.auth_type as string;
    const authToken = dispatcher.auth_token as string | null;

    if (authToken) {
      if (authType === "bearer") {
        const token = authToken.startsWith("$")
          ? String(c.env[authToken.slice(1) as keyof typeof c.env] || "")
          : authToken;
        headers["Authorization"] = `Bearer ${token}`;
      } else if (authType === "bot") {
        headers["Authorization"] = `Bot ${authToken}`;
      } else if (authType === "basic") {
        headers["Authorization"] = `Basic ${Buffer.from(authToken).toString("base64")}`;
      }
    }

    // Log the dispatch attempt
    const logResult = await db
      .prepare(`
        INSERT INTO dispatch_log (dispatcher_name, platform, destination, content, status, created_at)
        VALUES (?, ?, ?, ?, 'pending', ?)
      `)
      .bind(name, platform, destination || null, data.content, now)
      .run();

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`${response.status}: ${responseText}`);
      }

      // Update log
      await db
        .prepare("UPDATE dispatch_log SET status = 'sent', response = ? WHERE id = ?")
        .bind(responseText, logResult.meta.last_row_id)
        .run();

      // Update dispatcher stats
      await db
        .prepare("UPDATE dispatchers SET total_sent = total_sent + 1, last_sent_at = ?, last_error = NULL WHERE name = ?")
        .bind(now, name)
        .run();

      return c.json({
        success: true,
        dispatcher: name,
        platform,
        destination,
        dispatch_log_id: logResult.meta.last_row_id,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Update log
      await db
        .prepare("UPDATE dispatch_log SET status = 'failed', error_message = ? WHERE id = ?")
        .bind(errorMessage, logResult.meta.last_row_id)
        .run();

      // Update dispatcher with error
      await db
        .prepare("UPDATE dispatchers SET last_error = ? WHERE name = ?")
        .bind(errorMessage, name)
        .run();

      return c.json({
        success: false,
        error: errorMessage,
        dispatch_log_id: logResult.meta.last_row_id,
      }, 500);
    }
  }
}

// Quick dispatch endpoints for common platforms
export class DispatchToManus extends OpenAPIRoute {
  schema = {
    summary: "Quick dispatch to Manus",
    description: "Send a task directly to Manus autonomous agent",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              task: z.string().min(1),
              mode: z.enum(["autonomous", "supervised", "planning"]).default("autonomous"),
              context: z.string().optional(),
              callback_url: z.string().url().optional(),
            }),
          },
        },
      },
    },
    responses: {
      200: { description: "Task sent to Manus" },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const db = c.env.DB;
    const now = new Date().toISOString();

    // Get manus dispatcher
    const dispatcher = await db
      .prepare("SELECT * FROM dispatchers WHERE platform = 'manus' AND active = 1 LIMIT 1")
      .first();

    if (!dispatcher) {
      return c.json({ success: false, error: "No Manus dispatcher configured" }, 404);
    }

    // Build Manus payload
    const payload = {
      task: body.task,
      mode: body.mode,
      context: body.context,
      callback_url: body.callback_url,
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    const authToken = dispatcher.auth_token as string | null;
    if (authToken) {
      const token = authToken.startsWith("$")
        ? String(c.env[authToken.slice(1) as keyof typeof c.env] || "")
        : authToken;
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Log to manus-tasks channel
    await db
      .prepare(`
        INSERT INTO inbox (channel, from_agent, message_type, content, metadata, created_at)
        VALUES ('manus-tasks', 'dispatch', 'task', ?, ?, ?)
      `)
      .bind(body.task, JSON.stringify({ mode: body.mode }), now)
      .run();

    try {
      const response = await fetch(dispatcher.endpoint_url as string, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();

      return c.json({
        success: response.ok,
        task_id: (responseData as Record<string, unknown>).task_id || (responseData as Record<string, unknown>).id,
        status: (responseData as Record<string, unknown>).status,
      });
    } catch (error) {
      return c.json({
        success: false,
        error: error instanceof Error ? error.message : "Failed to reach Manus",
      }, 500);
    }
  }
}
