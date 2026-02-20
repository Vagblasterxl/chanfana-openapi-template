import { z } from "zod";

export const agent = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  status: z.string().default("online"),
  last_heartbeat: z.string().nullable(),
});

export const AgentModel = {
  tableName: "agents",
  primaryKeys: ["id"],
  schema: agent,
  serializer: (obj: Record<string, string | number | boolean | null>) => {
    return { ...obj };
  },
  serializerObject: agent,
};
