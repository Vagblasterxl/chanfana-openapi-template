import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

const subscribeSchema = z.object({
  agent_id: z.string().min(1),
  channel: z.string().min(1),
  webhook_url: z.string().url().optional(),  // optional push notification URL
});

export class InboxSubscribe extends OpenAPIRoute {
  schema = {
    summary: "Subscribe to a channel",
    description: "Subscribe an agent to a channel. Optionally provide a webhook URL to get push notifications.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: subscribeSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Subscribed",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              agent_id: z.string(),
              channel: z.string(),
              has_webhook: z.boolean(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = subscribeSchema.parse(body);
    const db = c.env.DB;

    await db
      .prepare(`
        INSERT OR REPLACE INTO subscriptions (channel, agent_id, webhook_url, subscribed_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `)
      .bind(data.channel, data.agent_id, data.webhook_url || null)
      .run();

    return c.json({
      success: true,
      agent_id: data.agent_id,
      channel: data.channel,
      has_webhook: !!data.webhook_url,
    });
  }
}

export class InboxUnsubscribe extends OpenAPIRoute {
  schema = {
    summary: "Unsubscribe from a channel",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              agent_id: z.string().min(1),
              channel: z.string().min(1),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Unsubscribed",
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const db = c.env.DB;

    await db
      .prepare("DELETE FROM subscriptions WHERE agent_id = ? AND channel = ?")
      .bind(body.agent_id, body.channel)
      .run();

    return c.json({ success: true });
  }
}

export class InboxListChannels extends OpenAPIRoute {
  schema = {
    summary: "List available channels",
    responses: {
      200: {
        description: "Channels list",
        content: {
          "application/json": {
            schema: z.object({
              channels: z.array(z.object({
                name: z.string(),
                description: z.string().nullable(),
                subscriber_count: z.number(),
              })),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;

    const channels = await db
      .prepare(`
        SELECT c.name, c.description, COUNT(s.id) as subscriber_count
        FROM channels c
        LEFT JOIN subscriptions s ON c.name = s.channel
        GROUP BY c.name, c.description
        ORDER BY c.name
      `)
      .all();

    return c.json({
      channels: channels.results || [],
    });
  }
}
