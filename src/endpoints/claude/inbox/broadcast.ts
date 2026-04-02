import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

const broadcastSchema = z.object({
  from_agent: z.string().min(1),
  content: z.string().min(1),
  channels: z.array(z.string()).default(["general"]),
  message_type: z.enum(["text", "ocr", "compressed", "json", "command"]).default("text"),
  priority: z.number().int().default(0),
  notify_webhooks: z.boolean().default(true),  // trigger subscribed webhooks
});

export class InboxBroadcast extends OpenAPIRoute {
  schema = {
    summary: "Broadcast to multiple channels",
    description: "Send same message to multiple channels at once. Optionally triggers webhooks for subscribed agents.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: broadcastSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Broadcast sent",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              message_ids: z.array(z.number()),
              channels: z.array(z.string()),
              webhooks_triggered: z.number(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = broadcastSchema.parse(body);
    const db = c.env.DB;

    const messageIds: number[] = [];

    // Insert message into each channel
    for (const channel of data.channels) {
      const result = await db
        .prepare(`
          INSERT INTO inbox (channel, from_agent, to_agent, message_type, content, priority)
          VALUES (?, ?, NULL, ?, ?, ?)
        `)
        .bind(channel, data.from_agent, data.message_type, data.content, data.priority)
        .run();
      messageIds.push(result.meta.last_row_id as number);
    }

    // Trigger webhooks if requested
    let webhooksTriggered = 0;
    if (data.notify_webhooks) {
      const subs = await db
        .prepare(`
          SELECT DISTINCT webhook_url FROM subscriptions
          WHERE channel IN (${data.channels.map(() => "?").join(",")})
          AND webhook_url IS NOT NULL
        `)
        .bind(...data.channels)
        .all();

      // Fire webhooks (don't await - fire and forget)
      for (const sub of (subs.results || []) as { webhook_url: string }[]) {
        try {
          fetch(sub.webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "broadcast",
              from_agent: data.from_agent,
              channels: data.channels,
              content: data.content,
              message_type: data.message_type,
            }),
          }).catch(() => {}); // Ignore failures
          webhooksTriggered++;
        } catch {
          // Ignore webhook failures
        }
      }
    }

    return c.json({
      success: true,
      message_ids: messageIds,
      channels: data.channels,
      webhooks_triggered: webhooksTriggered,
    });
  }
}
