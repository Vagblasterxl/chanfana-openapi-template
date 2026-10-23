# BRIEFING — what this repo is, what it's for, what it can do

*Written 2026-10-22 for any Claude (or other agent) arriving cold. Plain
English. Read this first, then `MASTER-SPEC.md` for exact contracts and
`HANDOFF-PACKET.md` for status with confidence tags.*

## What this is, in one paragraph

One GitHub repo — `Vagblasterxl/chanfana-openapi-template`, branch
`claude/add-powertoys-documentation-1hpSY`, PR #3 open — that holds three
systems for Ken's fleet of AI agents. (1) A **shared brain**: a small web API
on Cloudflare where any of Ken's agents can register, leave messages for each
other, store shared state, and build a knowledge graph. (2) The **Ramble
Scrambler**: a legal case builder that turns Ken's voice/text dumps about his
California workers'-comp retaliation case into a lawyer-ready case file with a
live deadline clock. (3) The **glue**: a zero-infrastructure message bus between
agents (plain JSON files in git), a Windows hotkey tool that fires one prompt
into four AI chats, standing-orders cards for Grok and Gemini agents, and
guardrails so no agent can leak a key or break the build. Everything durable
lives in this repo; local machines and cloud containers are treated as disposable.

## What it's intended for

**Ken's situation:** he runs ~20 AI agents (several Claudes on different
machines and surfaces, Antigravity/Gemini on his Windows laptop, Grok bots,
Gemini Spark) and is not a developer — he directs, agents build. Two problems
drove this: his agents couldn't talk to each other or share memory, and his
lawsuit facts were scattered across voice notes and chats with no structure.

**So the repo exists to:**
- Give every agent one place to coordinate (the Worker API, and until it's
  deployed, the git relay) instead of Ken re-explaining things to each one.
- Turn his case rambles into something an attorney can act on — timeline,
  parties, evidence inventory, claims with real statutes, and the statute-of-
  limitations clock (his §132a petition window is only **one year**).
- Let non-coding agents (Grok, Gemini) contribute through a file-drop contract
  rather than APIs.
- Make the whole thing survive machine wipes and account chaos: push to
  GitHub, rebuild from GitHub.

## Capacity — what it can actually do today

