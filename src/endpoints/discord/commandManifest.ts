import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import { commandManifest } from "../../discord/registration";

export class DiscordCommandManifest extends OpenAPIRoute {
  public schema = {
    tags: ["Discord"],
    summary: "Slash command definitions for registration",
    description:
      "The `/omega` command tree in Discord's application-command shape, for " +
      "PUT /applications/{application.id}/commands. Served from the same " +
      "definition the dispatcher implements, so the registered surface cannot " +
      "drift from the handled one. Contains no secrets.",
    operationId: "discord-command-manifest",
    responses: {
      "200": {
        description: "Command definitions, ready to bulk-overwrite",
        ...contentJson(z.array(z.record(z.unknown()))),
      },
    },
  };

  public async handle(c: AppContext) {
    return c.json(commandManifest, 200);
  }
}
