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
