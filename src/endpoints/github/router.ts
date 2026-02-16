import { Hono } from "hono";
import { fromHono } from "chanfana";
import { GitHubStatus } from "./status";
import { GitHubListRepos, GitHubGetRepo, GitHubCreateRepo } from "./repos";
import {
  GitHubDiscoverCategories,
  GitHubDiscoverByCategory,
  GitHubDiscoverSearch,
} from "./discover";
import { GitHubDeploy } from "./deploy";

export const githubRouter = fromHono(new Hono());

// --- Status ---
githubRouter.get("/status", GitHubStatus);

// --- Repos ---
githubRouter.get("/repos", GitHubListRepos);
githubRouter.get("/repos/:owner/:repo", GitHubGetRepo);
githubRouter.post("/repos", GitHubCreateRepo);

// --- Discover (Vending Machine) ---
githubRouter.get("/discover/categories", GitHubDiscoverCategories);
githubRouter.get("/discover/search", GitHubDiscoverSearch);
githubRouter.get("/discover/:category", GitHubDiscoverByCategory);

// --- Deploy (Fork) ---
githubRouter.post("/deploy", GitHubDeploy);
