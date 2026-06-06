import { z } from "zod";

export const SVO_VERBS = [
  "generated", "derived", "composed", "transcribed", "narrated",
  "created", "updated", "approved", "published", "archived",
  "requested", "delegated", "received", "acknowledged",
  "references", "cites", "contradicts", "supersedes", "extends",
] as const;

export const tripleSchema = z.object({
  id: z.string(),
  subject: z.string(),
  verb: z.enum(SVO_VERBS),
  object: z.string(),
  context: z.string().default("{}"),
  source_task: z.string().nullable().default(null),
  source_asset: z.string().nullable().default(null),
  created_by: z.string(),
  created_at: z.string(),
});

export const KnowledgeModel = {
  tableName: "knowledge_triples",
  primaryKeys: ["id"],
  schema: tripleSchema,
  serializer: (obj: Record<string, string | number | boolean | null>) => {
    return { ...obj };
  },
  serializerObject: tripleSchema,
};