| Capability | Status | Proof |
|---|---|---|
| Worker API: 30+ endpoints — agents, messages, state, knowledge graph (subject-verb-object triples), legal case endpoints, Mem.ai push | **Built, tested, not yet deployed** | 56/56 tests pass; GitHub Actions CI green |
| Live database on Cloudflare with all 12 tables (agents, messages, state, assets, tasks, knowledge, 6 legal tables) | **Ready, migrated** | Applied directly in July on the Vagblasterxl account, DB id `d7b93547-…` |
| File-based Ramble Scrambler: ingest a ramble → structured JSON → lawyer-ready `CASE-PACKAGE.md` | **Works now, no server needed** | Smoke-tested end to end; needs only Node |
| California law reference: 21 verified statutes (wage, retaliation, FEHA, wrongful termination, workers' comp incl. adjuster fraud/penalties) + keyword matcher that computes deadlines from an anchor date | **Works** | Matcher ranks §132a and adjuster-fraud statutes top on a test ramble |
| Case law layer: Judson Steel, Lauher, City of Moorpark, Unruh, Vacanti — mapped to forum, clock, remedy | **Written, sourced** | `legal/CASE-LAW.md` |
| Case intake sheet (`legal/INTAKE.md`) — the questions a lawyer needs, keyed to the deadline clocks | **Ready, unfilled** | Ken's real facts have never been entered |
| Git relay: agents exchange JSON messages via `relay/inbox/` + commit/push; `poll.sh` for a tag-team cadence | **Built, untested across machines** | Only this side has ever written to it |
| Quad Commander (`setup/scripts/quad-commander.ahk`): one hotkey fires a stored prompt into 4 browser windows or tabs; `queue\` folder contract for a launcher app | **Written, never run on Windows** | AutoHotkey v2 |
| Fleet cards: standing orders for Grok bots and Gemini agents to read/write the relay and do assigned jobs | **Written, untested** | `relay/cards/` |
| Claude Code add-ons: 4 MCP servers, 5 hooks (block force-push, key leaks, lockfile edits, R2; auto-rebuild; nag unpushed), 5 skills, 2 subagents | **Live, hook-tested** | `.claude/`, `.mcp.json` |
| CI: every push/PR installs, scans for leaked keys, builds, runs all tests | **Live, green** | `.github/workflows/ci.yml` |
| Cloudflare auto-deploy (Workers Builds on the Vagblasterxl account) | **Wired but failing — account-side, not code** | Build log needs that account's login |

## Where things live (repo map)

- `src/` — the Worker API (Hono + Chanfana + Zod, D1). `CLAUDE.md` lists every endpoint.
- `migrations/0001–0005` — the database schema.
- `legal/` — scripts (`ingest.mjs`, `assemble-package.mjs`, `suggest-statutes.mjs`),
  statute JSON, `CA-EMPLOYMENT-LAW.md`, `CASE-LAW.md`, `INTAKE.md`, `data/` (empty arrays).
- `relay/` — `inbox/`, `archive/`, `poll.sh`, `cards/` (Grok, Gemini, fleet pocket).
- `setup/` — Windows installer, AHK scripts, Claude Desktop kickoff doc,
  `runbooks/CLOUDFLARE-ATTACH.md` (step-by-step for Claude in Chrome).
- `.claude/` + `.mcp.json` + `.github/` — the automation layer.
- `MASTER-SPEC.md` (exact contracts), `HANDOFF-PACKET.md` (status w/ provenance),
  `relay/cards/FLEET-POCKET.md` (the story), this file.

## Who's who

- **Ken** — owner, directs everything, not a developer. GitHub `Vagblasterxl`.
- **Claude Code (cloud, this repo)** — writes code, pushes, watches PR #3.
- **Claude Desktop / Desktop Commander** — the machine with wrangler + browser; does deploys and local setup.
- **Claude in Chrome** — runs the Cloudflare runbook in Ken's logged-in browser.
- **Antigravity (Gemini)** — built a Python gRPC bridge (`mcpb-system`) on the laptop; never pushed to GitHub.
- **Grok bots / Gemini Spark** — get standing cards; Grok builds the queue launcher, Gemini builds exporter + schema.
- **Cloudflare accounts:** Vagblasterxl (`9e6e291d…`, holds the DB and the auto-build), Assblasterxl (`81df6339…`, Ken's, reachable), hotmail (`ab02f4df…`, billing-disputed). Ken is consolidating; agents don't create resources without asking.

## What's blocked, and the one next move

Blocked: the Worker isn't live because the Cloudflare auto-build fails for
reasons inside the Vagblasterxl account (every code input verified clean), and
nobody has read that account's build log. Also open: Antigravity's code lives
only on the laptop; the Mem key rotation is unconfirmed; Ken's case facts are
not yet in the system.

**Next move:** someone with Ken's browser runs
`setup/runbooks/CLOUDFLARE-ATTACH.md` — reads the build log, applies the
matching fix, merges PR #3. The API goes live and every agent gets the shared
brain. Everything else is ready behind that one door.

## How to plug in (for the Claude reading this)

1. Read `relay/cards/FLEET-POCKET.md` (5 min) — the arc, Ken's decisions, what's real vs claimed.
2. To talk to this side: write a JSON file into `relay/inbox/` (shape in
   `relay/README.md`) and push, or just tell Ken and he pastes it.
3. Don't re-open decided items: no R2, no keys in files, California law only,
   Ken picks the Cloudflare account.
4. If you have a browser logged into Cloudflare, you are the most useful agent
   in the fleet right now — run the runbook.
