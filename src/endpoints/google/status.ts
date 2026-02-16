import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import { getAccessToken, parseServiceAccountEmail, GOOGLE_SCOPES } from "../../google/auth";

// GET /google/status — Verify Google Service Account connection
export class GoogleStatus extends OpenAPIRoute {
  public schema = {
    tags: ["Google Status"],
    summary: "Check Google Service Account connectivity",
    operationId: "google-status",
    responses: {
      "200": {
        description: "Connection status",
        ...contentJson(
          z.object({
            success: z.boolean(),
            result: z.object({
              connected: z.boolean(),
              service_account: z.string(),
              scopes: z.array(z.string()),
              message: z.string(),
            }),
          }),
        ),
      },
    },
  };

  async handle(c: AppContext) {
    const saJson = (c.env as unknown as { GOOGLE_SERVICE_ACCOUNT: string })
      .GOOGLE_SERVICE_ACCOUNT;

    if (!saJson) {
      return {
        success: true,
        result: {
          connected: false,
          service_account: "",
          scopes: [],
          message:
            "GOOGLE_SERVICE_ACCOUNT secret not set. Run: wrangler secret put GOOGLE_SERVICE_ACCOUNT",
        },
      };
    }

    try {
      const email = parseServiceAccountEmail(saJson);
      // Try to actually get a token — this proves the key is valid
      await getAccessToken(saJson, GOOGLE_SCOPES);

      return {
        success: true,
        result: {
          connected: true,
          service_account: email,
          scopes: GOOGLE_SCOPES,
          message: "Authenticated successfully with Google",
        },
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: true,
        result: {
          connected: false,
          service_account: "",
          scopes: [],
          message: `Authentication failed: ${message}`,
        },
      };
    }
  }
}
