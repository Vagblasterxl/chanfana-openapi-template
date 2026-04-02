import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

export class SessionHeartbeat extends OpenAPIRoute {
  schema = {
    summary: "Session heartbeat",
    description: "Update the last_activity timestamp for a session to keep it alive",
    request: {
      params: z.object({
        sessionId: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Heartbeat recorded",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              session_id: z.string(),
              last_activity: z.string(),
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
    const db = c.env.DB;

    const now = new Date().toISOString();

    const result = await db
      .prepare("UPDATE sessions SET last_activity = ? WHERE session_id = ?")
      .bind(now, sessionId)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: "Session not found" }, 404);
    }

    return c.json({
      success: true,
      session_id: sessionId,
      last_activity: now,
    });
  }
}
