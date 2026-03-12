import { Hono } from "hono";
import { fromHono } from "chanfana";
import {
  OracleSetup,
  OracleSend,
  OracleRead,
  OracleChannels,
  OracleLatest,
  OracleClear,
} from "./comms";

export const oracleRouter = fromHono(new Hono());

// --- Setup (run once) ---
oracleRouter.post("/setup", OracleSetup);

// --- Messaging ---
oracleRouter.post("/send", OracleSend);
oracleRouter.get("/read/:channel", OracleRead);
oracleRouter.get("/channels", OracleChannels);
oracleRouter.get("/latest", OracleLatest);
oracleRouter.delete("/channel/:channel", OracleClear);
