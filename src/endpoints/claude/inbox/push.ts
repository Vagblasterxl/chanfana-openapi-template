import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

const pushSchema = z.object({
  channel: z.string().default("general"),
  from_agent: z.string().min(1),
  to_agent: z.string().optional(),          // omit for broadcast
  message_type: z.enum(["text", "ocr", "compressed", "json", "command"]).default("text"),
  content: z.string().min(1),
  priority: z.number().int().default(0),
  expires_in_minutes: z.number().int().optional(),  // auto-expire
  metadata: z.record(z.unknown()).optional(),
});

export class InboxPush extends OpenAPIRoute {
  schema = {
    summary: "Push message to inbox",
    description: "Send a message to the inbox queue. Omit to_agent for broadcast to all listeners on channel.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: pushSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Message queued",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              message_id: z.number(),
              channel: z.string(),
              broadcast: z.boolean(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = pushSchema.parse(body);
    const db = c.env.DB;

    const now = new Date();
    const expiresAt = data.expires_in_minutes
      ? new Date(now.getTime() + data.expires_in_minutes * 60000).toISOString()
      : null;

    const result = await db
      .prepare(`
        INSERT INTO inbox (channel, from_agent, to_agent, message_type, content, priority, expires_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        data.channel,
        data.from_agent,
        data.to_agent || null,
        data.message_type,
        data.content,
        data.priority,
        expiresAt,
        data.metadata ? JSON.stringify(data.metadata) : null
      )
      .run();

    return c.json({
      success: true,
      message_id: result.meta.last_row_id,
      channel: data.channel,
      broadcast: !data.to_agent,
    });
  }
}
