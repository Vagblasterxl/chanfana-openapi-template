import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import { searchRepos, CATEGORIES } from "../../github/client";

// GET /github/discover/categories — List available vending machine categories
export class GitHubDiscoverCategories extends OpenAPIRoute {
  public schema = {
    tags: ["GitHub Discover"],
    summary: "List available repo categories (the vending machine menu)",
    operationId: "github-discover-categories",
    responses: {
      "200": {
        description: "Available categories",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle() {
    return {
      success: true,
      result: {
        categories: Object.keys(CATEGORIES),
        description:
          "Pick a category and hit /github/discover/{category} to browse top repos. Then deploy any repo with /github/deploy.",
      },
    };
  }
}

// GET /github/discover/:category — Browse top repos in a category
export class GitHubDiscoverByCategory extends OpenAPIRoute {
  public schema = {
    tags: ["GitHub Discover"],
    summary: "Browse top repos in a category — the vending machine",
    operationId: "github-discover-by-category",
    request: {
      params: z.object({
        category: z.string().describe("Category key from /github/discover/categories"),
      }),
      query: z.object({
        per_page: z.string().optional().describe("Results to return (default 20, max 100)"),
      }),
    },
    responses: {
      "200": {
        description: "Top repos for this category",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const token = (c.env as unknown as { GITHUB_TOKEN: string }).GITHUB_TOKEN;
    if (!token) return c.json({ success: false, error: "GITHUB_TOKEN not set" }, 500);

    const data = await this.getValidatedData<typeof this.schema>();
    const category = data.params.category;
    const query = CATEGORIES[category];

    if (!query) {
      return c.json(
        {
          success: false,
          error: `Unknown category: ${category}`,
          available: Object.keys(CATEGORIES),
        },
        400,
      );
    }

    const res = await searchRepos(token, query, "stars", data.query.per_page || "20");
    if (!res.ok) return c.json({ success: false, error: res.data }, res.status as any);

    // Return a clean list
    const repos = res.data.items.map((r) => ({
      full_name: r.full_name,
      description: r.description,
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language,
      topics: r.topics,
      url: r.html_url,
      owner: r.owner.login,
    }));

    return {
      success: true,
      result: {
        category,
        total_found: res.data.total_count,
        showing: repos.length,
        repos,
        next_step: "Pick a repo and POST /github/deploy with { owner, repo } to fork it into your account",
      },
    };
  }
}

// GET /github/discover/search — Free-text search
export class GitHubDiscoverSearch extends OpenAPIRoute {
  public schema = {
    tags: ["GitHub Discover"],
    summary: "Search GitHub repos by any query",
    operationId: "github-discover-search",
    request: {
      query: z.object({
        q: z.string().describe("GitHub search query, e.g. 'cloudflare workers hono'"),
        sort: z.enum(["stars", "forks", "updated", "help-wanted-issues"]).optional(),
        per_page: z.string().optional(),
      }),
    },
    responses: {
      "200": {
        description: "Search results",
        ...contentJson(z.object({ success: z.boolean(), result: z.any() })),
      },
    },
  };

  async handle(c: AppContext) {
    const token = (c.env as unknown as { GITHUB_TOKEN: string }).GITHUB_TOKEN;
    if (!token) return c.json({ success: false, error: "GITHUB_TOKEN not set" }, 500);

    const data = await this.getValidatedData<typeof this.schema>();
    const res = await searchRepos(
      token,
      data.query.q,
      data.query.sort || "stars",
      data.query.per_page || "20",
    );
    if (!res.ok) return c.json({ success: false, error: res.data }, res.status as any);

    const repos = res.data.items.map((r) => ({
      full_name: r.full_name,
      description: r.description,
      stars: r.stargazers_count,
      forks: r.forks_count,
      language: r.language,
      topics: r.topics,
      url: r.html_url,
      owner: r.owner.login,
    }));

    return { success: true, result: { total_found: res.data.total_count, repos } };
  }
}
