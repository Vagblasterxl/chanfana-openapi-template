import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import { drive } from "../../google/client";

// GET /google/drive — List files in Google Drive
export class DriveList extends OpenAPIRoute {
  public schema = {
    tags: ["Google Drive"],
    summary: "List files in Google Drive",
    operationId: "google-drive-list",
    request: {
      query: z.object({
        q: z
          .string()
          .optional()
          .describe("Drive search query, e.g. name contains 'report'"),
        pageSize: z
          .string()
          .optional()
          .describe("Max results per page (default 100)"),
        pageToken: z
          .string()
          .optional()
          .describe("Token for the next page of results"),
        orderBy: z
          .string()
          .optional()
          .describe("Sort order, e.g. modifiedTime desc"),
      }),
    },
    responses: {
      "200": {
        description: "List of files",
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
    if (data.query.pageSize) query.pageSize = data.query.pageSize;
    if (data.query.pageToken) query.pageToken = data.query.pageToken;
    if (data.query.orderBy) query.orderBy = data.query.orderBy;

    const res = await drive.list(saJson, Object.keys(query).length ? query : undefined);

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: res.data };
  }
}

// GET /google/drive/:fileId — Get file metadata
export class DriveGet extends OpenAPIRoute {
  public schema = {
    tags: ["Google Drive"],
    summary: "Get file metadata from Google Drive",
    operationId: "google-drive-get",
    request: {
      params: z.object({
        fileId: z.string().describe("The Google Drive file ID"),
      }),
    },
    responses: {
      "200": {
        description: "File metadata",
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

    const res = await drive.get(saJson, data.params.fileId);

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: res.data };
  }
}

// DELETE /google/drive/:fileId — Delete a file from Google Drive
export class DriveDelete extends OpenAPIRoute {
  public schema = {
    tags: ["Google Drive"],
    summary: "Delete a file from Google Drive",
    operationId: "google-drive-delete",
    request: {
      params: z.object({
        fileId: z.string().describe("The Google Drive file ID"),
      }),
    },
    responses: {
      "200": {
        description: "Deletion result",
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

    const res = await drive.delete(saJson, data.params.fileId);

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: { message: "File deleted" } };
  }
}
