import { fromHono } from "chanfana";
import { Hono } from "hono";
import { DiscordCommandManifest } from "./commandManifest";
import { DiscordInteractions } from "./interactions";

export const discordRouter = fromHono(new Hono());

discordRouter.post("/interactions", DiscordInteractions);
discordRouter.get("/commands", DiscordCommandManifest);
