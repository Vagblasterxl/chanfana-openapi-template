#!/usr/bin/env node
// ingest.mjs — File-based Ramble Scrambler.
// Same data model as the Worker's POST /legal/ramble, but writes JSON files
// instead of hitting a database. No server, no credit card, works on any
// machine with Node. Any Claude that can reach this repo can run it.
//
// Usage:
//   node legal/ingest.mjs path/to/payload.json
//   echo '{"raw_text":"..."}' | node legal/ingest.mjs
//
// Payload shape (extract is optional — omit it to just store the raw ramble):
// {
//   "raw_text": "the landlord never fixed the heater all winter",
//   "source": "voice",
//   "agent_id": "claude-desktop-lenovo",
//   "extract": {
//     "timeline":  [{ "date": "2026-01-03", "description": "...", "parties": ["Ken"], "significance": "..." }],
//     "parties":   [{ "name": "Acme Properties", "role": "defendant", "description": "..." }],
//     "evidence":  [{ "description": "text to landlord", "type": "message", "location": "phone", "supports_claim": "..." }],
//     "claims":    [{ "claim_type": "breach of habitability", "statute": "CA Civ 1941.1", "statute_text": "...", "facts": ["..."] }],
//     "deadlines": [{ "date": "2026-12-31", "description": "SOL for breach", "claim_id": "..." }]
//   }
// }

import { readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");
const RAMBLES = join(HERE, "rambles");

const ts = Date.now();
let seq = 0;
const id = (prefix) => `${prefix}-${ts}-${(seq++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function load(name) {
  try {
    return JSON.parse(readFileSync(join(DATA, `${name}.json`), "utf8"));
  } catch {
    return [];
  }
}
function save(name, arr) {
  writeFileSync(join(DATA, `${name}.json`), JSON.stringify(arr, null, 2) + "\n");
}

function readInput() {
  const argPath = process.argv[2];
  if (argPath) return readFileSync(argPath, "utf8");
  return readFileSync(0, "utf8"); // stdin
}

function main() {
  const raw = readInput().trim();
  if (!raw) {
    console.error("No input. Pass a JSON file path or pipe JSON to stdin.");
    process.exit(1);
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    console.error("Input is not valid JSON:", e.message);
    process.exit(1);
  }

  if (!payload.raw_text || typeof payload.raw_text !== "string") {
    console.error("Payload must include a non-empty 'raw_text' string.");
    process.exit(1);
  }

  mkdirSync(DATA, { recursive: true });
  mkdirSync(RAMBLES, { recursive: true });

  const now = new Date().toISOString();
  const rambleId = id("ramble");
  const source = payload.source || "voice";
  const agentId = payload.agent_id || "unknown";
  const ex = payload.extract;

  // Persist the raw ramble verbatim
  const rambleFile = join(RAMBLES, `${rambleId}.json`);
  writeFileSync(
    rambleFile,
    JSON.stringify(
      { id: rambleId, raw_text: payload.raw_text, source, agent_id: agentId, processed: !!ex, created_at: now },
      null,
      2,
    ) + "\n",
  );

  const counts = { timeline_events: 0, parties: 0, evidence_items: 0, claims: 0, deadlines: 0 };

  if (ex) {
    if (Array.isArray(ex.timeline)) {
      const arr = load("timeline");
      for (const e of ex.timeline) {
        arr.push({
          id: id("evt"),
          ramble_id: rambleId,
          event_date: e.date ?? null,
          event_description: e.description,
          parties_involved: e.parties ?? [],
          significance: e.significance ?? null,
          created_at: now,
        });
        counts.timeline_events++;
      }
      save("timeline", arr);
    }

    if (Array.isArray(ex.parties)) {
      const arr = load("parties");
      for (const p of ex.parties) {
        arr.push({
          id: id("party"),
          name: p.name,
          role: p.role,
          description: p.description ?? null,
          first_mentioned_in: rambleId,
          created_at: now,
        });
        counts.parties++;
      }
      save("parties", arr);
    }

    if (Array.isArray(ex.evidence)) {
      const arr = load("evidence");
      for (const e of ex.evidence) {
        arr.push({
          id: id("evid"),
          ramble_id: rambleId,
          description: e.description,
          evidence_type: e.type ?? "document",
          location: e.location ?? null,
          status: "mentioned",
          supports_claim: e.supports_claim ?? null,
          created_at: now,
        });
        counts.evidence_items++;
      }
      save("evidence", arr);
    }

    if (Array.isArray(ex.claims)) {
      const arr = load("claims");
      for (const c of ex.claims) {
        arr.push({
          id: id("claim"),
          claim_type: c.claim_type,
          statute: c.statute ?? null,
          statute_text: c.statute_text ?? null,
          facts_supporting: c.facts ?? [],
          evidence_refs: c.evidence_refs ?? [],
          status: "identified",
          created_at: now,
        });
        counts.claims++;
      }
      save("claims", arr);
    }

    if (Array.isArray(ex.deadlines)) {
      const arr = load("deadlines");
      for (const d of ex.deadlines) {
        arr.push({
          id: id("dl"),
          deadline_date: d.date,
          description: d.description,
          claim_id: d.claim_id ?? null,
          status: "pending",
          created_at: now,
        });
        counts.deadlines++;
      }
      save("deadlines", arr);
    }
  }

  console.log(`Ingested ramble ${rambleId}`);
  console.log(
    `  ${counts.timeline_events} events, ${counts.parties} parties, ` +
      `${counts.evidence_items} evidence, ${counts.claims} claims, ${counts.deadlines} deadlines`,
  );
  console.log(`  raw saved to legal/rambles/${rambleId}.json`);
  console.log(`\nNext: node legal/assemble-package.mjs > legal/CASE-PACKAGE.md`);
}

main();
