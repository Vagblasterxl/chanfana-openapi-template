import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class KnowledgeGraph extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Knowledge"],
    summary: "Get the knowledge graph for an entity",
    description:
      "Returns all triples where the entity appears as subject or object, " +
      "building a local neighborhood graph.",
    request: {
      params: z.object({
        entity: z.string().describe("Entity ID to explore"),
      }),
      query: z.object({
        depth: z.string().optional().default("1").describe("Traversal depth (1 or 2)"),
      }),
    },
    responses: {
      "200": {
        description: "Entity knowledge graph",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              entity: z.string(),
              as_subject: z.array(z.object({
                id: z.string(),
                verb: z.string(),
                object: z.string(),
                context: z.string(),
              })),
              as_object: z.array(z.object({
                id: z.string(),
                subject: z.string(),
                verb: z.string(),
                context: z.string(),
              })),
              related_entities: z.array(z.string()),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { entity } = data.params;
    const db = c.env.DB;

    const asSubject = await db
      .prepare(`SELECT id, verb, object, context FROM knowledge_triples WHERE subject = ?1 ORDER BY created_at DESC LIMIT 100`)
      .bind(entity)
      .all();

    const asObject = await db
      .prepare(`SELECT id, subject, verb, context FROM knowledge_triples WHERE object = ?1 ORDER BY created_at DESC LIMIT 100`)
      .bind(entity)
      .all();

    const relatedSet = new Set<string>();
    for (const row of asSubject.results) {
      relatedSet.add(row.object as string);
    }
    for (const row of asObject.results) {
      relatedSet.add(row.subject as string);
    }
    relatedSet.delete(entity);

    return {
      success: true,
      entity,
      as_subject: asSubject.results,
      as_object: asObject.results,
      related_entities: Array.from(relatedSet),
    };
  }
}
