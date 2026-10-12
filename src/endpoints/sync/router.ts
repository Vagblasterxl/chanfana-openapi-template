import { Hono } from "hono";
import { fromHono } from "chanfana";
import { SyncSnapshotPush, SyncSnapshotPull } from "./syncSnapshot";

export const syncRouter = fromHono(new Hono());

syncRouter.post("/snapshot", SyncSnapshotPush);
syncRouter.get("/snapshot", SyncSnapshotPull);
