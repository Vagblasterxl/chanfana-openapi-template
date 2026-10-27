import { Hono } from "hono";
import { fromHono } from "chanfana";
import { AgentList } from "./agentList";
import { AgentRegister } from "./agentRegister";
import { AgentRead } from "./agentRead";
import { AgentHeartbeat } from "./agentHeartbeat";
import { AgentDelete } from "./agentDelete";

export const agentsRouter = fromHono(new Hono());

agentsRouter.get("/", AgentList);
agentsRouter.post("/register", AgentRegister);
agentsRouter.get("/:id", AgentRead);
agentsRouter.post("/:id/heartbeat", AgentHeartbeat);
agentsRouter.delete("/:id", AgentDelete);
