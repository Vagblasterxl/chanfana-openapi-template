import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

const createSessionSchema = z.object({
  session_id: z.string().min(1),
  agent_id: z.string().min(1),
  context_summary: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export class SessionCreate extends OpenAPIRoute {
  schema = {
    summary: "Create a new session",
    description: "Start a new agent session with optional context summary and metadata",
    request: {
      body: {
        content: {
          "application/json": {
            schema: createSessionSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Session created",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              session: z.object({
                id: z.number(),
                session_id: z.string(),
                agent_id: z.string(),
                status: z.string(),
                started_at: z.string(),
              }),
            }),
          },
        },
      },
      409: {
        description: "Session already exists",
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = createSessionSchema.parse(body);
    const db = c.env.DB;

    const now = new Date().toISOString();

    try {
      const result = await db
        .prepare(`
          INSERT INTO sessions (session_id, agent_id, status, context_summary, started_at, last_activity, metadata)
          VALUES (?, ?, 'active', ?, ?, ?, ?)
        `)
        .bind(
          data.session_id,
          data.agent_id,
          data.context_summary || null,
          now,
          now,
          data.metadata ? JSON.stringify(data.metadata) : null
        )
        .run();

      return c.json({
        success: true,
        session: {
          id: result.meta.last_row_id,
          session_id: data.session_id,
          agent_id: data.agent_id,
          status: "active",
          started_at: now,
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint")) {
        return c.json({ success: false, error: "Session already exists" }, 409);
      }
      throw error;
    }
  }
}
