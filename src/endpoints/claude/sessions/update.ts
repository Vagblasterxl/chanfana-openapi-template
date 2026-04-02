import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

const updateSessionSchema = z.object({
  status: z.enum(["active", "paused", "ended"]).optional(),
  context_summary: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export class SessionUpdate extends OpenAPIRoute {
  schema = {
    summary: "Update a session",
    description: "Update session status, context summary, or metadata. Also updates last_activity timestamp.",
    request: {
      params: z.object({
        sessionId: z.string(),
      }),
      body: {
        content: {
          "application/json": {
            schema: updateSessionSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Session updated",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              session: z.object({
                session_id: z.string(),
                status: z.string(),
                last_activity: z.string(),
              }),
            }),
          },
        },
      },
      404: {
        description: "Session not found",
      },
    },
  };

  async handle(c: AppContext) {
    const sessionId = c.req.param("sessionId");
    const body = await c.req.json();
    const data = updateSessionSchema.parse(body);
    const db = c.env.DB;

    // Check if session exists
    const existing = await db
      .prepare("SELECT * FROM sessions WHERE session_id = ?")
      .bind(sessionId)
      .first();

    if (!existing) {
      return c.json({ success: false, error: "Session not found" }, 404);
    }

    const now = new Date().toISOString();
    const updates: string[] = ["last_activity = ?"];
    const values: (string | null)[] = [now];

    if (data.status) {
      updates.push("status = ?");
      values.push(data.status);
    }

    if (data.context_summary !== undefined) {
      updates.push("context_summary = ?");
      values.push(data.context_summary);
    }

    if (data.metadata !== undefined) {
      updates.push("metadata = ?");
      values.push(JSON.stringify(data.metadata));
    }

    values.push(sessionId);

    await db
      .prepare(`UPDATE sessions SET ${updates.join(", ")} WHERE session_id = ?`)
      .bind(...values)
      .run();

    return c.json({
      success: true,
      session: {
        session_id: sessionId,
        status: data.status || existing.status,
        last_activity: now,
      },
    });
  }
}
