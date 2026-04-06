import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";
import {
  createReceiverSchema,
  generateWebhookPath,
  verifySlackSignature,
  verifyPolarSignature,
  extractSlackPayload,
  extractDiscordPayload,
  extractPolarPayload,
} from "./base";

export class ReceiverCreate extends OpenAPIRoute {
  schema = {
    summary: "Create a webhook receiver",
    description: "Register a new webhook endpoint for a platform (Discord, Slack, Polar, etc.)",
    request: {
      body: {
        content: {
          "application/json": { schema: createReceiverSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Receiver created",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              name: z.string(),
              endpoint: z.string(),
              full_url: z.string(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = createReceiverSchema.parse(body);
    const db = c.env.DB;

    const endpointPath = generateWebhookPath(data.platform);

    await db
      .prepare(`
        INSERT INTO webhook_receivers
        (name, platform, endpoint_path, secret, route_to, route_channel, route_config, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        data.name,
        data.platform,
        endpointPath,
        data.secret || null,
        data.route_to,
        data.route_channel || null,
        data.route_config ? JSON.stringify(data.route_config) : null,
        data.metadata ? JSON.stringify(data.metadata) : null,
        new Date().toISOString()
      )
      .run();

    // Get the worker URL (would need to be configured)
    const baseUrl = "https://chanfana-openapi-template.YOUR-SUBDOMAIN.workers.dev";

    return c.json({
      success: true,
      name: data.name,
      endpoint: endpointPath,
      full_url: `${baseUrl}${endpointPath}`,
    });
  }
}

export class ReceiverList extends OpenAPIRoute {
  schema = {
    summary: "List webhook receivers",
    responses: { 200: { description: "Receivers list" } },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const receivers = await db
      .prepare("SELECT id, name, platform, endpoint_path, route_to, route_channel, active, total_received, last_received_at FROM webhook_receivers ORDER BY name")
      .all();

    return c.json({
      success: true,
      receivers: receivers.results || [],
    });
  }
}

export class WebhookHandler extends OpenAPIRoute {
  schema = {
    summary: "Handle incoming webhook",
    description: "Universal webhook handler - routes based on path",
    request: {
      params: z.object({
        platform: z.string(),
        id: z.string(),
      }),
    },
    responses: {
      200: { description: "Webhook processed" },
      404: { description: "Receiver not found" },
    },
  };

  async handle(c: AppContext) {
    const platform = c.req.param("platform");
    const id = c.req.param("id");
    const endpointPath = `/hooks/${platform}/${id}`;
    const db = c.env.DB;
    const now = new Date().toISOString();

    // Find receiver
    const receiver = await db
      .prepare("SELECT * FROM webhook_receivers WHERE endpoint_path = ? AND active = 1")
      .bind(endpointPath)
      .first();

    if (!receiver) {
      return c.json({ success: false, error: "Receiver not found" }, 404);
    }

    // Get raw body for signature verification
    const rawBody = await c.req.text();
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = { raw: rawBody };
    }

    // Verify signature if secret is configured
    let signatureValid = true;
    if (receiver.secret) {
      const secret = receiver.secret as string;
      if (platform === "slack") {
        const timestamp = c.req.header("x-slack-request-timestamp") || "";
        const signature = c.req.header("x-slack-signature") || "";
        signatureValid = await verifySlackSignature(rawBody, timestamp, signature, secret);
      } else if (platform === "polar") {
        const signature = c.req.header("x-polar-signature") || "";
        signatureValid = await verifyPolarSignature(rawBody, signature, secret);
      }
      // Add more platforms as needed
    }

    // Extract event type based on platform
    let eventType = "unknown";
    let extractedData: Record<string, unknown> = {};

    if (platform === "slack") {
      // Handle Slack URL verification challenge
      if (payload.type === "url_verification") {
        return c.json({ challenge: payload.challenge });
      }
      const extracted = extractSlackPayload(payload);
      eventType = extracted.type;
      extractedData = extracted;
    } else if (platform === "discord") {
      // Handle Discord PING
      if (payload.type === 1) {
        return c.json({ type: 1 });
      }
      const extracted = extractDiscordPayload(payload);
      eventType = extracted.type;
      extractedData = extracted;
    } else if (platform === "polar") {
      const extracted = extractPolarPayload(payload);
      eventType = extracted.type;
      extractedData = extracted;
    } else {
      eventType = (payload.type as string) || (payload.event as string) || "generic";
      extractedData = payload;
    }

    // Log the webhook
    const logResult = await db
      .prepare(`
        INSERT INTO webhook_log
        (receiver_id, receiver_name, platform, event_type, payload, signature_valid, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        receiver.id,
        receiver.name,
        platform,
        eventType,
        JSON.stringify(payload),
        signatureValid ? 1 : 0,
        now
      )
      .run();

    // Route based on configuration
    const routeTo = receiver.route_to as string;
    let routedId: string | number | null = null;

    if (routeTo === "inbox") {
      const channel = (receiver.route_channel as string) || "integrations";
      const result = await db
        .prepare(`
          INSERT INTO inbox (channel, from_agent, message_type, content, metadata, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .bind(
          channel,
          `${platform}-webhook`,
          eventType,
          JSON.stringify(extractedData),
          JSON.stringify({ webhook_log_id: logResult.meta.last_row_id, platform, receiver: receiver.name }),
          now
        )
        .run();
      routedId = result.meta.last_row_id as number;
    } else if (routeTo === "debate" && eventType === "message") {
      // Could auto-create debates from messages - implement as needed
      routedId = null;
    }

    // Update log with routing info
    await db
      .prepare("UPDATE webhook_log SET routed_to = ?, routed_id = ? WHERE id = ?")
      .bind(routeTo, routedId?.toString() || null, logResult.meta.last_row_id)
      .run();

    // Update receiver stats
    await db
      .prepare("UPDATE webhook_receivers SET total_received = total_received + 1, last_received_at = ? WHERE id = ?")
      .bind(now, receiver.id)
      .run();

    return c.json({
      success: true,
      event_type: eventType,
      signature_valid: signatureValid,
      routed_to: routeTo,
      routed_id: routedId,
    });
  }
}
