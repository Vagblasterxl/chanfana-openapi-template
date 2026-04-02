import { Hono } from "hono";
import { fromHono } from "chanfana";

// Memory endpoints
import { MemoryCreate } from "./memory/create";
import { MemoryList } from "./memory/list";
import { MemoryRead } from "./memory/read";
import { MemoryUpdate } from "./memory/update";
import { MemoryDelete } from "./memory/delete";

// Comms endpoints
import { CommsSend } from "./comms/send";
import { CommsList } from "./comms/list";
import { CommsRead } from "./comms/read";

// Session endpoints
import { SessionCreate } from "./sessions/create";
import { SessionRead } from "./sessions/read";
import { SessionUpdate } from "./sessions/update";
import { SessionHeartbeat } from "./sessions/heartbeat";

// Relay endpoints
import { RelayProxy } from "./relay/proxy";
import {
  RegistryList,
  RegistryCreate,
  RegistryRead,
  RegistryUpdate,
  RegistryDelete,
} from "./relay/registry";

export const claudeRouter = fromHono(new Hono());

// ============ MEMORY ============
claudeRouter.post("/memory", MemoryCreate);
claudeRouter.get("/memory", MemoryList);
claudeRouter.get("/memory/:id", MemoryRead);
claudeRouter.put("/memory/:id", MemoryUpdate);
claudeRouter.delete("/memory/:id", MemoryDelete);

// ============ COMMS ============
claudeRouter.post("/comms/send", CommsSend);
claudeRouter.get("/comms", CommsList);
claudeRouter.get("/comms/:id", CommsRead);

// ============ SESSIONS ============
claudeRouter.post("/sessions", SessionCreate);
claudeRouter.get("/sessions/:sessionId", SessionRead);
claudeRouter.put("/sessions/:sessionId", SessionUpdate);
claudeRouter.post("/sessions/:sessionId/heartbeat", SessionHeartbeat);

// ============ WORKER REGISTRY ============
claudeRouter.get("/registry", RegistryList);
claudeRouter.post("/registry", RegistryCreate);
claudeRouter.get("/registry/:id", RegistryRead);
claudeRouter.put("/registry/:id", RegistryUpdate);
claudeRouter.delete("/registry/:id", RegistryDelete);

// ============ RELAY PROXY ============
// This catches all methods for /relay/:workerName/*
claudeRouter.all("/relay/:workerName/*", RelayProxy);
claudeRouter.all("/relay/:workerName", RelayProxy);
