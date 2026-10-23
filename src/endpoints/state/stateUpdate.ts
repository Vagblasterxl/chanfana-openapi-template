import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class StateUpdate extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["State"],
    summary: "Create or update coordination state",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.string().describe("State ID"),
              state_type: z.string().describe("Type of state: session, pipeline, global"),
              active_agents: z.string().optional().describe("JSON array of active agent IDs"),
              pending_tasks: z.string().optional().describe("JSON array of pending task objects"),
              shared_context: z.string().optional().describe("JSON object of shared context"),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "State updated",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              id: z.string(),
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

    await db
      .prepare(
        `INSERT INTO coordination_state (id, state_type, active_agents, pending_tasks, shared_context)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(id) DO UPDATE SET
           state_type = ?2,
           active_agents = COALESCE(?3, active_agents),
           pending_tasks = COALESCE(?4, pending_tasks),
           shared_context = COALESCE(?5, shared_context)`,
      )
      .bind(
        body.id,
        body.state_type,
        body.active_agents ?? "[]",
        body.pending_tasks ?? "[]",
        body.shared_context ?? "{}",
      )
      .run();

    return { success: true, id: body.id };
  }
}
