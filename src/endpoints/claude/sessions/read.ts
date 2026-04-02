import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

export class SessionRead extends OpenAPIRoute {
  schema = {
    summary: "Get session by session_id",
    description: "Retrieve a session by its unique session_id",
    request: {
      params: z.object({
        sessionId: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Session found",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              session: z.object({
                id: z.number(),
                session_id: z.string(),
                agent_id: z.string(),
                status: z.string(),
                context_summary: z.string().nullable(),
                started_at: z.string(),
                last_activity: z.string(),
                metadata: z.unknown().nullable(),
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
    const db = c.env.DB;

    const session = await db
      .prepare("SELECT * FROM sessions WHERE session_id = ?")
      .bind(sessionId)
      .first();

    if (!session) {
      return c.json({ success: false, error: "Session not found" }, 404);
    }

    return c.json({
      success: true,
      session: {
        ...session,
        metadata: session.metadata ? JSON.parse(session.metadata as string) : null,
      },
    });
  }
}
