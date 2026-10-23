import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class CaseEvidence extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Legal"],
    summary: "List all evidence items",
    description:
      "Returns every piece of evidence mentioned in rambles — documents, " +
      "photos, recordings, messages. Tracks status from 'mentioned' to 'secured'.",
    request: {
      query: z.object({
        status: z
          .string()
          .optional()
          .describe("Filter by status: mentioned, secured, missing, obtained"),
      }),
    },
    responses: {
      "200": {
        description: "Evidence items",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              count: z.number(),
              evidence: z.array(
                z.object({
                  id: z.string(),
                  description: z.string(),
                  evidence_type: z.string(),
                  location: z.string().nullable(),
                  status: z.string(),
                  supports_claim: z.string().nullable(),
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
    const status = data.query.status;
    const db = c.env.DB;

    const stmt = status
      ? db.prepare(
          `SELECT id, description, evidence_type, location, status, supports_claim, created_at
           FROM legal_evidence WHERE status = ?1 ORDER BY created_at ASC`,
        ).bind(status)
      : db.prepare(
          `SELECT id, description, evidence_type, location, status, supports_claim, created_at
           FROM legal_evidence ORDER BY created_at ASC`,
        );

    const { results } = await stmt.all();
    return { success: true, count: results.length, evidence: results };
  }
}
