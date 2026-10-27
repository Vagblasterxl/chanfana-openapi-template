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
