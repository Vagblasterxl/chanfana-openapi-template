import { z } from "zod";

export const coordinationState = z.object({
  id: z.string(),
  state_type: z.string(),
  active_agents: z.string().default("[]"),
  pending_tasks: z.string().default("[]"),
  shared_context: z.string().default("{}"),
});

export const StateModel = {
  tableName: "coordination_state",
  primaryKeys: ["id"],
  schema: coordinationState,
  serializer: (obj: Record<string, string | number | boolean | null>) => {
    return { ...obj };
  },
  serializerObject: coordinationState,
};
