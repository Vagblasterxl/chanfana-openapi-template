import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class CaseClaims extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Legal"],
    summary: "List all legal claims / causes of action",
    description:
      "Returns every legal theory identified for the case, with attached " +
      "statutes and supporting facts.",
    responses: {
      "200": {
        description: "Claims",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              count: z.number(),
              claims: z.array(
                z.object({
                  id: z.string(),
                  claim_type: z.string(),
                  statute: z.string().nullable(),
                  statute_text: z.string().nullable(),
                  facts_supporting: z.string(),
                  evidence_refs: z.string(),
                  status: z.string(),
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
        `SELECT id, claim_type, statute, statute_text, facts_supporting, evidence_refs, status, created_at
         FROM legal_claims ORDER BY created_at ASC`,
      )
      .all();
    return { success: true, count: results.length, claims: results };
  }
}

export class CaseClaimUpsert extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Legal"],
    summary: "Add or update a legal claim with researched statute",
    description:
      "Attach a California statute and its text to a claim after legal " +
      "research. Use this to persist findings from statute/case-law research " +
      "so the case package cites real law. Upserts by claim id if provided.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              id: z.string().optional().describe("Existing claim id to update, omit to create"),
              claim_type: z.string().describe("e.g. breach of warranty of habitability"),
              statute: z.string().optional().describe("e.g. CA Civil Code 1942.4"),
              statute_text: z.string().optional().describe("Relevant text of the statute"),
              facts_supporting: z.array(z.string()).optional().describe("Facts that satisfy each element"),
              evidence_refs: z.array(z.string()).optional().describe("Evidence item IDs supporting this claim"),
              status: z
                .enum(["identified", "researched", "supported", "filed"])
                .default("identified")
                .describe("Maturity of the claim"),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Claim stored",
        content: {
          "application/json": {
            schema: z.object({ success: Bool(), claim_id: z.string() }),
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
    const claimId = body.id ?? `claim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await db
      .prepare(
        `INSERT INTO legal_claims (id, claim_type, statute, statute_text, facts_supporting, evidence_refs, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
         ON CONFLICT(id) DO UPDATE SET
           claim_type = excluded.claim_type,
           statute = excluded.statute,
           statute_text = excluded.statute_text,
           facts_supporting = excluded.facts_supporting,
           evidence_refs = excluded.evidence_refs,
           status = excluded.status`,
      )
      .bind(
        claimId,
        body.claim_type,
        body.statute ?? null,
        body.statute_text ?? null,
        JSON.stringify(body.facts_supporting ?? []),
        JSON.stringify(body.evidence_refs ?? []),
        body.status,
        now,
      )
      .run();

    return { success: true, claim_id: claimId };
  }
}
