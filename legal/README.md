# Legal Case Builder — File-Based (No Server, No Credit Card)

This is the **Ramble Scrambler** running entirely on files in this repo. Same
data model as the Cloudflare Worker's `/legal/*` API, but it needs no server,
no database, and no billing. It runs on any machine with Node installed, and
any Claude instance that can reach this repo can use it.

> **Why files?** Cloudflare billing is on hold. GitHub is free and every Claude
> instance can already reach it. When the Worker comes back online, this same
> data lifts straight into D1 — nothing here is wasted.

## What's here

```
legal/
  data/
    timeline.json     ← dated events
    parties.json      ← people / orgs / entities
    evidence.json     ← documents, photos, messages, etc.
    claims.json       ← causes of action + statutes
    deadlines.json    ← statute-of-limitations clock
  rambles/            ← raw transcripts, one file per dump
  ca-employment-law.json  ← verified CA employment / workers' comp statute reference
  CA-EMPLOYMENT-LAW.md    ← readable version of the reference + sources
  suggest-statutes.mjs    ← match a ramble to candidate statutes + compute SOL
  ingest.mjs          ← raw ramble in → structured data out
  assemble-package.mjs← all data → one lawyer-ready markdown doc
  CASE-PACKAGE.md     ← the generated deliverable (after you run assemble)
```

**Focus:** California employment law — wage & hour, retaliation/whistleblower,
FEHA discrimination/harassment, wrongful termination, and workers' compensation
(including §132a retaliation). The statute reference is scoped to exactly that.

## How to use it (the whole loop)

### 1. Dump a ramble
Write what happened into a JSON file. The only required field is `raw_text` —
just talk. If a Claude has already structured it, include an `extract` block.

`my-ramble.json`:
```json
{
  "raw_text": "The heater broke Jan 3, I texted the landlord, he ignored me for months, then evicted me right after I complained to the city.",
  "source": "voice",
  "agent_id": "claude-desktop-lenovo",
  "extract": {
    "timeline":  [{ "date": "2026-01-03", "description": "Heater broke; texted landlord", "parties": ["Ken", "Landlord"] }],
    "parties":   [{ "name": "Ken Simmons", "role": "plaintiff" }],
    "evidence":  [{ "description": "Text to landlord Jan 3", "type": "message", "location": "phone" }],
    "claims":    [{ "claim_type": "retaliatory eviction", "statute": "CA Civil Code 1942.5", "facts": ["Eviction 2 weeks after city complaint"] }],
    "deadlines": [{ "date": "2026-12-31", "description": "SOL for the claim" }]
  }
}
```

Then:
```bash
node legal/ingest.mjs my-ramble.json
```

You can also pipe straight in:
```bash
echo '{"raw_text":"quick note about the case"}' | node legal/ingest.mjs
```

A ramble with **no** `extract` block just gets stored raw in `legal/rambles/`.
Any Claude can later read it, structure it, and re-ingest with the `extract`.

### 2. Build the case package
```bash
node legal/assemble-package.mjs --case-name "Simmons v. Acme Properties LLC" > legal/CASE-PACKAGE.md
```

`CASE-PACKAGE.md` is the deliverable: parties grouped by role, dated timeline,
numbered claims with statutes, evidence inventory table, a statute-of-limitations
clock with days-remaining, and an attorney intake checklist. Hand it to a lawyer
or use it as your own intake packet.

### 3. Commit so every machine has it
```bash
git add legal/ && git commit -m "legal: add ramble + rebuild package" && git push
```

Now any other Claude (other laptop, Desktop, web) pulls and has the whole case.

## How a Claude should work with this

When Ken pastes a raw ramble about the case, a Claude instance should:
1. Read it and pull out a clean `extract` block (timeline / parties / evidence /
   claims / deadlines).
2. Match real California statutes to each claim. Run the matcher first —
   `node legal/suggest-statutes.mjs --anchor <termination-or-injury-date> "<ramble>"`
   — then read `legal/CA-EMPLOYMENT-LAW.md` and keep only the statutes that
   genuinely fit. Put the SOL deadlines into `extract.deadlines`, shortest first
   (a §132a or workers'-comp injury clock is only **1 year** — it goes before any
   3-year wage clock).
3. Write it to a `*.json` payload and run `node legal/ingest.mjs`.
4. Run `node legal/assemble-package.mjs > legal/CASE-PACKAGE.md`.
5. Commit and push.

Controlled party roles: `plaintiff`, `defendant`, `witness`, `counsel`, `judge`, `other`.
Evidence types: `document`, `photo`, `recording`, `message`, `contract`, `receipt`, `other`.

**Not legal advice. Every statute citation must be verified independently.**

## Upgrading later (free → free → paid, your choice)

- **Now:** these files (free, works today).
- **Free Google backend:** mirror `ingest`/`assemble` into a Google Apps Script
  Web App that writes to a Sheet/Drive — Google-hosted, no card.
- **Cloudflare Worker:** when billing is sorted, `POST /legal/ramble` and
  `GET /legal/package` do the same thing over a real API. The data model is
  identical, so migration is a copy.
