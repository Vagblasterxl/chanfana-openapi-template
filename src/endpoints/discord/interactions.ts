import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import {
  dispatchCommand,
  parseOperatorIds,
} from "../../discord/commands";
import {
  discordInteraction,
  InteractionType,
  invokerOf,
  parseCommand,
  PONG,
  reply,
} from "../../discord/interactions";
import { claimInteraction } from "../../discord/store";
import {
  isConfigurationFailure,
  verifyDiscordInteraction,
} from "../../discord/verify";

const errorBody = z.object({
  success: z.literal(false),
  errors: z.array(z.object({ code: z.number().int(), message: z.string() })),
});

export class DiscordInteractions extends OpenAPIRoute {
  public schema = {
    tags: ["Discord"],
    summary: "Discord interactions endpoint",
    description:
      "Receives Discord slash commands, verifies the Ed25519 signature, and " +
      "relays them onto the agent message bus. Requires the " +
      "DISCORD_PUBLIC_KEY binding; without it every interaction is rejected " +
      "with 503 rather than trusted. Commands authorize against the Polar " +
      "entitlements of the customer the invoking Discord account is bound to.",
    operationId: "discord-interactions",
    request: {
      body: contentJson(
        z
          .object({
            id: z.string().openapi({ example: "1234567890" }),
            type: z.number().int().openapi({ example: 2 }),
          })
          .passthrough(),
      ),
    },
    responses: {
      "200": {
        description:
          "Interaction response — a PONG for Discord's PING, otherwise the " +
          "command's ephemeral reply.",
        ...contentJson({
          type: z.number().int(),
          data: z
            .object({ content: z.string(), flags: z.number().int().optional() })
            .optional(),
        }),
      },
      "400": {
        description: "Body is not a Discord interaction",
        ...contentJson(errorBody),
      },
      "401": {
        description: "Signature missing, stale, or invalid",
        ...contentJson(errorBody),
      },
      "503": {
        description: "DISCORD_PUBLIC_KEY is not configured on this Worker",
        ...contentJson(errorBody),
      },
    },
  };

  public async handle(c: AppContext) {
    // The signature covers the exact bytes Discord sent, so the raw body is
    // read before anything parses it.
    const rawBody = await c.req.text();
    const verification = await verifyDiscordInteraction(
      rawBody,
      c.req.raw.headers,
      c.env.DISCORD_PUBLIC_KEY,
    );

    if (!verification.ok) {
      if (isConfigurationFailure(verification.reason)) {
        console.error(
          `Discord interaction rejected: ${verification.reason}. ` +
            "Interactions cannot be authenticated and are being refused.",
        );
        return c.json(
          {
            success: false,
            errors: [
              {
                code: 7503,
                message:
                  "Interaction verification is not configured; request refused.",
              },
            ],
          },
          503,
        );
      }

      // Discord's endpoint registration deliberately sends a mis-signed probe
      // and only accepts the URL if this is a 401.
      console.warn(`Discord interaction rejected: ${verification.reason}`);
      return c.json(
        {
          success: false,
          errors: [
            { code: 7401, message: `Invalid signature: ${verification.reason}` },
          ],
        },
        401,
      );
    }

    const parsed = discordInteraction.safeParse(safeJsonParse(rawBody));
    if (!parsed.success) {
      return c.json(
        {
          success: false,
          errors: [{ code: 7400, message: "Malformed Discord interaction" }],
        },
        400,
      );
    }
    const interaction = parsed.data;

    // Discord verifies a newly registered endpoint by PINGing it, and keeps
    // doing so to check liveness.
    if (interaction.type === InteractionType.PING) {
      return c.json(PONG, 200);
    }

    if (interaction.type !== InteractionType.APPLICATION_COMMAND) {
      return c.json(
        reply(
          "This endpoint handles slash commands only; it registers no " +
            "components, modals, or autocomplete.",
        ),
        200,
      );
    }

    const command = parseCommand(interaction);
    const invoker = invokerOf(interaction);
    if (!command || !invoker) {
      return c.json(
        reply("Could not read the command or who sent it."),
        200,
      );
    }

    // Discord retries an interaction whose response it did not get inside three
    // seconds. Claiming the id first means a lost reply cannot turn one
    // `/omega send` into two bus rows.
    const now = new Date().toISOString();
    const first = await claimInteraction(
      c.env.DB,
      interaction.id,
      command.name,
      invoker.id,
      now,
    );
    if (!first) {
      return c.json(
        reply(
          `\`/${command.name.replace(/\./g, " ")}\` already ran — this is a ` +
            "retry of an interaction whose reply was lost, so it was not " +
            "applied twice.",
        ),
        200,
      );
    }

    const response = await dispatchCommand(command, {
      db: c.env.DB,
      invoker,
      guildId: interaction.guild_id ?? null,
      channelId: interaction.channel_id ?? null,
      interactionId: interaction.id,
      operatorIds: parseOperatorIds(c.env.DISCORD_OPERATOR_IDS),
      now,
    });

    return c.json(response, 200);
  }
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
