import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import { gmail } from "../../google/client";

// GET /google/gmail/messages — List Gmail messages
export class GmailListMessages extends OpenAPIRoute {
  public schema = {
    tags: ["Google Gmail"],
    summary: "List Gmail messages",
    operationId: "google-gmail-list-messages",
    request: {
      query: z.object({
        q: z
          .string()
          .optional()
          .describe("Gmail search query, e.g. from:user@example.com"),
        maxResults: z
          .string()
          .optional()
          .describe("Maximum number of messages to return"),
        pageToken: z
          .string()
          .optional()
          .describe("Token for the next page of results"),
        labelIds: z
          .string()
          .optional()
          .describe("Comma-separated label IDs to filter by"),
      }),
    },
    responses: {
      "200": {
        description: "List of message IDs",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const saJson = (c.env as unknown as { GOOGLE_SERVICE_ACCOUNT: string }).GOOGLE_SERVICE_ACCOUNT;
    if (!saJson) {
      return c.json(
        { success: false, error: "GOOGLE_SERVICE_ACCOUNT secret not configured" },
        500,
      );
    }

    const query: Record<string, string> = {};
    if (data.query.q) query.q = data.query.q;
    if (data.query.maxResults) query.maxResults = data.query.maxResults;
    if (data.query.pageToken) query.pageToken = data.query.pageToken;
    if (data.query.labelIds) query.labelIds = data.query.labelIds;

    const res = await gmail.listMessages(
      saJson,
      Object.keys(query).length ? query : undefined,
    );

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: res.data };
  }
}

// GET /google/gmail/messages/:messageId — Get a single message
export class GmailGetMessage extends OpenAPIRoute {
  public schema = {
    tags: ["Google Gmail"],
    summary: "Get a Gmail message by ID",
    operationId: "google-gmail-get-message",
    request: {
      params: z.object({
        messageId: z.string().describe("The Gmail message ID"),
      }),
      query: z.object({
        format: z
          .enum(["minimal", "full", "raw", "metadata"])
          .optional()
          .describe("Response format (default: full)"),
      }),
    },
    responses: {
      "200": {
        description: "Gmail message",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const saJson = (c.env as unknown as { GOOGLE_SERVICE_ACCOUNT: string }).GOOGLE_SERVICE_ACCOUNT;
    if (!saJson) {
      return c.json(
        { success: false, error: "GOOGLE_SERVICE_ACCOUNT secret not configured" },
        500,
      );
    }

    const res = await gmail.getMessage(
      saJson,
      data.params.messageId,
      data.query.format || "full",
    );

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: res.data };
  }
}

// POST /google/gmail/messages/send — Send an email
export class GmailSendMessage extends OpenAPIRoute {
  public schema = {
    tags: ["Google Gmail"],
    summary: "Send an email via Gmail",
    operationId: "google-gmail-send",
    request: {
      body: contentJson(
        z.object({
          to: z.string().describe("Recipient email address"),
          subject: z.string().describe("Email subject"),
          body: z.string().describe("Email body (plain text)"),
          cc: z.string().optional().describe("CC email address"),
          bcc: z.string().optional().describe("BCC email address"),
        }),
      ),
    },
    responses: {
      "200": {
        description: "Send result",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const saJson = (c.env as unknown as { GOOGLE_SERVICE_ACCOUNT: string }).GOOGLE_SERVICE_ACCOUNT;
    if (!saJson) {
      return c.json(
        { success: false, error: "GOOGLE_SERVICE_ACCOUNT secret not configured" },
        500,
      );
    }

    // Build RFC 2822 email message
    const lines: string[] = [];
    lines.push(`To: ${data.body.to}`);
    if (data.body.cc) lines.push(`Cc: ${data.body.cc}`);
    if (data.body.bcc) lines.push(`Bcc: ${data.body.bcc}`);
    lines.push(`Subject: ${data.body.subject}`);
    lines.push("Content-Type: text/plain; charset=utf-8");
    lines.push("");
    lines.push(data.body.body);

    const rawMessage = lines.join("\r\n");
    // Base64url encode the message
    const encoded = btoa(unescape(encodeURIComponent(rawMessage)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const res = await gmail.send(saJson, encoded);

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: res.data };
  }
}
