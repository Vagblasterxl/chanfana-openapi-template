import { z } from "zod";

// ============ MEMORY MODEL ============
export const memory = z.object({
  id: z.number().int(),
  agent_id: z.string().min(1),
  session_id: z.string().nullable().optional(),
  memory_type: z.enum(["context", "learning", "task", "fact"]),
  key: z.string().nullable().optional(),
  content: z.string().min(1),
  priority: z.number().int().default(0),
  created_at: z.string(),
  expires_at: z.string().nullable().optional(),
});

export const MemoryModel = {
  tableName: "memories",
  primaryKeys: ["id"],
  schema: memory,
  serializer: (obj: Record<string, string | number | boolean>) => obj,
};

// ============ COMMS MODEL ============
export const comms = z.object({
  id: z.number().int(),
  direction: z.enum(["in", "out"]),
  from_entity: z.string().min(1),
  to_entity: z.string().min(1),
  worker_url: z.string().nullable().optional(),
  method: z.string().default("POST"),
  payload: z.string().nullable().optional(),
  response: z.string().nullable().optional(),
  status: z.enum(["pending", "sent", "delivered", "failed"]).default("pending"),
  error_message: z.string().nullable().optional(),
  created_at: z.string(),
});

export const CommsModel = {
  tableName: "comms",
  primaryKeys: ["id"],
  schema: comms,
  serializer: (obj: Record<string, string | number | boolean>) => obj,
};

// ============ SESSION MODEL ============
export const session = z.object({
  id: z.number().int(),
  session_id: z.string().min(1),
  agent_id: z.string().min(1),
  status: z.enum(["active", "paused", "ended"]).default("active"),
  context_summary: z.string().nullable().optional(),
  started_at: z.string(),
  last_activity: z.string(),
  metadata: z.string().nullable().optional(),
});

export const SessionModel = {
  tableName: "sessions",
  primaryKeys: ["id"],
  schema: session,
  serializer: (obj: Record<string, string | number | boolean>) => obj,
};

// ============ WORKER REGISTRY MODEL ============
export const workerRegistry = z.object({
  id: z.number().int(),
  name: z.string().min(1),
  url: z.string().url(),
  auth_type: z.enum(["bearer", "basic", "none", "header"]).default("none"),
  auth_header: z.string().nullable().optional(),
  auth_token: z.string().nullable().optional(),
  account: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  status: z.enum(["active", "inactive"]).default("active"),
  created_at: z.string(),
  updated_at: z.string(),
});

export const WorkerRegistryModel = {
  tableName: "worker_registry",
  primaryKeys: ["id"],
  schema: workerRegistry,
  serializer: (obj: Record<string, string | number | boolean>) => obj,
};

// ============ RELAY REQUEST/RESPONSE ============
export const relayRequest = z.object({
  method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("POST"),
  path: z.string().optional(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});

export const relayResponse = z.object({
  success: z.boolean(),
  worker: z.string(),
  status: z.number(),
  data: z.unknown().nullable(),
  error: z.string().nullable().optional(),
  logged_id: z.number().optional(),
});
