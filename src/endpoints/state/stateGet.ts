import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class StateGet extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["State"],
    summary: "Get coordination state by ID or type",
    request: {
      params: z.object({
        id: z.string().describe("State ID"),
      }),
    },
    responses: {
      "200": {
        description: "Coordination state",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              state: z
                .object({
                  id: z.string(),
                  state_type: z.string(),
                  active_agents: z.string(),
                  pending_tasks: z.string(),
                  shared_context: z.string(),
                })
                .nullable(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { id } = data.params;
    const db = c.env.DB;

    const state = await db
      .prepare(`SELECT * FROM coordination_state WHERE id = ?1`)
      .bind(id)
      .first();

    return { success: true, state: state ?? null };
  }
}
