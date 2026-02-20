import { Hono } from "hono";
import { fromHono } from "chanfana";
import { StateList } from "./stateList";
import { StateGet } from "./stateGet";
import { StateUpdate } from "./stateUpdate";

export const stateRouter = fromHono(new Hono());

stateRouter.get("/", StateList);
stateRouter.get("/:id", StateGet);
stateRouter.post("/update", StateUpdate);
