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

// Inbox endpoints
import { InboxPush } from "./inbox/push";
import { InboxPull } from "./inbox/pull";
import { InboxPeek } from "./inbox/peek";
import { InboxBroadcast } from "./inbox/broadcast";
import { InboxSubscribe, InboxUnsubscribe, InboxListChannels } from "./inbox/subscribe";
import { BridgeCreate, BridgeList, BridgeTrigger } from "./inbox/bridge";

// Preprocessor endpoints
import { PreprocessorSubmit } from "./preprocessor/submit";
import { PreprocessorStatus, PreprocessorList, PreprocessorCancel } from "./preprocessor/status";
import { ConfigCreate, ConfigList, ConfigRead, ConfigUpdate, ConfigDelete } from "./preprocessor/config";
import { PipelineCreate, PipelineList, PipelineRun } from "./preprocessor/pipeline";
import { AutobridgeCreate, AutobridgeList, AutobridgeTrigger } from "./preprocessor/autobridge";

// Artifact endpoints (governance framework)
import { ArtifactCreate } from "./artifacts/create";
import { ArtifactRead, ArtifactList as ArtifactListEndpoint } from "./artifacts/read";
import { ArtifactPromote, ArtifactDriftCheck, ArtifactMVTRun, ArtifactFlagContamination } from "./artifacts/govern";

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
claudeRouter.all("/relay/:workerName/*", RelayProxy);
claudeRouter.all("/relay/:workerName", RelayProxy);

// ============ INBOX (Claude-to-Claude relay) ============
claudeRouter.post("/inbox/push", InboxPush);
claudeRouter.get("/inbox/pull", InboxPull);
claudeRouter.get("/inbox/peek", InboxPeek);
claudeRouter.post("/inbox/broadcast", InboxBroadcast);
claudeRouter.post("/inbox/subscribe", InboxSubscribe);
claudeRouter.post("/inbox/unsubscribe", InboxUnsubscribe);
claudeRouter.get("/inbox/channels", InboxListChannels);

// ============ BUCKET BRIDGES (the scooch) ============
claudeRouter.post("/bridge", BridgeCreate);
claudeRouter.get("/bridge", BridgeList);
claudeRouter.post("/bridge/:name/trigger", BridgeTrigger);

// ============ PREPROCESSOR (Gemma bridge) ============
claudeRouter.post("/preprocessor/submit", PreprocessorSubmit);
claudeRouter.get("/preprocessor/jobs", PreprocessorList);
claudeRouter.get("/preprocessor/status/:jobId", PreprocessorStatus);
claudeRouter.post("/preprocessor/cancel/:jobId", PreprocessorCancel);
claudeRouter.post("/preprocessor/config", ConfigCreate);
claudeRouter.get("/preprocessor/config", ConfigList);
claudeRouter.get("/preprocessor/config/:name", ConfigRead);
claudeRouter.put("/preprocessor/config/:name", ConfigUpdate);
claudeRouter.delete("/preprocessor/config/:name", ConfigDelete);
claudeRouter.post("/preprocessor/pipeline", PipelineCreate);
claudeRouter.get("/preprocessor/pipeline", PipelineList);
claudeRouter.post("/preprocessor/pipeline/:name/run", PipelineRun);
claudeRouter.post("/preprocessor/autobridge", AutobridgeCreate);
claudeRouter.get("/preprocessor/autobridge", AutobridgeList);
claudeRouter.post("/preprocessor/autobridge/:name/trigger", AutobridgeTrigger);

// ============ ARTIFACTS (governance framework) ============
claudeRouter.post("/artifacts", ArtifactCreate);
claudeRouter.get("/artifacts", ArtifactListEndpoint);
claudeRouter.get("/artifacts/:artifactId", ArtifactRead);
claudeRouter.post("/artifacts/:artifactId/promote", ArtifactPromote);
claudeRouter.post("/artifacts/:artifactId/drift-check", ArtifactDriftCheck);
claudeRouter.post("/artifacts/:artifactId/mvt", ArtifactMVTRun);
claudeRouter.post("/artifacts/:artifactId/flag", ArtifactFlagContamination);
