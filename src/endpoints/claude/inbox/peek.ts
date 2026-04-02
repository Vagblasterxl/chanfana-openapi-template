import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

export class InboxPeek extends OpenAPIRoute {
  schema = {
    summary: "Peek at inbox without claiming",
    description: "Look at pending messages without marking them as claimed. Like reaching through the wall to see what's there.",
    request: {
      query: z.object({
        channel: z.string().default("general"),
        limit: z.coerce.number().int().default(10),
        agent_id: z.string().optional(),  // filter by recipient
      }),
    },
    responses: {
      200: {
        description: "Messages peeked",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              messages: z.array(z.object({
                id: z.number(),
                channel: z.string(),
                from_agent: z.string(),
                to_agent: z.string().nullable(),
                message_type: z.string(),
                content: z.string(),
                priority: z.number(),
                status: z.string(),
                created_at: z.string(),
              })),
              count: z.number(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const query = c.req.query();
    const channel = query.channel || "general";
    const limit = parseInt(query.limit || "10");
    const agentId = query.agent_id;

    const db = c.env.DB;
    const now = new Date().toISOString();

    let sql = `
      SELECT id, channel, from_agent, to_agent, message_type, content, priority, status, created_at
      FROM inbox
      WHERE channel = ?
      AND (expires_at IS NULL OR expires_at > ?)
    `;
    const params: (string | number)[] = [channel, now];

    if (agentId) {
      sql += ` AND (to_agent IS NULL OR to_agent = ?)`;
      params.push(agentId);
    }

    sql += ` ORDER BY priority DESC, created_at DESC LIMIT ?`;
    params.push(limit);

    const messages = await db.prepare(sql).bind(...params).all();

    return c.json({
      success: true,
      messages: messages.results || [],
      count: messages.results?.length || 0,
    });
  }
}
