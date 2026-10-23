---
name: project-conventions
description: Background facts every Claude needs on this repo — accounts, secrets policy, what is deployed where, and the schema contracts. Loaded automatically; not user-invoked.
user-invocable: false
---
# Standing facts (keep in sync with MASTER-SPEC.md)
- Stack: Cloudflare Worker, Hono + Chanfana + Zod, D1. Tests: vitest via
  `@cloudflare/vitest-pool-workers` (pinned vitest 3.2.4). `npm test` = build + tests.
- Auth header for `/agents/* /messages/* /state/* /knowledge/* /sync/* /legal/*`:
  `Authorization: Bearer symphony-ken-2026` (dev token; tests hardcode it).
- Deploy target DB: `openapi-template-db` id `d7b93547-6fba-4766-afb3-7e39e6e36219`
  on Cloudflare account Vagblasterxl `9e6e291db1bc4c877db80a30ff15e92c`
  (migrations 0001–0005 applied). Other accounts: Assblasterxl
  `81df6339f3528e9fc2802a9b25d2e423`, hotmail `ab02f4dfa746bf2e6b3d9ff634bb135a`.
  Ken is consolidating accounts; do not create resources on any without asking.
- R2 is OFF on purpose (billing). `/sync/*` returns 501 without it. Keep it off.
- Secrets: `.dev.vars` (gitignored) locally, `wrangler secret put` in prod.
  The old `MEM_API_KEY` was leaked to git history and is burned.
- Legal payload / statute / relay schemas: `MASTER-SPEC.md` §3–§5 (byte-exact).
- Ken is not a developer: never hand him commands; give agents the commands.
- Everything durable lives in GitHub; local and container state is disposable.
