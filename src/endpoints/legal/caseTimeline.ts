import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class CaseTimeline extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Legal"],
    summary: "Get the full case timeline",
    description:
      "Returns all extracted timeline events, ordered by date. " +
      "This is the backbone of the case package — what happened, when, to whom.",
    responses: {
      "200": {
        description: "Timeline events",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              count: z.number(),
              events: z.array(
                z.object({
                  id: z.string(),
                  event_date: z.string().nullable(),
                  event_description: z.string(),
                  parties_involved: z.string(),
                  significance: z.string().nullable(),
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
    const db = c.env.DB;
    const { results } = await db
      .prepare(
        `SELECT id, event_date, event_description, parties_involved, significance, created_at
         FROM legal_timeline ORDER BY event_date ASC, created_at ASC`,
      )
      .all();

    return { success: true, count: results.length, events: results };
  }
}
