#!/usr/bin/env node
// suggest-statutes.mjs — Match rambled text or a claim type to candidate
// California employment / workers' comp statutes, and (optionally) compute the
// statute-of-limitations deadline from an anchor date.
//
// Usage:
//   node legal/suggest-statutes.mjs "they fired me right after I filed a workers comp claim"
//   node legal/suggest-statutes.mjs "unpaid overtime and no lunch breaks"
//   node legal/suggest-statutes.mjs --anchor 2026-04-24 "fired after my injury"
//   echo "hostile work environment and slurs" | node legal/suggest-statutes.mjs
//
// Output: ranked matches with code, what it covers, SOL window, and — if an
// anchor date is given — the computed deadline and days remaining.
//
// NOT legal advice. Always verify the statute and deadline with an attorney.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const REF = join(HERE, "ca-employment-law.json");

function loadRef() {
  return JSON.parse(readFileSync(REF, "utf8")).statutes;
}

function parseArgs() {
  const args = process.argv.slice(2);
  let anchor = null;
  const text = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--anchor") {
      anchor = args[++i];
    } else {
      text.push(args[i]);
    }
  }
  let query = text.join(" ").trim();
  if (!query) {
    try {
      query = readFileSync(0, "utf8").trim();
    } catch {
      /* no stdin */
    }
  }
  return { anchor, query };
}

function score(statute, query) {
  const q = query.toLowerCase();
  let s = 0;
  const hits = [];
  for (const kw of statute.claim_keywords) {
    if (q.includes(kw.toLowerCase())) {
      s += kw.split(" ").length; // multi-word keyword = stronger signal
      hits.push(kw);
    }
  }
  // Title words as a weak secondary signal
  for (const word of statute.title.toLowerCase().split(/\W+/)) {
    if (word.length > 4 && q.includes(word)) s += 0.5;
  }
  return { score: s, hits };
}

function computeDeadline(statute, anchorStr) {
  if (!anchorStr || statute.sol_years == null) return null;
  const anchor = new Date(anchorStr);
  if (Number.isNaN(anchor.getTime())) return null;
  const deadline = new Date(anchor);
  deadline.setFullYear(deadline.getFullYear() + statute.sol_years);
  const today = new Date();
  const days = Math.ceil((deadline.getTime() - today.getTime()) / 86400000);
  return { deadline: deadline.toISOString().slice(0, 10), days };
}

function main() {
  const { anchor, query } = parseArgs();
  if (!query) {
    console.error('Pass some text. e.g. node legal/suggest-statutes.mjs "fired after workers comp claim"');
    process.exit(1);
  }

  const ref = loadRef();
  const ranked = ref
    .map((st) => ({ st, ...score(st, query) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  if (ranked.length === 0) {
    console.log("No statute matched by keyword. Read legal/CA-EMPLOYMENT-LAW.md and match by hand.");
    return;
  }

  console.log(`Query: "${query}"`);
  if (anchor) console.log(`Anchor date: ${anchor}`);
  console.log(`\n${ranked.length} candidate statute(s):\n`);

  for (const r of ranked) {
    const st = r.st;
    console.log(`▸ ${st.code} — ${st.title}`);
    console.log(`  ${st.covers}`);
    console.log(`  Matched on: ${r.hits.join(", ") || "(title)"}`);
    console.log(`  SOL: ${st.sol_years == null ? "see note" : st.sol_years + " year(s)"} — ${st.sol_note}`);
    if (st.procedural_note) console.log(`  Procedure: ${st.procedural_note}`);
    const dl = computeDeadline(st, anchor);
    if (dl) {
      const flag = dl.days < 0 ? "⚠️ PASSED" : dl.days <= 60 ? "⚠️ URGENT" : "";
      console.log(`  >> Deadline from ${anchor}: ${dl.deadline} (${dl.days} days remaining) ${flag}`);
    }
    console.log("");
  }

  console.log("NOT legal advice. Verify every citation and deadline with an attorney —");
  console.log("SOL rules have exceptions (tolling, continuing violation, CRD/WCAB prerequisites).");
}

main();
