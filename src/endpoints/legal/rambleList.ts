import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class RambleList extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Legal"],
    summary: "List rambles (optionally only unprocessed)",
    description:
      "Returns ingested rambles. Use ?unprocessed=true to find raw dumps that " +
      "haven't been structured yet — any Claude can pick these up, extract " +
      "timeline/parties/evidence/claims, and re-ingest them structured.",
    request: {
      query: z.object({
        unprocessed: z
          .enum(["true", "false"])
          .optional()
          .describe("Only return rambles that have not been structured yet"),
      }),
    },
    responses: {
      "200": {
        description: "Rambles",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              count: z.number(),
              rambles: z.array(
                z.object({
                  id: z.string(),
                  raw_text: z.string(),
                  source: z.string(),
                  agent_id: z.string().nullable(),
                  processed: z.number(),
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
    const onlyUnprocessed = data.query.unprocessed === "true";
    const db = c.env.DB;

    const stmt = onlyUnprocessed
      ? db.prepare(
          `SELECT id, raw_text, source, agent_id, processed, created_at
           FROM legal_rambles WHERE processed = 0 ORDER BY created_at ASC`,
        )
      : db.prepare(
          `SELECT id, raw_text, source, agent_id, processed, created_at
           FROM legal_rambles ORDER BY created_at DESC`,
        );

    const { results } = await stmt.all();
    return { success: true, count: results.length, rambles: results };
  }
}
