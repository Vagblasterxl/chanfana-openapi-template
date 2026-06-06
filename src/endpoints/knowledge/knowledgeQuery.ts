import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class KnowledgeQuery extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Knowledge"],
    summary: "Query knowledge triples by subject, object, or verb",
    request: {
      query: z.object({
        subject: z.string().optional().describe("Filter by subject"),
        object: z.string().optional().describe("Filter by object"),
        verb: z.string().optional().describe("Filter by verb"),
        source_asset: z.string().optional().describe("Filter by source asset"),
        limit: z.string().optional().default("50").describe("Max results"),
      }),
    },
    responses: {
      "200": {
        description: "Matching triples",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              count: z.number().int(),
              triples: z.array(
                z.object({
                  id: z.string(),
                  subject: z.string(),
                  verb: z.string(),
                  object: z.string(),
                  context: z.string(),
                  source_task: z.string().nullable(),
                  source_asset: z.string().nullable(),
                  created_by: z.string(),
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
    const q = data.query;
    const db = c.env.DB;

    const conditions: string[] = [];
    const binds: (string | number)[] = [];
    let paramIdx = 1;

    if (q.subject) {
      conditions.push(`subject = ?${paramIdx++}`);
      binds.push(q.subject);
    }
    if (q.object) {
      conditions.push(`object = ?${paramIdx++}`);
      binds.push(q.object);
    }
    if (q.verb) {
      conditions.push(`verb = ?${paramIdx++}`);
      binds.push(q.verb);
    }
    if (q.source_asset) {
      conditions.push(`source_asset = ?${paramIdx++}`);
      binds.push(q.source_asset);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(parseInt(q.limit ?? "50", 10) || 50, 200);

    const stmt = db.prepare(
      `SELECT * FROM knowledge_triples ${where} ORDER BY created_at DESC LIMIT ${limit}`,
    );

    const result = binds.length > 0 ? await stmt.bind(...binds).all() : await stmt.all();

    return {
      success: true,
      count: result.results.length,
      triples: result.results,
    };
  }
}
