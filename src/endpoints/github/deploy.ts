import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import { forkRepo, getRepo } from "../../github/client";

// POST /github/deploy — Fork a discovered repo into your account
export class GitHubDeploy extends OpenAPIRoute {
  public schema = {
    tags: ["GitHub Deploy"],
    summary: "Fork a repo into your account — one-click deploy from the vending machine",
    operationId: "github-deploy",
    request: {
      body: contentJson(
        z.object({
          owner: z.string().describe("Owner of the source repo, e.g. 'honojs'"),
          repo: z.string().describe("Repo name, e.g. 'hono'"),
        }),
      ),
    },
    responses: {
      "200": {
        description: "Fork result",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const token = (c.env as unknown as { GITHUB_TOKEN: string }).GITHUB_TOKEN;
    if (!token) return c.json({ success: false, error: "GITHUB_TOKEN not set" }, 500);

    const data = await this.getValidatedData<typeof this.schema>();

    // First verify the source repo exists
    const check = await getRepo(token, data.body.owner, data.body.repo);
    if (!check.ok) {
      return c.json(
        { success: false, error: `Repo ${data.body.owner}/${data.body.repo} not found`, detail: check.data },
        404,
      );
    }

    // Fork it
    const res = await forkRepo(token, data.body.owner, data.body.repo);
    if (!res.ok) {
      return c.json({ success: false, error: res.data }, res.status as any);
    }

    // Log to D1 activity table
    try {
      const env = c.env as unknown as { DB: D1Database };
      await env.DB.prepare(
        "INSERT INTO activity_log (action, detail, created_at) VALUES (?, ?, datetime('now'))",
      )
        .bind("repo_deployed", `Forked ${data.body.owner}/${data.body.repo} into your account`)
        .run();
    } catch {
      // activity log table may not exist yet — non-fatal
    }

    return {
      success: true,
      result: {
        message: `Forked ${data.body.owner}/${data.body.repo} into your account`,
        fork: res.data,
      },
    };
  }
}
