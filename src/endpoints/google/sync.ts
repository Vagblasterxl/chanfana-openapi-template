import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import { sheets } from "../../google/client";

interface SyncEnv {
  DB: D1Database;
  GOOGLE_SERVICE_ACCOUNT: string;
}

// POST /google/sync/d1-to-sheet — Export any D1 table into a Google Sheet
export class SyncD1ToSheet extends OpenAPIRoute {
  public schema = {
    tags: ["Sync"],
    summary: "Export a D1 table to a Google Sheet — see your data instantly",
    operationId: "google-sync-d1-to-sheet",
    request: {
      body: contentJson(
        z.object({
          table: z
            .string()
            .describe("D1 table name to export, e.g. 'tasks' or 'activity_log'"),
          spreadsheetId: z
            .string()
            .optional()
            .describe("Existing Spreadsheet ID. If omitted, a new sheet is created."),
          sheetName: z
            .string()
            .optional()
            .describe("Tab name (default: table name)"),
        }),
      ),
    },
    responses: {
      "200": {
        description: "Sync result",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const env = c.env as unknown as SyncEnv;
    if (!env.GOOGLE_SERVICE_ACCOUNT) {
      return c.json({ success: false, error: "GOOGLE_SERVICE_ACCOUNT not set" }, 500);
    }

    const data = await this.getValidatedData<typeof this.schema>();
    const table = data.body.table.replace(/[^a-zA-Z0-9_]/g, "");
    const sheetName = data.body.sheetName || table;

    // 1. Read all rows from D1
    let rows: Record<string, unknown>[];
    try {
      const result = await env.DB.prepare(`SELECT * FROM \`${table}\``).all();
      rows = result.results as Record<string, unknown>[];
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return c.json({ success: false, error: `D1 query failed: ${msg}` }, 400);
    }

    if (rows.length === 0) {
      return { success: true, result: { message: "Table is empty, nothing to sync", rows: 0 } };
    }

    // 2. Build the 2D values array: header row + data rows
    const columns = Object.keys(rows[0]);
    const values: unknown[][] = [
      columns,
      ...rows.map((row) => columns.map((col) => row[col] ?? "")),
    ];

    // 3. Create or use existing spreadsheet
    let spreadsheetId = data.body.spreadsheetId;
    if (!spreadsheetId) {
      const createRes = await sheets.create(
        env.GOOGLE_SERVICE_ACCOUNT,
        `D1 Export: ${table} — ${new Date().toISOString().slice(0, 10)}`,
      );
      if (!createRes.ok) {
        return c.json({ success: false, error: createRes.data }, createRes.status as any);
      }
      spreadsheetId = (createRes.data as { spreadsheetId: string }).spreadsheetId;
    }

    // 4. Write data to the sheet
    const range = `${sheetName}!A1`;
    const updateRes = await sheets.update(
      env.GOOGLE_SERVICE_ACCOUNT,
      spreadsheetId!,
      range,
      values,
    );

    if (!updateRes.ok) {
      return c.json({ success: false, error: updateRes.data }, updateRes.status as any);
    }

    return {
      success: true,
      result: {
        message: `Exported ${rows.length} rows from "${table}" to Google Sheets`,
        spreadsheetId,
        spreadsheetUrl: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        rows: rows.length,
        columns: columns.length,
      },
    };
  }
}
