import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class AgentRegister extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Agents"],
    summary: "Register or update an agent",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.string().describe("Unique agent identifier"),
              name: z.string().describe("Human-readable agent name"),
              type: z.string().describe("Agent type: claude, discord-bot, worker, etc."),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Agent registered successfully",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              agent: z.object({
                id: z.string(),
                name: z.string(),
                status: z.string(),
              }),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body;
    const db = c.env.DB;
    const now = new Date().toISOString();

    await db
      .prepare(
        `INSERT INTO agents (id, name, type, status, last_heartbeat)
         VALUES (?1, ?2, ?3, 'online', ?4)
         ON CONFLICT(id) DO UPDATE SET
           name = ?2, type = ?3, status = 'online', last_heartbeat = ?4`,
      )
      .bind(body.id, body.name, body.type, now)
      .run();

    return {
      success: true,
      agent: { id: body.id, name: body.name, status: "online" },
    };
  }
}
