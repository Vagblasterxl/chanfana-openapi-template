import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class AgentHeartbeat extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Agents"],
    summary: "Agent heartbeat - updates status and last_heartbeat",
    request: {
      params: z.object({
        id: z.string().describe("Agent ID"),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              status: z.string().default("online"),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Heartbeat accepted",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              pending_messages: z.number().int(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { id } = data.params;
    const body = data.body;
    const db = c.env.DB;
    const now = new Date().toISOString();

    await db
      .prepare(
        `UPDATE agents SET status = ?1, last_heartbeat = ?2 WHERE id = ?3`,
      )
      .bind(body.status, now, id)
      .run();

    // Return count of pending messages for this agent
    const pending = await db
      .prepare(
        `SELECT COUNT(*) as count FROM messages WHERE recipient = ?1 AND status = 'pending'`,
      )
      .bind(id)
      .first<{ count: number }>();

    return { success: true, pending_messages: pending?.count ?? 0 };
  }
}
