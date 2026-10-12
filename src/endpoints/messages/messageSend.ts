import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";
import { pushToMem, formatMessageAsMemNote } from "../../lib/mem";

export class MessageSend extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Messages"],
    summary: "Send a message between agents",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              sender: z.string().describe("Sending agent ID"),
              recipient: z.string().describe("Receiving agent ID"),
              message_type: z.string().describe("Message type: text, command, event, etc."),
              payload: z.string().describe("Message payload (JSON string)"),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Message sent",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              message_id: z.string(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body;
    const db = c.env.DB;
    const now = new Date().toISOString();
    const id = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await db
      .prepare(
        `INSERT INTO messages (id, sender, recipient, message_type, payload, created_at, status)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending')`,
      )
      .bind(id, body.sender, body.recipient, body.message_type, body.payload, now)
      .run();

    const memKey = (c.env as Record<string, unknown>).MEM_API_KEY as string | undefined;
    if (memKey) {
      c.executionCtx.waitUntil(
        pushToMem(memKey, formatMessageAsMemNote(body.sender, body.recipient, body.message_type, body.payload)),
      );
    }

    return { success: true, message_id: id };
  }
}
