import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";
import { pushToMem } from "../../lib/mem";

export class MemNote extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Mem"],
    summary: "Push a note to Mem.ai knowledge base",
    description:
      "Creates a note in Ken's Mem.ai account. Use this to persist " +
      "anything that should survive across sessions — decisions, " +
      "progress updates, discoveries, action items.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              content: z
                .string()
                .describe("Markdown content for the Mem note"),
              agent_id: z
                .string()
                .optional()
                .describe("Which agent is writing this note"),
              tags: z
                .array(z.string())
                .optional()
                .describe("Tags to append as hashtags"),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Note created in Mem",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              mem_id: z.string().nullable(),
            }),
          },
        },
      },
      "501": {
        description: "Mem API key not configured",
        content: {
          "application/json": {
            schema: z.object({ success: Bool(), error: z.string() }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const memKey = (c.env as Record<string, unknown>).MEM_API_KEY as
      | string
      | undefined;

    if (!memKey) {
      return c.json(
        { success: false, error: "MEM_API_KEY not configured" },
        501,
      );
    }

    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body;

    let content = body.content;
    if (body.agent_id) {
      content = `**Agent**: ${body.agent_id}\n**Timestamp**: ${new Date().toISOString()}\n\n${content}`;
    }
    if (body.tags && body.tags.length > 0) {
      content += `\n\n${body.tags.map((t) => `#${t}`).join(" ")}`;
    }

    const result = await pushToMem(memKey, content);

    if (!result.success) {
      return c.json({ success: false, error: result.error }, 502);
    }

    return { success: true, mem_id: result.id ?? null };
  }
}
