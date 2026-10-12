import { Hono } from "hono";
import { fromHono } from "chanfana";
import { MessageList } from "./messageList";
import { MessageSend } from "./messageSend";
import { MessageReceive } from "./messageReceive";

export const messagesRouter = fromHono(new Hono());

messagesRouter.get("/", MessageList);
messagesRouter.post("/send", MessageSend);
messagesRouter.get("/receive/:agent_id", MessageReceive);
