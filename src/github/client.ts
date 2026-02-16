/**
 * GitHub API client for Cloudflare Workers.
 * Uses a Personal Access Token (PAT) for authentication.
 *
 * Set your GitHub token as a Cloudflare secret:
 *   wrangler secret put GITHUB_TOKEN
 */

const GITHUB_API = "https://api.github.com";

export interface GitHubApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

async function githubFetch<T = unknown>(
  token: string,
  path: string,
  options?: {
    method?: string;
    body?: unknown;
    query?: Record<string, string>;
  },
): Promise<GitHubApiResponse<T>> {
  const url = new URL(path, GITHUB_API);
  if (options?.query) {
    for (const [k, v] of Object.entries(options.query)) {
      url.searchParams.set(k, v);
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "cloudflare-worker",
  };

  const init: RequestInit = { method: options?.method || "GET", headers };
  if (options?.body) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const res = await fetch(url.toString(), init);
  const data: T = await res.json();
  return { ok: res.ok, status: res.status, data };
}

// ---------- user / status ----------

export function getAuthenticatedUser(token: string) {
  return githubFetch<{ login: string; name: string; public_repos: number; avatar_url: string }>(
    token,
    "/user",
  );
}

// ---------- repos ----------

export function listRepos(
  token: string,
  query?: Record<string, string>,
) {
  return githubFetch<Array<{ id: number; name: string; full_name: string; description: string; html_url: string; language: string; stargazers_count: number; updated_at: string }>>(
    token,
    "/user/repos",
    { query: { sort: "updated", per_page: "30", ...query } },
  );
}

export function getRepo(token: string, owner: string, repo: string) {
  return githubFetch(token, `/repos/${owner}/${repo}`);
}

export function createRepo(
  token: string,
  name: string,
  description: string,
  isPrivate: boolean = false,
) {
  return githubFetch(token, "/user/repos", {
    method: "POST",
    body: { name, description, private: isPrivate, auto_init: true },
  });
}

// ---------- discover (search) ----------

export interface SearchResult {
  total_count: number;
  items: Array<{
    id: number;
    full_name: string;
    description: string;
    html_url: string;
    language: string;
    stargazers_count: number;
    forks_count: number;
    topics: string[];
    updated_at: string;
    owner: { login: string; avatar_url: string };
  }>;
}

// Pre-built category queries for the "vending machine"
export const CATEGORIES: Record<string, string> = {
  "cloudflare-workers": "topic:cloudflare-workers stars:>50",
  "hono-framework": "topic:hono stars:>20",
  "api-template": "topic:api-template stars:>30",
  "firebase": "topic:firebase stars:>100",
  "google-sheets": "topic:google-sheets-api stars:>20",
  "ai-tools": "topic:ai OR topic:llm OR topic:openai stars:>200 language:TypeScript",
  "nextjs": "topic:nextjs stars:>500",
  "react": "topic:react stars:>1000 language:TypeScript",
  "d1-database": "topic:d1 OR topic:cloudflare-d1 stars:>10",
  "fullstack": "topic:fullstack stars:>100 language:TypeScript",
};

export function searchRepos(
  token: string,
  query: string,
  sort: string = "stars",
  perPage: string = "20",
) {
  return githubFetch<SearchResult>(token, "/search/repositories", {
    query: { q: query, sort, order: "desc", per_page: perPage },
  });
}

// ---------- fork / deploy ----------

export function forkRepo(token: string, owner: string, repo: string) {
  return githubFetch(token, `/repos/${owner}/${repo}/forks`, {
    method: "POST",
    body: {},
  });
}

// Get the default branch's tree (for inspecting repo contents)
export function getRepoContents(
  token: string,
  owner: string,
  repo: string,
  path: string = "",
) {
  return githubFetch(token, `/repos/${owner}/${repo}/contents/${path}`);
}
