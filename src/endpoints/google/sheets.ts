import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import { sheets } from "../../google/client";

// GET /google/sheets/:spreadsheetId — Get spreadsheet metadata or range values
export class SheetsGet extends OpenAPIRoute {
  public schema = {
    tags: ["Google Sheets"],
    summary: "Get spreadsheet data or cell values",
    operationId: "google-sheets-get",
    request: {
      params: z.object({
        spreadsheetId: z.string().describe("The Google Spreadsheet ID"),
      }),
      query: z.object({
        range: z
          .string()
          .optional()
          .describe("A1 range notation, e.g. Sheet1!A1:D10"),
      }),
    },
    responses: {
      "200": {
        description: "Spreadsheet data",
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

    const res = await sheets.get(
      saJson,
      data.params.spreadsheetId,
      data.query.range,
    );

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: res.data };
  }
}

// PUT /google/sheets/:spreadsheetId — Update cell values in a range
export class SheetsUpdate extends OpenAPIRoute {
  public schema = {
    tags: ["Google Sheets"],
    summary: "Update cell values in a spreadsheet range",
    operationId: "google-sheets-update",
    request: {
      params: z.object({
        spreadsheetId: z.string().describe("The Google Spreadsheet ID"),
      }),
      body: contentJson(
        z.object({
          range: z.string().describe("A1 range notation, e.g. Sheet1!A1:D10"),
          values: z
            .array(z.array(z.any()))
            .describe("2D array of cell values"),
        }),
      ),
    },
    responses: {
      "200": {
        description: "Update result",
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

    const res = await sheets.update(
      saJson,
      data.params.spreadsheetId,
      data.body.range,
      data.body.values,
    );

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: res.data };
  }
}

// POST /google/sheets/:spreadsheetId/append — Append rows to a sheet
export class SheetsAppend extends OpenAPIRoute {
  public schema = {
    tags: ["Google Sheets"],
    summary: "Append rows to a spreadsheet",
    operationId: "google-sheets-append",
    request: {
      params: z.object({
        spreadsheetId: z.string().describe("The Google Spreadsheet ID"),
      }),
      body: contentJson(
        z.object({
          range: z.string().describe("A1 range notation, e.g. Sheet1!A:D"),
          values: z
            .array(z.array(z.any()))
            .describe("2D array of row values to append"),
        }),
      ),
    },
    responses: {
      "200": {
        description: "Append result",
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

    const res = await sheets.append(
      saJson,
      data.params.spreadsheetId,
      data.body.range,
      data.body.values,
    );

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: res.data };
  }
}

// POST /google/sheets — Create a new spreadsheet
export class SheetsCreate extends OpenAPIRoute {
  public schema = {
    tags: ["Google Sheets"],
    summary: "Create a new Google Spreadsheet",
    operationId: "google-sheets-create",
    request: {
      body: contentJson(
        z.object({
          title: z.string().describe("Title for the new spreadsheet"),
        }),
      ),
    },
    responses: {
      "200": {
        description: "Created spreadsheet",
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

    const res = await sheets.create(saJson, data.body.title);

    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    return { success: true, result: res.data };
  }
}
