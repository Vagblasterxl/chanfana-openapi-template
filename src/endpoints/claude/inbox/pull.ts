import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

export class InboxPull extends OpenAPIRoute {
  schema = {
    summary: "Pull messages from inbox",
    description: "Claim and retrieve pending messages. Messages are marked as claimed so other agents don't grab them.",
    request: {
      query: z.object({
        agent_id: z.string().min(1),
        channel: z.string().default("general"),
        limit: z.coerce.number().int().default(10),
        message_type: z.string().optional(),
        include_broadcast: z.coerce.boolean().default(true),
      }),
    },
    responses: {
      200: {
        description: "Messages retrieved",
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
                created_at: z.string(),
                metadata: z.unknown().nullable(),
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
    const agentId = query.agent_id;
    const channel = query.channel || "general";
    const limit = parseInt(query.limit || "10");
    const messageType = query.message_type;
    const includeBroadcast = query.include_broadcast !== "false";

    const db = c.env.DB;
    const now = new Date().toISOString();

    // Build query for unclaimed messages addressed to this agent or broadcast
    let sql = `
      SELECT * FROM inbox
      WHERE channel = ?
      AND status = 'pending'
      AND (expires_at IS NULL OR expires_at > ?)
    `;
    const params: (string | number)[] = [channel, now];

    if (includeBroadcast) {
      sql += ` AND (to_agent IS NULL OR to_agent = ?)`;
      params.push(agentId);
    } else {
      sql += ` AND to_agent = ?`;
      params.push(agentId);
    }

    if (messageType) {
      sql += ` AND message_type = ?`;
      params.push(messageType);
    }

    sql += ` ORDER BY priority DESC, created_at ASC LIMIT ?`;
    params.push(limit);

    const messages = await db
      .prepare(sql)
      .bind(...params)
      .all();

    // Claim the messages
    if (messages.results && messages.results.length > 0) {
      const ids = messages.results.map((m: Record<string, unknown>) => m.id).join(",");
      await db
        .prepare(`UPDATE inbox SET status = 'claimed', claimed_by = ?, claimed_at = ? WHERE id IN (${ids})`)
        .bind(agentId, now)
        .run();
    }

    return c.json({
      success: true,
      messages: (messages.results || []).map((m: Record<string, unknown>) => ({
        ...m,
        metadata: m.metadata ? JSON.parse(m.metadata as string) : null,
      })),
      count: messages.results?.length || 0,
    });
  }
}
