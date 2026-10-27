import { Hono } from "hono";
import { fromHono } from "chanfana";
import { MemNote } from "./memNote";

export const memRouter = fromHono(new Hono());

memRouter.post("/note", MemNote);
