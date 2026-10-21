# RUNBOOK — Get the Worker live on Cloudflare

**Who runs this:** Claude in Chrome (needs Ken's browser, logged into Cloudflare
and GitHub). Claude Desktop Commander can run the terminal parts.
**Who decides:** Ken. Every `⛔ STOP` line means stop and ask him; do not guess.
**Report back:** fill the REPORT block at the bottom and hand it to Ken.

## Facts you need (copy exact, do not retype)

| thing | value |
|---|---|
| Repo | `https://github.com/Vagblasterxl/chanfana-openapi-template` |
| PR to merge | `https://github.com/Vagblasterxl/chanfana-openapi-template/pull/3` |
| Branch on that PR | `claude/add-powertoys-documentation-1hpSY` |
| Worker name | `chanfana-openapi-template` |
| Database name | `openapi-template-db` |
| Account A (already wired, build failing) | Vagblasterxl@gmail.com — id `9e6e291db1bc4c877db80a30ff15e92c` |
| Database id on Account A (12 tables, migrated) | `d7b93547-6fba-4766-afb3-7e39e6e36219` |
| Failing build log (Account A) | `https://dash.cloudflare.com/9e6e291db1bc4c877db80a30ff15e92c/workers/services/view/chanfana-openapi-template/production/builds/19620589-7f77-4075-8bfc-d2f40bb33d36` |
| Account B (fallback) | Assblasterxl@gmail.com — id `81df6339f3528e9fc2802a9b25d2e423` |

Verified already (do NOT re-investigate): the code builds and passes 56/56
tests; `npm ci` and `pnpm install --frozen-lockfile` both succeed; all git
submodules are reachable. Whatever the build log says, it is an account /
dashboard-settings problem, not a code problem.

---

## PATH A — fix the account that is already wired (try this first)

1. Open `https://dash.cloudflare.com`. If more than one account is listed,
   pick **Vagblasterxl@gmail.com's Account** (id `9e6e291d…`).
   - ⛔ STOP if that account is not listed, is suspended, or shows a billing
     wall. Tell Ken: "Account A is unreachable/suspended: <what you see>."
     Then go to PATH B only if Ken says so.
2. Open the failing build log URL from the table. Read the LAST 30 lines of
   the log. Copy them into the REPORT block verbatim.
3. Match the error to this table and apply the fix in
   **Workers & Pages → chanfana-openapi-template → Settings → Build**:

   | log says (roughly) | fix |
   |---|---|
   | `pnpm` / `ERR_PNPM` / lockfile | Build settings → set **Build command** to `npm ci && npx wrangler deploy` (forces npm) |
   | `node: not found` / Node version / `engine` | Add build **environment variable** `NODE_VERSION` = `20` |
   | `wrangler: command not found` | Build command → `npm ci && npx wrangler deploy` |
   | `D1 database not found` / `binding DB` | The database is on this account as `d7b93547-…`. Open **Storage & Databases → D1** and confirm `openapi-template-db` exists. If it does NOT, ⛔ STOP — tell Ken, this account is not the one holding the data. |
   | `R2` / `bucket` | ⛔ STOP. The repo config already disables R2. If the dashboard shows an R2 binding under Settings → Bindings, remove it. Do not enable R2 (it triggers billing). |
   | `Authentication` / `API token` / `account` / `billing` / `quota` | ⛔ STOP — account-level. Report to Ken; he decides PATH B. |
   | anything else | ⛔ STOP — paste the lines to Ken. |

4. Click **Retry build** (or push any commit). Wait for it. Green = continue.
   Red again = copy the new last-30 lines, ⛔ STOP, report.
5. On GitHub open PR #3 → **Ready for review** → **Merge pull request** →
   **Confirm merge**. (Merge commit is fine.) This makes `main` carry the code;
   Cloudflare auto-deploys `main` to production.
6. Back in Cloudflare → Workers & Pages → chanfana-openapi-template → confirm
   a new green **production** deployment appeared.
7. Copy the worker URL shown there (ends in `.workers.dev`). Open
   `<that url>/health` in a tab. Expect JSON with `"status"`. Paste it in REPORT.
8. Secrets (only if Ken has already regenerated his Mem key — ask):
   Settings → **Variables and Secrets** → Add → name `MEM_API_KEY`, type
   **Secret**, value = the new key Ken gives you. Save → Deploy.
   Never paste that key anywhere else (not GitHub, not a file, not chat logs).
9. Done. Fill REPORT.

## PATH B — move to Account B (only if Ken says "go Assblasterxl")

1. In Cloudflare switch to **Assblasterxl@gmail.com's Account** (id `81df6339…`).
2. **Storage & Databases → D1 → Create database** → name exactly
   `openapi-template-db` → create. Copy its **Database ID** (looks like
   `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`). Put it in REPORT.
3. ⛔ STOP — hand that ID to Ken for the Claude Code session. It will update
   `wrangler.jsonc` (`database_id`), apply the 5 migrations to the new
   database, commit, and push. Wait until Ken says that's done.
4. **Workers & Pages → Create → Import a repository** → connect GitHub if asked
   → choose `Vagblasterxl/chanfana-openapi-template` → Production branch
   `main` → Build command `npm ci && npx wrangler deploy` → Deploy.
5. Then PATH A steps 5–9 (merge PR, confirm deploy, `/health`, secret).

## REPORT (fill and hand to Ken)

```
PATH taken: A / B
Account used: <email + id>
Build log last 30 lines:
<paste>
Fix applied: <which table row, or none>
Retry result: GREEN / RED
PR #3: merged yes/no
Worker URL: https://________.workers.dev
/health response: <paste>
MEM_API_KEY secret set: yes / no (not rotated yet)
STOP hit at step: <number + what you saw>  (or "none")
```
