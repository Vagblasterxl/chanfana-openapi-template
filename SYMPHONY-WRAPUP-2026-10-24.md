# SYMPHONY — FULL WRAP-UP (one file, everything)
*2026-10-24 · Claude Code (cloud) session on GitHub repo `Vagblasterxl/chanfana-openapi-template`, branch `claude/add-powertoys-documentation-1hpSY`, PR #3.*
*This single file stitches together every handoff document from the session. Hand it to any Claude, Grok, or Gemini agent cold.*

---

## THE SHORT VERSION (read this if nothing else)

**What it is:** one GitHub repo holding (1) a "shared brain" web API on Cloudflare so all of Ken's agents can register, message each other, and share memory; (2) the **Ramble Scrambler**, a legal case builder for Ken's California workers'-comp retaliation case; (3) the glue — a git-based message relay between agents, a hotkey tool that fires one prompt into four AI chats, standing-orders cards for Grok and Gemini, and guardrails so no agent can leak a key.

**Where it stands:** the code is built and independently proven — GitHub's own CI runs install, key-scan, build, and all 56 tests green on every push. **It is not live.** Cloudflare's auto-deploy on the Vagblasterxl account fails for reasons inside that account (every code input was verified clean three separate times), and the error log sits behind Ken's login. Nothing has ever merged to `main`.

**What's waiting on Ken (only he can do these):**
1. Say which Cloudflare account deploys: "Vagblasterxl" or "Assblasterxl".
2. Paste `setup/runbooks/CLOUDFLARE-ATTACH.md` into Claude in Chrome while logged into Cloudflare — it reads the build log and fixes it.
3. Regenerate the Mem.ai key (old one is burned in git history) and hand it to Claude Desktop.
4. Have Antigravity push `mcpb-system` to GitHub — it exists only on the laptop.
5. Fill in the dates in `legal/INTAKE.md` — the §132a deadline is one year from the retaliatory act.
6. Merge PR #3: https://github.com/Vagblasterxl/chanfana-openapi-template/pull/3
7. Paste the Grok and Gemini cards (included at the bottom of this file) into those agents.

**For the coordinator reconciling the eight Claude environments:** do **not** merge a second branch into `main` until (a) migration files are renumbered — every branch independently numbers from `0002`, so any two-branch merge breaks the database — and (b) one inter-agent message bus is chosen; there are currently seven competing designs.

**Links (open in any browser, no download needed):**
- Repo branch: https://github.com/Vagblasterxl/chanfana-openapi-template/tree/claude/add-powertoys-documentation-1hpSY
- PR #3: https://github.com/Vagblasterxl/chanfana-openapi-template/pull/3
- PR #2 (another Claude's Polar + Discord work): https://github.com/Vagblasterxl/chanfana-openapi-template/pull/2

