import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import { getAuthenticatedUser } from "../../github/client";

export class GitHubStatus extends OpenAPIRoute {
  public schema = {
    tags: ["GitHub"],
    summary: "Check GitHub connection and show authenticated user",
    operationId: "github-status",
    responses: {
      "200": {
        description: "Connection status",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const token = (c.env as unknown as { GITHUB_TOKEN: string }).GITHUB_TOKEN;
    if (!token) {
      return {
        success: true,
        result: {
          connected: false,
          message: "GITHUB_TOKEN secret not set. Run: wrangler secret put GITHUB_TOKEN",
        },
      };
    }

    try {
      const res = await getAuthenticatedUser(token);
      if (!res.ok) {
        return {
          success: true,
          result: { connected: false, message: "Token invalid or expired", error: res.data },
        };
      }
      return {
        success: true,
        result: {
          connected: true,
          user: res.data.login,
          name: res.data.name,
          public_repos: res.data.public_repos,
          avatar: res.data.avatar_url,
        },
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: true, result: { connected: false, message: msg } };
    }
  }
}
