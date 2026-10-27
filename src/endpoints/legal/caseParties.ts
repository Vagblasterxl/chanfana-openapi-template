import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class CaseParties extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Legal"],
    summary: "List all parties in the case",
    description:
      "Returns every person, org, or entity extracted from rambles — " +
      "plaintiffs, defendants, witnesses, counsel, judges. Optional role filter.",
    request: {
      query: z.object({
        role: z
          .string()
          .optional()
          .describe("Filter by role: plaintiff, defendant, witness, counsel, judge, other"),
      }),
    },
    responses: {
      "200": {
        description: "Parties",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              count: z.number(),
              parties: z.array(
                z.object({
                  id: z.string(),
                  name: z.string(),
                  role: z.string(),
                  description: z.string().nullable(),
                  contact_info: z.string().nullable(),
                  first_mentioned_in: z.string().nullable(),
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
    const role = data.query.role;
    const db = c.env.DB;

    const stmt = role
      ? db.prepare(
          `SELECT id, name, role, description, contact_info, first_mentioned_in, created_at
           FROM legal_parties WHERE role = ?1 ORDER BY created_at ASC`,
        ).bind(role)
      : db.prepare(
          `SELECT id, name, role, description, contact_info, first_mentioned_in, created_at
           FROM legal_parties ORDER BY created_at ASC`,
        );

    const { results } = await stmt.all();
    return { success: true, count: results.length, parties: results };
  }
}
