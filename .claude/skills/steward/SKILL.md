---
name: steward
description: Repo-specific guidance for watching and driving PRs on chanfana-openapi-template — what CI means here, which failures are account-side, and when not to comment.
user-invocable: false
---
# PR steward rules for this repo

## The two checks you will see
1. **GitHub Actions `ci`** (`.github/workflows/ci.yml`) — the real signal. Runs
   `npm ci` + `npm test` (which includes `wrangler deploy --dry-run`). If this is
   red, it IS the PR's problem: fix and push.
2. **`Workers Builds: chanfana-openapi-template`** — Cloudflare's hosted
   build+deploy on the Vagblasterxl account (`9e6e291db1bc4c877db80a30ff15e92c`).
   It fails for account/dashboard reasons that no commit can fix. Verified
   2026-10-21: `npm ci`, `pnpm install --frozen-lockfile`, all submodules, 56/56
   tests and the dry-run build all pass on the failing commits. Treat a red
   Workers Builds check as **not this PR's** when Actions `ci` is green. One
   blocker comment already exists on PR #3 — do not post another per push.
   The fix is in `setup/runbooks/CLOUDFLARE-ATTACH.md` (human + browser).

## Never
- Enable R2 or add an R2 binding (triggers Cloudflare billing prompts).
- Put `MEM_API_KEY` or any key in a tracked file; `.dev.vars` or `wrangler secret` only.
- Force-push or `reset --hard` on shared branches.
- Hand-edit lockfiles; regenerate with `npm install`.

## Before any push
`npm test` must print `Tests  56 passed` (or more) and the dry-run must say
`--dry-run: exiting now.`
