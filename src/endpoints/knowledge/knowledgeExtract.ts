import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";
import { SVO_VERBS } from "./base";
import { pushToMem, formatTripleAsMemNote } from "../../lib/mem";

export class KnowledgeExtract extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Knowledge"],
    summary: "Extract and store SVO knowledge triples",
    description:
      "Ingests one or more Subject·Verb·Object triples into the knowledge graph. " +
      "Verbs must come from the controlled SVO vocabulary.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              agent_id: z.string().describe("Agent submitting the triples"),
              source_task: z.string().nullable().optional().describe("Task ID that produced these triples"),
              source_asset: z.string().nullable().optional().describe("Asset ID these triples describe"),
              triples: z.array(
                z.object({
                  subject: z.string().describe("Entity ID or name (e.g. 'img-20260218-001')"),
                  verb: z.enum(SVO_VERBS).describe("Controlled vocabulary verb"),
                  object: z.string().describe("Entity ID or name"),
                  context: z.record(z.unknown()).optional().describe("Additional context metadata"),
                }),
              ).min(1),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Triples stored",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              stored: z.number().int(),
              triple_ids: z.array(z.string()),
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
    const tripleIds: string[] = [];

    for (const triple of body.triples) {
      const id = `svo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      tripleIds.push(id);

      await db
        .prepare(
          `INSERT INTO knowledge_triples (id, subject, verb, object, context, source_task, source_asset, created_by, created_at)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
        )
        .bind(
          id,
          triple.subject,
          triple.verb,
          triple.object,
          JSON.stringify(triple.context ?? {}),
          body.source_task ?? null,
          body.source_asset ?? null,
          body.agent_id,
          now,
        )
        .run();
    }

    const memKey = (c.env as Record<string, unknown>).MEM_API_KEY as string | undefined;
    if (memKey) {
      const batchContent = body.triples
        .map((t) => formatTripleAsMemNote(t.subject, t.verb, t.object, t.context as Record<string, unknown>, body.source_asset ?? undefined))
        .join("\n\n---\n\n");
      c.executionCtx.waitUntil(pushToMem(memKey, batchContent));
    }

    return { success: true, stored: tripleIds.length, triple_ids: tripleIds };
  }
}
