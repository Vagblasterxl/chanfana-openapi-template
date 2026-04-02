import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

export class RelayProxy extends OpenAPIRoute {
  schema = {
    summary: "Proxy request to registered worker",
    description: "Forwards any request to a worker in the registry. Path after worker name is appended to worker URL.",
    request: {
      params: z.object({
        workerName: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Proxied response from worker",
      },
      404: {
        description: "Worker not found",
      },
      502: {
        description: "Bad gateway - worker request failed",
      },
    },
  };

  async handle(c: AppContext) {
    const workerName = c.req.param("workerName");
    const db = c.env.DB;

    // Look up worker
    const worker = await db
      .prepare("SELECT * FROM worker_registry WHERE name = ? AND status = 'active'")
      .bind(workerName)
      .first();

    if (!worker) {
      return c.json({ success: false, error: `Worker '${workerName}' not found` }, 404);
    }

    // Get the remaining path after /relay/:workerName
    const url = new URL(c.req.url);
    const pathMatch = url.pathname.match(/\/claude\/relay\/[^/]+\/(.*)/);
    const remainingPath = pathMatch ? `/${pathMatch[1]}` : "/";

    // Build target URL
    const targetUrl = `${worker.url}${remainingPath}${url.search}`;

    // Copy headers, excluding host
    const headers = new Headers();
    c.req.raw.headers.forEach((value, key) => {
      if (key.toLowerCase() !== "host") {
        headers.set(key, value);
      }
    });

    // Add auth if configured
    if (worker.auth_type === "bearer" && worker.auth_token) {
      const token = (worker.auth_token as string).startsWith("$")
        ? c.env[(worker.auth_token as string).slice(1) as keyof typeof c.env] as string
        : worker.auth_token;
      if (token) {
        headers.set(worker.auth_header as string || "Authorization", `Bearer ${token}`);
      }
    } else if (worker.auth_type === "header" && worker.auth_token) {
      headers.set(worker.auth_header as string || "X-Auth-Token", worker.auth_token as string);
    }

    try {
      // Get body if present
      let body: string | undefined;
      if (c.req.method !== "GET" && c.req.method !== "HEAD") {
        body = await c.req.text();
      }

      // Make the proxied request
      const response = await fetch(targetUrl, {
        method: c.req.method,
        headers,
        body,
      });

      // Log the communication
      await db
        .prepare(`
          INSERT INTO comms (direction, from_entity, to_entity, worker_url, method, payload, response, status)
          VALUES ('out', 'relay-proxy', ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          workerName,
          targetUrl,
          c.req.method,
          body || null,
          `Status: ${response.status}`,
          response.ok ? "delivered" : "failed"
        )
        .run();

      // Return the response with original headers
      const responseHeaders = new Headers();
      response.headers.forEach((value, key) => {
        // Skip certain headers that shouldn't be forwarded
        if (!["content-encoding", "transfer-encoding", "connection"].includes(key.toLowerCase())) {
          responseHeaders.set(key, value);
        }
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      // Log failed communication
      await db
        .prepare(`
          INSERT INTO comms (direction, from_entity, to_entity, worker_url, method, status, error_message)
          VALUES ('out', 'relay-proxy', ?, ?, ?, 'failed', ?)
        `)
        .bind(workerName, targetUrl, c.req.method, errorMessage)
        .run();

      return c.json({
        success: false,
        error: `Failed to reach worker: ${errorMessage}`,
      }, 502);
    }
  }
}
