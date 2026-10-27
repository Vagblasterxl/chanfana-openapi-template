import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class MessageReceive extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Messages"],
    summary: "Receive pending messages for an agent",
    request: {
      params: z.object({
        agent_id: z.string().describe("Recipient agent ID"),
      }),
      query: z.object({
        mark_read: z.string().optional().describe("Set to 'true' to mark messages as delivered"),
      }),
    },
    responses: {
      "200": {
        description: "Pending messages",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              messages: z.array(
                z.object({
                  id: z.string(),
                  sender: z.string(),
                  message_type: z.string(),
                  payload: z.string(),
                  created_at: z.string(),
                }),
              ),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { agent_id } = data.params;
    const markRead = data.query.mark_read === "true";
    const db = c.env.DB;

    const result = await db
      .prepare(
        `SELECT id, sender, message_type, payload, created_at
         FROM messages WHERE recipient = ?1 AND status = 'pending'
         ORDER BY created_at ASC`,
      )
      .bind(agent_id)
      .all();

    // Mark as delivered if requested
    if (markRead && result.results.length > 0) {
      const ids = result.results.map((m) => m.id);
      // Batch update — SQLite doesn't support array params, so use a simple loop
      for (const id of ids) {
        await db
          .prepare(`UPDATE messages SET status = 'delivered' WHERE id = ?1`)
          .bind(id)
          .run();
      }
    }

    return { success: true, messages: result.results };
  }
}
