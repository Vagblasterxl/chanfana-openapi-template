import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import { listRepos, getRepo, createRepo } from "../../github/client";

// GET /github/repos — List your repos
export class GitHubListRepos extends OpenAPIRoute {
  public schema = {
    tags: ["GitHub"],
    summary: "List your GitHub repositories",
    operationId: "github-list-repos",
    request: {
      query: z.object({
        sort: z.enum(["updated", "created", "pushed", "full_name"]).optional(),
        per_page: z.string().optional().describe("Results per page (max 100)"),
        page: z.string().optional(),
      }),
    },
    responses: {
      "200": {
        description: "List of repos",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const token = (c.env as unknown as { GITHUB_TOKEN: string }).GITHUB_TOKEN;
    if (!token) return c.json({ success: false, error: "GITHUB_TOKEN not set" }, 500);

    const data = await this.getValidatedData<typeof this.schema>();
    const query: Record<string, string> = {};
    if (data.query.sort) query.sort = data.query.sort;
    if (data.query.per_page) query.per_page = data.query.per_page;
    if (data.query.page) query.page = data.query.page;

    const res = await listRepos(token, query);
    if (!res.ok) return c.json({ success: false, error: res.data }, res.status as any);

    return { success: true, result: res.data };
  }
}

// GET /github/repos/:owner/:repo — Get a specific repo
export class GitHubGetRepo extends OpenAPIRoute {
  public schema = {
    tags: ["GitHub"],
    summary: "Get details for a specific repository",
    operationId: "github-get-repo",
    request: {
      params: z.object({
        owner: z.string(),
        repo: z.string(),
      }),
    },
    responses: {
      "200": {
        description: "Repo details",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const token = (c.env as unknown as { GITHUB_TOKEN: string }).GITHUB_TOKEN;
    if (!token) return c.json({ success: false, error: "GITHUB_TOKEN not set" }, 500);

    const data = await this.getValidatedData<typeof this.schema>();
    const res = await getRepo(token, data.params.owner, data.params.repo);
    if (!res.ok) return c.json({ success: false, error: res.data }, res.status as any);

    return { success: true, result: res.data };
  }
}

// POST /github/repos — Create a new repo
export class GitHubCreateRepo extends OpenAPIRoute {
  public schema = {
    tags: ["GitHub"],
    summary: "Create a new repository in your account",
    operationId: "github-create-repo",
    request: {
      body: contentJson(
        z.object({
          name: z.string().describe("Repository name"),
          description: z.string().optional().describe("Repo description"),
          private: z.boolean().optional().describe("Make it private (default false)"),
        }),
      ),
    },
    responses: {
      "200": {
        description: "Created repo",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const token = (c.env as unknown as { GITHUB_TOKEN: string }).GITHUB_TOKEN;
    if (!token) return c.json({ success: false, error: "GITHUB_TOKEN not set" }, 500);

    const data = await this.getValidatedData<typeof this.schema>();
    const res = await createRepo(
      token,
      data.body.name,
      data.body.description || "",
      data.body.private || false,
    );
    if (!res.ok) return c.json({ success: false, error: res.data }, res.status as any);

    // Log to D1 activity table
    try {
      const env = c.env as unknown as { DB: D1Database };
      await env.DB.prepare(
        "INSERT INTO activity_log (action, detail, created_at) VALUES (?, ?, datetime('now'))",
      )
        .bind("repo_created", `Created repo: ${data.body.name}`)
        .run();
    } catch {
      // activity log table may not exist yet — non-fatal
    }

    return { success: true, result: res.data };
  }
}
