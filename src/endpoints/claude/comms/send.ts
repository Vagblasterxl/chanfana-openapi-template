import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

const sendSchema = z.object({
  to_worker: z.string().min(1).describe("Name of registered worker to send to"),
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("POST"),
  path: z.string().default("/").describe("Path to append to worker URL"),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  from_entity: z.string().default("claude-sustain"),
});

export class CommsSend extends OpenAPIRoute {
  schema = {
    summary: "Send request to registered worker",
    description: "Relays a request to a worker in the registry and logs the communication",
    request: {
      body: {
        content: {
          "application/json": {
            schema: sendSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Request sent successfully",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              comms_id: z.number(),
              worker: z.string(),
              status: z.number(),
              data: z.unknown().nullable(),
            }),
          },
        },
      },
      404: {
        description: "Worker not found in registry",
      },
      500: {
        description: "Request failed",
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = sendSchema.parse(body);
    const db = c.env.DB;

    // Look up worker in registry
    const worker = await db
      .prepare("SELECT * FROM worker_registry WHERE name = ? AND status = 'active'")
      .bind(data.to_worker)
      .first();

    if (!worker) {
      return c.json({ success: false, error: `Worker '${data.to_worker}' not found in registry` }, 404);
    }

    // Build the full URL
    const url = `${worker.url}${data.path}`;

    // Build headers
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...data.headers,
    };

    // Add auth if configured
    const authToken = worker.auth_token as string | null;
    const authHeader = (worker.auth_header as string) || "Authorization";
    if (worker.auth_type === "bearer" && authToken) {
      const token = authToken.startsWith("$")
        ? String(c.env[authToken.slice(1) as keyof typeof c.env] || "")
        : authToken;
      if (token) {
        headers[authHeader] = `Bearer ${token}`;
      }
    } else if (worker.auth_type === "header" && authToken) {
      headers[(worker.auth_header as string) || "X-Auth-Token"] = authToken;
    }

    // Log the outgoing comm
    const insertResult = await db
      .prepare(`
        INSERT INTO comms (direction, from_entity, to_entity, worker_url, method, payload, status)
        VALUES ('out', ?, ?, ?, ?, ?, 'pending')
      `)
      .bind(data.from_entity, data.to_worker, url, data.method, JSON.stringify(data.body || null))
      .run();

    const commsId = insertResult.meta.last_row_id;

    try {
      // Make the request
      const response = await fetch(url, {
        method: data.method,
        headers,
        body: data.method !== "GET" && data.body ? JSON.stringify(data.body) : undefined,
      });

      const responseText = await response.text();
      let responseData: unknown;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = responseText;
      }

      // Update comm log with response
      await db
        .prepare("UPDATE comms SET status = 'delivered', response = ? WHERE id = ?")
        .bind(JSON.stringify(responseData), commsId)
        .run();

      return c.json({
        success: response.ok,
        comms_id: commsId,
        worker: data.to_worker,
        status: response.status,
        data: responseData,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Update comm log with error
      await db
        .prepare("UPDATE comms SET status = 'failed', error_message = ? WHERE id = ?")
        .bind(errorMessage, commsId)
        .run();

      return c.json({
        success: false,
        comms_id: commsId,
        worker: data.to_worker,
        error: errorMessage,
      }, 500);
    }
  }
}
