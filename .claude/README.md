# What's wired into this repo for Claude (plain English)

**MCP servers** (`.mcp.json`, shared by every Claude that opens this repo):
- `cloudflare` — Cloudflare's official API server. Can read Workers, D1, builds.
- `github` — GitHub's official server. PRs, issues, checks.
- `context7` — live documentation lookup for Hono / Chanfana / Wrangler.
- `mem` — Mem.ai shared memory. Reads the key from the `MEM_API_KEY` environment
  variable (put it in `.dev.vars`; nothing secret is in this file).
The first time, Claude Code will ask you to approve these and the remote ones
will open a browser login once.

**Hooks** (`.claude/settings.json` + `.claude/hooks/`) — automatic guardrails:
- On session start: reinstalls `node_modules` if a container reset wiped it.
- Before any terminal command: blocks force-push, `reset --hard`, and enabling R2.
- Before any file edit: blocks writing API keys into tracked files, editing
  `.dev.vars`, or hand-editing lockfiles.
- After editing Worker source: runs the build and shouts if it broke.
- When Claude stops: warns if anything is uncommitted or unpushed.

**Skills** (`.claude/skills/`) — `/legal-ingest`, `/deploy-check`, `/relay-send`
you can type; `steward` and `project-conventions` load silently as background rules.

**Subagents** (`.claude/agents/`) — `legal-researcher`, `code-reviewer`.

**Webhook / CI** (`.github/workflows/ci.yml`) — every push and PR now gets a
real GitHub check (`ci`) that installs, scans for leaked keys, builds and runs
all tests. This is the check to trust; the Cloudflare "Workers Builds" check
fails for account reasons (see `setup/runbooks/CLOUDFLARE-ATTACH.md`).