## CONTENTS
1. Status report (verified vs. unverified, what's blocked, conflicts, top-5 actions)
2. Briefing (what it is, plain English)
3. Fleet pocket (the story, Ken's decisions in his own words)
4. Handoff packet (status claims with confidence tags)
5. Master spec (exact commands, JSON contracts, account map)
6. Cloudflare runbook (paste into Claude in Chrome)
7. Case intake sheet (for Ken)
8. Grok bot card + Gemini card (paste into those agents)



---

<!-- ===== SECTION 1 — source file: STATUS-REPORT-2026-10-23.md ===== -->

# STATUS REPORT — Ken's AI agent infrastructure
*Prepared 2026-10-23 by Claude Code (cloud) on repo `Vagblasterxl/chanfana-openapi-template`. For the system owner and the coordinator reconciling eight Claude environments. "VERIFIED" = I ran it or read it myself, with the date. "UNVERIFIED" = exists as code/claim only. Nothing below is claimed to work because code exists.*

Companion files in the same repo/branch: `BRIEFING.md` (what it is, plain English), `MASTER-SPEC.md` (exact contracts), `HANDOFF-PACKET.md` (status with provenance tags), `relay/cards/FLEET-POCKET.md` (the story + Ken's verbatim decisions).

## Scope note
This session built the legal case builder, the inter-agent git relay, the California law reference, the Quad Commander hotkey tool, the Claude add-ons, CI, runbooks, and the handoff documents — all on branch `claude/add-powertoys-documentation-1hpSY` (PR #3). It did NOT build Polar, Discord, or Durable Objects; those were built by other Claude instances on other branches/accounts and are reported from evidence below. "Mission Box": zero occurrences in any branch, file, commit, or Cloudflare resource visible to me — unknown term; ask the environment that coined it.

## MOST IMPORTANT: what is waiting on KEN (only he can do these)

| # | Action | First asked | Why |
|---|---|---|---|
| 1 | Pick the Cloudflare deploy account: say "Vagblasterxl" or "Assblasterxl". | Sep 10, Oct 21 | Every deploy path waits on this one word. |
| 2 | Let an agent with Ken's browser read the Cloudflare build log: paste `setup/runbooks/CLOUDFLARE-ATTACH.md` into Claude in Chrome while logged into Cloudflare. | Oct 21 | Auto-deploy has failed on every push since Oct 12; the error is behind a login. |
| 3 | Regenerate the Mem.ai key at mem.ai; hand the new one to Claude Desktop (never to chat or a repo file). | Jul 8 | Old key is in git history (burned). Shared memory is dead until rotated. |
| 4 | Paste the push command into Antigravity so `mcpb-system` lands on GitHub. | Jul (twice) | Exists only on one laptop; a wipe loses it. |
| 5 | Fill Section 1 of `legal/INTAKE.md` (dates only; voice ramble fine). | Oct 12 | Legal pipeline is empty; §132a deadline is 1 year from the retaliatory act and cannot be computed. |
| 6 | Open PR #3: mark Ready for review and merge, or comment changes. | Oct 12 | 30 commits have never reached `main`. |
| 7 | Authorize the Trellis connector in claude.ai connector settings. | Sep 10 | Real California court records for the case. |
| 8 | Double-click `setup/scripts/quad-commander.ahk` on the laptop once (auto-Enter off). | Jul | Never run on a real Windows machine. |
| 9 | Paste `relay/cards/GROK-BOT-CARD.md` into a Grok bot and `GEMINI-CARD.md` into Spark. | Oct 22 | Those agents are not plugged in until then. |

## 1. Built and VERIFIED working
| Component | Where | Evidence |
|---|---|---|
| Worker API code (30+ endpoints: agents, messages, state, knowledge graph, legal, Mem push) | `src/`, branch `claude/add-powertoys-documentation-1hpSY`, head `f65179f` | VERIFIED Oct 21–22: `npm ci` clean, `pnpm install --frozen-lockfile` clean, dry-run build compiles, 56/56 tests pass; GitHub Actions `ci` green on head |
| Live Cloudflare D1 database, all 12 tables (incl. 6 legal) | `openapi-template-db` id `d7b93547-6fba-4766-afb3-7e39e6e36219`, Vagblasterxl account `9e6e291db1bc4c877db80a30ff15e92c` | VERIFIED Jul 8 by direct query: migrations 0001–0005 applied and ledgered. NOT re-verified since; that account left my credential set in September. |
| File-based legal pipeline (ramble → JSON → `CASE-PACKAGE.md`) | `legal/ingest.mjs`, `assemble-package.mjs`, `suggest-statutes.mjs` | VERIFIED Jul 8 end to end; needs only Node |
| CA law reference + deadline matcher (21 statutes) | `legal/ca-employment-law.json`, `CA-EMPLOYMENT-LAW.md`, `CASE-LAW.md` | VERIFIED Jul 8: ranks §132a and Ins. Code §1871.4 top on a test ramble; computes deadlines |
| Claude add-ons: 5 guardrail hooks, 4 MCP server configs, 5 skills, 2 subagents | `.claude/`, `.mcp.json` | VERIFIED Oct 21: hooks 8/8 correct on sample inputs. MCP configs valid JSON; the servers were not connected in-session. |
| CI (install, key scan, build, tests on every push/PR) | `.github/workflows/ci.yml` | VERIFIED Oct 21–22: passes on every push |
| PR #3 (draft, 30 commits, 193 files, no merge conflict with main) | https://github.com/Vagblasterxl/chanfana-openapi-template/pull/3 | VERIFIED Oct 23 via GitHub API |
| Secret scrub | commit `f4509a8` | VERIFIED Jul 8: no tracked file holds the key; key remains in git history |

## 2. Built but NOT deployed / activated / connected
| Component | Where | Status |
|---|---|---|
| The Worker itself | PR #3 branch | Not deployed. A Feb-2026 build of OLD code is live on Vagblasterxl as `chanfana-openapi-template` (seen Jul 8), lacking legal endpoints. Auto-deploy fails every push (§4). |
| Git relay between agents | `relay/` | Never exercised by a second machine. UNVERIFIED two-way. |
| Quad Commander + `queue\` contract | `setup/scripts/quad-commander.ahk` | Never run on Windows. UNVERIFIED. |
| Grok / Gemini standing-orders cards | `relay/cards/` | Written Oct 22; never pasted into either agent. |
| Mem.ai integration | `src/endpoints/mem/`, `.mcp.json` | Guarded code; no valid key exists. Inactive. |
| Case intake sheet | `legal/INTAKE.md` | Ready; `legal/data/*.json` empty. Zero real case facts. |
| Polar webhook + entitlements + Discord slash-command ingress (another Claude) | branch `claude/polar-webhook-entitlements-8fqi4i`, head `93a5b01` (Oct 10), PR #2 draft, 26 files | Signature verification, entitlement store, Discord identity map, two test files. Tests NOT run by me — UNVERIFIED. Not deployed; only check is the failing Cloudflare build. Needs secrets `POLAR_WEBHOOK_SECRET`, `DISCORD_PUBLIC_KEY`, `DISCORD_OPERATOR_IDS` (unset). Says it mirrors the live `polar-mcp` Worker (§4). |
| Go Discord bot (pre-session) | `setup/discord-bot/*.go` (commit `f63a4ac`) | Source only; never built/run. UNVERIFIED. |
| Oracle inter-agent bus + Google/Firebase/GitHub endpoints (another Claude) | branch `claude/cloudflare-google-integration-HeGUL`, head `e47449d` (Apr 6) | Code only; no PR; config points at nonexistent DB `b96d67ac…`. UNVERIFIED. |
| Slack/Discord/Polar/Manus connectors + debate/governance (another Claude) | branch `claude/slack-session-VKAqM`, head `1fda04e` (Apr 22), 8 migrations | Code only; no PR. UNVERIFIED. |
| `CLAUDE.md` rewrite | branch `claude/claude-md-docs-i3n79s`, PR #1 (1 file) | Conflicts with PR #3's `CLAUDE.md` (§6). |

## 3. Blocked by something KEN must do
All items in the "waiting on Ken" table. Largest blast radius:
- Cloudflare build log (item 2): every push since Oct 12 fails the Vagblasterxl auto-deploy. Code inputs proven clean on three commits. The failure is inside that account; its log needs Ken's login. Until read, PR #2 and PR #3 show a red check forever and nothing deploys via that path.
- Account decision (item 1): "go Assblasterxl" switches to: create a fresh DB there, re-point config, connect the repo once in that dashboard.

## 4. Blocked by another agent / service / dependency
| Blocker | Detail | Evidence |
|---|---|---|
| Cloudflare Workers Builds on Vagblasterxl | Fails on every commit of PR #2 and PR #3; error not exposed to GitHub | VERIFIED Oct 23: `failure` on both heads; local repro clean |
| Cloudflare credential drift | Jul 8: Vagblasterxl, Rogerdoger, hotmail visible. Sep 10 onward: only Assblasterxl `81df6339f3528e9fc2802a9b25d2e423` and hotmail `ab02f4dfa746bf2e6b3d9ff634bb135a`. Connector failed to connect Oct 23; nothing Cloudflare-side re-verified today. | connector headers |
| No code-upload path from this sandbox | Cannot reach `api.cloudflare.com`; no token. Deploy needs Claude Desktop (wrangler) or the dashboard. | VERIFIED Oct 12 |
| Antigravity `mcpb-system` (Python gRPC, ports 50051/50052) | Only at `C:\Users\kenws\Downloads\mcpb-system`; never pushed. Its "56 tests pass" is its own claim — UNVERIFIED. | Ken's pastes, Jul |
| Trellis / Replit / TickTick connectors | Need Ken's OAuth | connector notices |
| `polar-mcp` Worker (hotmail account) | Seen Jul 8: worker modified 2026-07-04, D1 `polar-mcp-db` created 2026-06-28. PR #2 mirrors its schema. Owner, purpose, current status UNKNOWN. | Jul 8 listing |
| Durable Objects | No branch in this repo declares any Durable Object (all 7 branches searched: zero). Only type-definition and English-word hits. Separately, Assblasterxl account had DO experiment workers on Sep 10: `sqlite-do`, `ws-hibernation-do`, `alarm-do`, `do-basic-counter` (created May 9) — outside this repo; status UNKNOWN. | grep Oct 23; Sep 10 listing |

## 5. Incomplete, experimental, or merely proposed
- Laptop wipe/rebuild runbook: requested Oct 21; attempt halted by a safety check; does not exist. `setup/scripts/setup-windows.ps1` + `OWNER-AUTHORIZATION-KICKOFF.md` cover rebuild only.
- Google Apps Script backend: proposed Jul; never built; superseded.
- Antigravity's 15 Spark tasks: two folded into `GEMINI-CARD.md`; none delivered.
- Grok-built launcher app for `queue\`: contract written; app does not exist.
- `ci` workflow double-fires on branch pushes (harmless); not fixed.
- `/sync/*` endpoints return 501 by design (R2 off).
- Pre-existing TypeScript warnings in `agents/` and `assets/` (library typing quirk); build/tests pass.

## 6. Conflicts with other Claude instances' work
Nothing has ever merged to `main` (`865d0b1`, Nov 23 2025). Six branches grew independently for up to 11 months.
1. Five competing inter-agent message buses: (a) PR #3 D1 `messages` + `/messages/*` (tests pass); (b) PR #3 git relay; (c) Oracle `0002_add_oracle_messages.sql`; (d) PR #2 `0003_add_discord_bus.sql` mirroring `polar-mcp`; (e) Slack branch `0003_add_inbox_system.sql`. Plus hotmail's `agent-coordination-db` (41 MB, Jul 8) and Antigravity's gRPC bridge. Seven designs for one job.
2. Migration-number collisions (hard merge hazard): every branch numbers from `0002` independently; Oracle has two `0002` files. Merging any two breaks `wrangler d1 migrations apply` until renumbered.
3. `src/index.ts` modified by every branch.
4. `wrangler.jsonc` DB id: PR #3 → real `d7b93547…`; Polar and Oracle → `b96d67ac…`, which exists in no visible account.
5. Two Discord implementations (Go bot vs PR #2 TypeScript ingress).
6. Two `CLAUDE.md`s (PR #1 vs PR #3).
7. PR #3 vs PR #2 overlapping files: `README.md`, `src/index.ts`, `worker-configuration.d.ts`, `.dev.vars.example`.
8. Three Cloudflare accounts each running a "symphony" stack (hotmail: coordinator/captain-proton/extractor-bus/memory-bridge; Assblasterxl: conductor/registry/api-gateway/broadcast/queue-processor; Vagblasterxl: switchboard/cron + this repo's worker). No evidence they talk to each other.

## Five highest-impact actions (Ken's participation first)
1. Read the Cloudflare build log via `setup/runbooks/CLOUDFLARE-ATTACH.md` in Claude in Chrome — unblocks PR #2 and PR #3 deploys.
2. Name the account, then say "merge PR #3" — CI is green; `main` becomes real for the first time.
3. Fill the dates in `legal/INTAKE.md` — the only item protecting a legal right that expires.
4. Push Antigravity's `mcpb-system` to GitHub — the one piece of work still losable outright.
5. Rotate the Mem key and have Claude Desktop set it as a secret — shared memory for every agent.

Standing instruction for the coordinator: do NOT merge a second branch into `main` until migrations are renumbered and one message bus is chosen; those two break the database silently.


---

<!-- ===== SECTION 2 — source file: BRIEFING.md ===== -->

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


---

<!-- ===== SECTION 3 — source file: relay/cards/FLEET-POCKET.md ===== -->

```
POCKET — Symphony / Ramble Scrambler build, June→October 2026
From: Claude Code (cloud, repo Vagblasterxl/chanfana-openapi-template) · 2026-10-22 · with: Antigravity (Gemini), Claude Desktop, Grok (planned), Gemini Spark (planned)

TLDR: A Cloudflare Worker "shared brain" for Ken's agents plus a legal case
builder (the "Ramble Scrambler") for his California workers'-comp retaliation
case, built and tested but not yet deployed; everything lives on GitHub. The
blocker is which Cloudflare account to deploy on, not code. Grok and Gemini get
standing cards so they plug into the same GitHub relay and prompt queue.

THE ARC (in order)
1. Ken asked for his Claudes to talk to each other and for a "Ramble Scrambler"
   that turns voice dumps about his lawsuit into a lawyer-ready case file.
2. Turned when Cloudflare billing blocked deploys — everything was rebuilt as
   plain files + Node scripts that need no server.
3. Turned again when Cloudflare accounts came back into reach: the Vagblasterxl
   account already auto-builds this repo and holds the migrated database.
4. Triage found and fixed a leaked Mem API key, a wrong database id, and gaps
   in the legal reference (adjuster lies, §132a ranking).
5. Landed on: PR #3 open (draft), real CI green, Cloudflare build red for
   account-side reasons, Quad Commander hotkey script + agent cards shipped.

DECIDED (by Ken)
- Cloudflare is used only without a credit card; R2 stays off.
- Legal scope is California employer / workers' comp / retaliation law only.
- Assblasterxl is his account; account sprawl is from "the google domane fiasco"
  and he is retreating from it — note, do not investigate.
- Grok builds the launcher app; Claude makes "everything else".
- Everything durable goes to GitHub; local machines and containers are disposable.

SUGGESTED, NOT DECIDED (by agent)
- Deploy target account: Vagblasterxl (already wired) vs Assblasterxl (reachable).
- Google Apps Script as a free backend alternative.
- Trellis (CA court records) connector — needs Ken to authorize it.

REJECTED (and why)
- Hardcoding any key in tracked files — leaked once, scrubbed, hooks now block it.
- Enabling R2 — triggers Cloudflare billing prompts.

STILL OPEN
- Which Cloudflare account deploys (then: Claude in Chrome runs
  setup/runbooks/CLOUDFLARE-ATTACH.md).
- Antigravity's mcpb-system (Python gRPC, ports 50051/50052) exists only on the
  Windows laptop — never pushed to GitHub.
- Mem API key rotation at mem.ai — unconfirmed.
- Ken's real case facts have never been entered — legal/INTAKE.md is waiting.
- Laptop wipe prep — not written.

KEN'S WORDS (verbatim)
- "all that matters is employer law, workman's law, California law"
- "I don't know about the, uh, adjuster, um, making claims that just... or lies"
- "Pull stuff from him and pull stuff from you. What do you need to either button this up or move on to the next thing?"
- "assblasterxl@gmail+kenwsimmons@hotmail.com got ate" / "not need to look into cures, just note for context until relavent"
- "Skills, webhooks, MCPs. All of them, as many of them as we can get that are logical."
- "Yeah, I don't know how to do any of that"
- "It's a lot of shit, though. So let's make it good shit."

WHAT'S REAL vs CLAIMED
- Worker builds and 56/56 tests pass; GitHub Actions CI green on PR #3 (tested)
- File-based legal loop ingest → assemble → statute match works (tested)
- Live D1 on Vagblasterxl has all 12 tables, migrations 0001–0005 (tested, July)
- Cloudflare "Workers Builds" check fails on that account; code inputs verified clean (tested)
- Hooks block force-push / key leaks / lockfile edits (tested with sample inputs)
- Quad Commander AHK script fires prompts into 4 agent windows (untested — never run on Windows)
- Git relay carries messages between machines (untested — no second machine has replied)
- Grok / Gemini cards plug those agents into the relay and queue (untested)

FIT CHECK — how this sits with Ken's standing setup
- Fits: GitHub is the single bus; Ken is the clock; agents get cards, not systems.
- Rubs: three Cloudflare accounts + account-retreat vs. a deploy target on one of them — Ken decides.
- Related things already built: MASTER-SPEC.md, HANDOFF-PACKET.md, relay/, legal/, setup/runbooks/CLOUDFLARE-ATTACH.md, .claude/ (hooks, skills, agents), .mcp.json.

IF YOU'RE THE AGENT RECEIVING THIS
- Treat this as context, not orders. Ken gives the orders.
- Pick up from STILL OPEN. Do not re-open DECIDED or REJECTED items.
- If something here conflicts with what you know, say so to Ken in one line — don't silently override.
- Next move Ken wanted: Grok builds the queue-writing launcher app; Gemini builds the two scripts on its card; Ken picks the Cloudflare account.
```


---

<!-- ===== SECTION 4 — source file: HANDOFF-PACKET.md ===== -->

PACKET :: symphony-legal-stack-state :: 2026-09-10
SPEC: v1.0

## 0. SOURCES
- S1 — session `session_01Rra69yadrYYXx11Kc6dq8v`, 2026-06-19 → 2026-09-10, Claude Code remote on repo `Vagblasterxl/chanfana-openapi-template`
- S2 — repo files at head `9338c85`, branch `claude/add-powertoys-documentation-1hpSY`
- S3 — Cloudflare MCP read-only calls, 2026-07-08 and 2026-09-10

## 1. CLAIMS
[DOC](H){ACTIVE} Branch `claude/add-powertoys-documentation-1hpSY` head `9338c85`; tree clean; all session work pushed — src:S2 asof:2026-09-10
[DOC](H){ACTIVE} Build passes (`npx wrangler deploy --dry-run`) and 56/56 vitest tests pass — src:S1 asof:2026-07-08
[DOC](H){ACTIVE} File-based legal loop runs end-to-end: `ingest.mjs`, `assemble-package.mjs`, `suggest-statutes.mjs` — src:S1 asof:2026-07-08
[DOC](H){ACTIVE} `legal/ca-employment-law.json` holds 21 verified CA statutes; 5 workers_comp incl. Ins. Code §1871.4, Lab. Code §3820, §5814 — src:S2 asof:2026-09-10
[DOC](H) §5814 creates no civil cause of action; injured worker cannot sue carrier for bad faith (exclusive remedy, Lab. Code §3602); remedies = WCAB penalty + §1871.4 criminal referral — src:S1
[DOC](H) City of Moorpark (1998) 18 Cal.4th 1143: §132a is not exclusive — FEHA + Tameny stay open in civil court — src:S1
[DOC](H) Unruh (1972) 7 Cal.3d 616: carrier intentional torts during claim handling are civilly suable; Vacanti (2001) 24 Cal.4th 800 is the modern screen — src:S1
[DOC](H){ACTIVE} Live D1 `openapi-template-db` id `d7b93547-6fba-4766-afb3-7e39e6e36219` (Vagblasterxl acct `9e6e291db1bc4c877db80a30ff15e92c`) had migrations 0001–0005 applied + ledgered via MCP — src:S3 asof:2026-07-08
[DOC](H){CONFIG} `wrangler.jsonc` points at that DB; R2 binding commented out (R2 not enabled; `/sync/*` returns 501 without it) — src:S2 asof:2026-09-10
[DOC](M){CHANGED→OPEN} Sep credential set lists only hotmail `ab02f4dfa746bf2e6b3d9ff634bb135a` + Assblasterxl `81df6339f3528e9fc2802a9b25d2e423`; Vagblasterxl + Rogerdoger absent — deploy-target account currently unreachable — src:S3 asof:2026-09-10
[DOC](M){ACTIVE} Assblasterxl acct is real and separate: 14 workers (symphony-conductor/registry/api-gateway/broadcast/queue-processor) + 4 D1 incl. `symphony-core` — src:S3 asof:2026-09-10
[DOC](M){ACTIVE} Hotmail acct hosts captain-proton, extractor-bus, memory-bridge, knowledge-sphere, 41MB `agent-coordination-db`; `polar-mcp` modified 2026-07-04 — src:S3 asof:2026-07-08
[INFER](M) Operator's "assblasterxl@gmail" (July) referred to the real Assblasterxl account, not a typo for Vagblasterxl — the July deploy-target choice needs re-confirmation — src:S1,S3
[DOC](H){DEAD} Hardcoding MEM_API_KEY in tracked files — scrubbed at `f4509a8`; key burned (in git history), rotation at mem.ai unconfirmed — src:S1 asof:2026-07-08
[DOC](H){CONFIG} Secrets pattern: `.dev.vars` (gitignored) + `.dev.vars.example`; `API_KEY=symphony-ken-2026` stays (tests hardcode it) — src:S2
[DOC](H){CONFIG} Relay bus `relay/inbox/` JSON (`id,from,to,timestamp,type,subject,body,reply_to,status`) + `poll.sh`; never exercised by a second machine — src:S2 asof:2026-09-10
[DOC](H){CONFIG} Quad Commander AHK v2 pushed (`setup/scripts/quad-commander.ahk`): 4-agent prompt firing, `queue\` folder contract for external launcher; never run on Windows — src:S2 asof:2026-09-10
[DOC](M){OPEN} Antigravity mcpb-system (Python gRPC 50051/50052, 56 tests) exists only on operator's Windows machine; push to GitHub requested, never arrived — src:S1 asof:2026-09-10
[DOC](M){OPEN} PR creation blocked: GitHub App not enabled for session API access ("GitHub access is not enabled for this session") — src:S1 asof:2026-07-08
[DOC](M){OPEN} Trellis (CA court records MCP) requires OAuth in claude.ai connector settings — src:S1 asof:2026-09-10
[DOC](H){OPEN} Operator's real case facts (post-claim retaliation, adjuster lies) never ingested; `legal/data/*.json` are empty arrays — src:S2 asof:2026-09-10
[RECALL](M) Cloudflare billing dispute: hotmail account charged ~$36/mo across cards; operator card-less; R2 enablement triggers billing prompts — src:S1
[DOC](H) Container resets wipe local state; GitHub is the only durable store — one reset occurred mid-session and was recovered from remote — src:S1
[DOC](M){OPEN} Unmerged sibling branches carry parallel systems: `slack-session-VKAqM` (connectors, debate), `cloudflare-google-integration-HeGUL` (Oracle bus, Google endpoints) — src:S2 asof:2026-09-10

[RECALL](M){OPEN} Operator 2026-09-10: account sprawl stems from a "google domain fiasco" he is retreating from; `assblasterxl@gmail` + `kenwsimmons@hotmail.com` "got ate", then `sessybear@gmail.com` (a hotmail replacement) "got ate" too; Assblasterxl confirmed as his account; explicitly context-only — no cures/investigation until relevant — src:S1 asof:2026-09-10

## 2. COUNTER
Strongest case against this packet's thrust ("stack is finished, deploy is the last mile"): the stack has zero real payload and its deploy target may be phantom. No ramble of Ken's actual case was ever ingested; the relay has never carried a second machine's message; the AHK script never ran on Windows; and the account holding the prepared DB vanished from the credential set, while two OTHER symphony stacks (Assblasterxl's conductor stack, hotmail's swarm) already exist — plausibly the real center of gravity is there, and this repo is a third parallel build, not the keystone. Checked against: S3 account listings and S2 empty `legal/data/` — the counter stands as a live risk, not a refutation.

## 3. OPEN
- Which Cloudflare account is the intended deploy target now — Vagblasterxl (has the prepared DB) or Assblasterxl (in current credentials)?
- Did Ken rotate the Mem key?
- "I could various things launch them consecutively to different agents... an app that I'll get grok to build" — launcher app never delivered; queue contract awaits it.
- Antigravity push: did it ever happen under another repo/branch?

## 4. DISCARDED
- Full endpoint list, statute tables, case holdings — live in `CLAUDE.md`, `MASTER-SPEC.md`, `legal/*.md`; duplicating them here would exceed the cap.
- Mid-session MCP connect/disconnect churn — transient, no bearing on state.
- July Cloudflare inventories of Rogerdoger/Vagblasterxl worker lists beyond the deploy target — stale credentials make them unactionable.

## 5. HANDOFF
packet: symphony-legal-stack-state-2026-09-10
parents: none
target: next Claude instance on Vagblasterxl/chanfana-openapi-template
state: MERGE
blocker: deploy-target account absent from current credential set
next: confirm with Ken which account deploys (Vagblasterxl `9e6e291d…` vs Assblasterxl `81df6339…`), then run `npx wrangler deploy` there via a wrangler-authenticated machine


---

<!-- ===== SECTION 5 — source file: MASTER-SPEC.md ===== -->

# MASTER-SPEC — Symphony / Legal / Relay stack (final iterated form)

Emitted 2026-09-10 from session `session_01Rra69yadrYYXx11Kc6dq8v`. Companion
packet: `HANDOFF-PACKET.md` (CHUNK-SPEC v1.0 — read it for status/confidence
tags). This file is the RUNNABLE spec: every module, its exact contract, its
exact command. `CLAUDE.md` holds the full endpoint list; this file does not
duplicate it.

---

## 1. Topology (asof 2026-09-10)

- Repo: `Vagblasterxl/chanfana-openapi-template` · working branch
  `claude/add-powertoys-documentation-1hpSY` · head `9338c85` · all work pushed.
- Other remote branches (other sessions, unmerged): `claude/slack-session-VKAqM`
  (Slack/Discord/Polar connectors), `claude/cloudflare-google-integration-HeGUL`
  (Oracle bus, Google/Firebase/GitHub endpoints), `claude/create-claude-md-cloudflare-3Q1ZM`,
  `claude/claude-md-docs-i3n79s`.
- Cloudflare accounts seen across this session (credential set DRIFTS between
  sessions — re-check the MCP instructions header every session):

| account | id | seen |
|---|---|---|
| Kenwsimmons@hotmail.com | `ab02f4dfa746bf2e6b3d9ff634bb135a` | Jul + Sep (billing-disputed; hosts symphony-coordinator, captain-proton, extractor-bus, memory-bridge, 41MB `agent-coordination-db`) |
| Vagblasterxl@gmail.com | `9e6e291db1bc4c877db80a30ff15e92c` | Jul only — GONE from Sep credentials. Hosts the deploy target below. |
| Assblasterxl@gmail.com | `81df6339f3528e9fc2802a9b25d2e423` | Sep only. Own symphony-conductor/registry/gateway stack + `symphony-core` D1. |
| Rogerdoger6942013@gmail.com | `b9e6ff966ce74058f2481c1f67c9f3b0` | Jul only. Nearly empty. |

**Operator note (Ken, 2026-09-10, verbatim intent):** account sprawl came from a
"google domain fiasco" he is retreating from. `assblasterxl@gmail` +
`kenwsimmons@hotmail.com` "got ate"; `sessybear@gmail.com` (a replacement for
the hotmail account) recently "got ate" too. Assblasterxl is confirmed HIS
account. Do NOT investigate or attempt fixes — context only, until relevant.
(Session MCP credentials still reached Assblasterxl + hotmail on 2026-09-10;
"ate" ≠ necessarily unreachable. Both facts recorded, unreconciled.)

## 2. Module A — Worker API (`src/`)

Hono + Chanfana + D1. Endpoints in `CLAUDE.md`. Auth:
`Authorization: Bearer symphony-ken-2026` (dev/test token; rotate at real launch).

```bash
npm install
npx wrangler deploy --dry-run   # build check       (verified passing)
npm test                        # 56/56 vitest      (verified passing)
npx wrangler deploy             # NEEDS wrangler login on the target account
```

Deploy target (in `wrangler.jsonc`): DB `openapi-template-db`
id `d7b93547-6fba-4766-afb3-7e39e6e36219` on the **Vagblasterxl** account.
That live DB already has migrations 0001–0005 applied and ledgered (done
directly 2026-07-08); 12 tables ready. R2 binding is commented out on purpose
(R2 not enabled; enabling triggers the billing prompt; `/sync/*` returns 501
cleanly). A stale Feb-2026 build of this worker is already deployed there as
`chanfana-openapi-template` — deploying updates it in place.

## 3. Module B — File-based Legal loop (`legal/`) — works with zero infra

```bash
node legal/suggest-statutes.mjs --anchor <YYYY-MM-DD> "<ramble text>"  # rank statutes + SOL
node legal/ingest.mjs payload.json          # or pipe JSON via stdin
node legal/assemble-package.mjs --case-name "X" > legal/CASE-PACKAGE.md
git add legal/ && git commit -m "legal: ingest" && git push
```

Ingest payload contract (byte-exact, `extract` optional):

```json
{
  "raw_text": "the landlord never fixed the heater all winter",
  "source": "voice",
  "agent_id": "claude-desktop-lenovo",
  "extract": {
    "timeline":  [{ "date": "2026-01-03", "description": "...", "parties": ["Ken"], "significance": "..." }],
    "parties":   [{ "name": "Acme Properties", "role": "defendant", "description": "..." }],
    "evidence":  [{ "description": "text to landlord", "type": "message", "location": "phone", "supports_claim": "..." }],
    "claims":    [{ "claim_type": "breach of habitability", "statute": "CA Civ 1941.1", "statute_text": "...", "facts": ["..."] }],
    "deadlines": [{ "date": "2026-12-31", "description": "SOL for breach", "claim_id": "..." }]
  }
}
```

Party roles: `plaintiff|defendant|witness|counsel|judge|other`. Evidence types:
`document|photo|recording|message|contract|receipt|other`. Data lives in
`legal/data/{timeline,parties,evidence,claims,deadlines}.json` (append-only
arrays); raw dumps in `legal/rambles/`. Same shape as `POST /legal/ramble` —
lift-and-shift when the Worker deploys.

## 4. Module C — Legal content layer

- `legal/ca-employment-law.json` — 21 verified CA statutes. Entry fields:
  `id, category, code, title, covers, claim_keywords[], sol_years, sol_anchor,
  sol_note, procedural_note, source_url`. Categories:
  `wage_hour, retaliation, workers_comp (5), feha, wrongful_termination`.
- `legal/CA-EMPLOYMENT-LAW.md` — readable statutes + the adjuster-accountability
  section (Ins. Code §1871.4 criminal / Lab. Code §3820 penalty / §5814 WCAB
  delay penalty; worker cannot sue carrier for bad faith — exclusive remedy).
- `legal/CASE-LAW.md` — controlling cases + track table: §132a WCAB (1 yr,
  *Judson Steel*/*Lauher*), FEHA via CRD (3 yr, *Moorpark*), *Tameny* (2 yr),
  adjuster intentional-tort civil angle (*Unruh* shaped by *Vacanti*).
- Ken's actual case facts: **never ingested** — the pipeline is empty.

## 5. Module D — Claude↔Claude git relay (`relay/`)

Message = one JSON file in `relay/inbox/`, commit, push; receiver pulls.
Fields (byte-exact from seed message): `id, from, to, timestamp, type, subject,
body, reply_to, status`. Poll loop: `AGENT_ID=<name> ./relay/poll.sh [interval]`.
Processed messages move to `relay/archive/`.

## 6. Module E — Quad Commander (`setup/scripts/quad-commander.ahk`, AHK v2)

Fires a stored prompt into 4 agent chats (4 quadrant windows or 4 tabs).
Register: `Ctrl+Alt+Shift+1..4` (windows) or `Ctrl+Alt+Shift+0` (tab mode);
snap `Ctrl+Alt+Q`; fire next `Ctrl+Alt+Space`, direct `Ctrl+Alt+1..4`,
broadcast `Ctrl+Alt+A`; status `Ctrl+Alt+H`. Prompt source: `prompt.txt`
re-read every fire. **Launcher-app contract:** drop numbered `.txt` files into
`queue\` — oldest fires first, consumed files move to `queue\sent\`. Uses
Ctrl+Alt because `symphony-advanced-paste.ahk` owns Ctrl+Win. Not yet run on a
real Windows machine.

## 7. Module F — Automation Engine output contract

Agents acting as Automation Engines MUST emit JSON matching
`templates/automation/engine-template.json` (`symphony.automation-engine.v1`):
required `protocol_version:"1.0", agent_id, task{id,type,input}, status,
result{iosm_gates, red_team, svo_triples}` + `next_actions`. Conversational
responses are rejected.

## 8. Secrets policy

- `MEM_API_KEY` is **burned** (was committed; scrubbed at `f4509a8` but lives
  in git history). Rotate at mem.ai. Real value goes in `.dev.vars`
  (gitignored; template `.dev.vars.example`) or `npx wrangler secret put MEM_API_KEY`.
  Never in `wrangler.jsonc` or docs.
- `API_KEY=symphony-ken-2026` stays in `wrangler.jsonc` vars (tests hardcode it).

## 9. Open ledger (blockers, one line each)

1. Worker code deploy — needs wrangler login on the account holding
   `d7b93547-…` (Vagblasterxl; absent from Sep credential set). Desktop job.
2. Antigravity mcpb-system — never pushed to GitHub; push command in session
   history / give it: init repo, branch `antigravity-mcpb`, push.
3. Mem key rotation — unconfirmed.
4. PR for this branch — blocked: GitHub App not enabled for session API access.
5. Trellis (CA court records) — needs OAuth in claude.ai connector settings.
6. Ken's real case facts — not yet run through Module B.


---

<!-- ===== SECTION 6 — source file: setup/runbooks/CLOUDFLARE-ATTACH.md ===== -->

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


---

<!-- ===== SECTION 7 — source file: legal/INTAKE.md ===== -->

# Case Intake — fill this in, the machine does the rest

The legal pipeline is built but EMPTY. This sheet is the one missing input.
Fill in what you know (voice-dictate it, rough is fine — that's the point),
hand it to any Claude, and it runs: `suggest-statutes.mjs` → `ingest.mjs` →
`assemble-package.mjs` → lawyer-ready `CASE-PACKAGE.md` with a live SOL clock.

**Why this is urgent:** the §132a retaliation petition clock is **1 year from
the retaliatory act**, at the WCAB, and it's the shortest fuse in the case.
Until the dates below are in, nobody can compute how much of that year is left.

> Not legal advice. This organizes facts for an attorney — it doesn't replace one.

---

## 1. The anchor dates (the SOL clock runs off these — most important section)

- Date of injury: ____________
- Date you filed the workers' comp claim (DWC-1 form): ____________
- Date of EACH thing done to you after filing (firing / demotion / hours cut /
  write-up / schedule punishment — one line per event, with date): ____________
- If terminated: exact last day worked and how you were told: ____________
- Date of each adjuster lie / false statement / denial you know of: ____________

## 2. The players

- Your full legal name: ____________
- Employer legal name (check a paystub — exact wording): ____________
- Supervisor(s) involved, names + titles: ____________
- Workers' comp insurance carrier name: ____________
- Adjuster name(s) + claim number: ____________
- Any witnesses (coworkers who saw the treatment change): ____________

## 3. The injury & claim

- What happened / what's injured: ____________
- Current medical status (treating, restrictions, MMI?): ____________
- Benefits received so far, and any that stopped — with the date they stopped: ____________

## 4. The retaliation story (talk, don't write — ramble is fine)

How were you treated before the claim vs after? What exactly changed, when,
and who did it? Were non-injured coworkers treated differently in the same
situation? (*Lauher* makes that comparison the whole ballgame.)

## 5. The adjuster conduct

What did the adjuster say or do that was false? To whom? In writing or on the
phone? Did it delay or deny a payment? (Lies → §1871.4 fraud referral;
delays → §5814 penalty petition, 2 yrs from each missed payment.)

## 6. Evidence you have or can get

Texts, emails, write-ups, paystubs, schedules, voicemails, denial letters,
claim correspondence, photos — list each with where it lives (phone, email,
a drawer). Don't filter; "mentioned" is a valid status.

---

## For the Claude that receives this

1. `node legal/suggest-statutes.mjs --anchor <retaliation date> "<Ken's text>"`
2. Build the `extract` block (schema in `legal/README.md` / `MASTER-SPEC.md`),
   shortest deadlines first — the §132a 1-year clock leads.
3. `node legal/ingest.mjs payload.json` →
   `node legal/assemble-package.mjs --case-name "..." > legal/CASE-PACKAGE.md`
4. Commit + push. Read `legal/CASE-LAW.md` before advising on strategy.


---

<!-- ===== SECTION 8 — source file: relay/cards/GROK-BOT-CARD.md ===== -->

# STANDING ORDERS — Grok Bot (paste this whole card into the bot once)

You are `grok-bot` in Ken's fleet. The fleet's shared ground is one GitHub repo:
`https://github.com/Vagblasterxl/chanfana-openapi-template` — branch
`claude/add-powertoys-documentation-1hpSY` (merging to `main` soon).
Ken is not a developer. Never hand him commands. Hand him files and plain English.

## How you receive work
Read the message bus: every file in `relay/inbox/` is one JSON message with
`id, from, to, timestamp, type, subject, body, reply_to, status`. Anything
addressed to `grok-bot` or `all` is yours. Read it here (no login needed):
`https://api.github.com/repos/Vagblasterxl/chanfana-openapi-template/contents/relay/inbox?ref=claude/add-powertoys-documentation-1hpSY`
Read `FLEET-POCKET.md` (next to this card) once, for full context.

## How you send work back
If you can write to GitHub: create `relay/inbox/<YYYYMMDD>-<HHMMSS>-grok-bot-to-<target>.json`
in the same shape, `status: "unread"`. If you cannot: output the JSON in a code
block and tell Ken "drop this in relay/inbox". Never put API keys in a message.

## Your standing job: the Quad Commander launcher app
Ken fires prompts into four AI chats with a hotkey script (`setup/scripts/quad-commander.ahk`).
It reads a folder. Your app only has to WRITE that folder — nothing else:
- Write numbered plain-text files `01.txt`, `02.txt`, `03.txt`… into the
  `queue\` folder next to the script (one prompt per file).
- Oldest file fires first when Ken hits Ctrl+Alt+Space; `Ctrl+Alt+A` fires all.
- The script moves each file to `queue\sent\` after firing — never re-send one.
- UI: a text box, a "queue it" button, a list of what's waiting, phone-first,
  red error banner on failure, copy button on every output.
Full contract: `setup/scripts/quad-commander-README.md`.

## Report format (always end with this)
```
GROK-BOT REPORT · <date>
Did: <one line>
Made: <file names>
Blocked on Ken: <one line or none>
Next: <one line>
```


---

<!-- ===== SECTION 9 — source file: relay/cards/GEMINI-CARD.md ===== -->

# STANDING ORDERS — Gemini Spark / Gems (paste this whole card in once)

You are `gemini-spark` in Ken's fleet (a Gem uses `gemini-gem`). The fleet's
shared ground is one GitHub repo:
`https://github.com/Vagblasterxl/chanfana-openapi-template` — branch
`claude/add-powertoys-documentation-1hpSY`.
Ken is not a developer. Never hand him commands. Hand him files and plain English.

## How you receive work
Message bus = `relay/inbox/` JSON files (`id, from, to, timestamp, type,
subject, body, reply_to, status`). Anything to `gemini-spark` or `all` is yours:
`https://api.github.com/repos/Vagblasterxl/chanfana-openapi-template/contents/relay/inbox?ref=claude/add-powertoys-documentation-1hpSY`
Read `FLEET-POCKET.md` (next to this card) once, for full context.

## How you send work back
Write `relay/inbox/<YYYYMMDD>-<HHMMSS>-gemini-spark-to-<target>.json` if you can
reach GitHub; otherwise output the JSON block and tell Ken "drop this in
relay/inbox". Deliverable files go in a folder Ken names (default: Google Drive
`ANTIGRAV RUN/`), one file per task, named exactly as below. No API keys anywhere.

## Your two standing jobs (pull facts from THIS repo, do not reinvent)
1. **`d1_to_obsidian.py`** — reads a SQLite dump of the coordination database
   (tables in `migrations/0001`–`0005`: `agents, messages, coordination_state,
   knowledge_triples, legal_*`) and writes an Obsidian vault: one `.md` per
   row, `[[wikilinks]]` for every `subject`/`object` in `knowledge_triples`.
2. **`migrate_coordination_db.sql`** — ONE idempotent schema file that matches
   the five migration files exactly (`CREATE TABLE IF NOT EXISTS` /
   `CREATE INDEX IF NOT EXISTS`), with 5 rows of realistic mock data per table.
Both must run with zero config. Include a 3-line "how Ken runs it" at the top.

## Report format (always end with this)
```
GEMINI REPORT · <date>
Did: <one line>
Made: <file names + where>
Blocked on Ken: <one line or none>
Next: <one line>
```
