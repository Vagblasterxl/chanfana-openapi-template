#!/usr/bin/env node
// assemble-package.mjs — Build the lawyer-ready case package from the JSON
// data files. Same output as the Worker's GET /legal/package, but reads files
// instead of a database. No server, no card.
//
// Usage:
//   node legal/assemble-package.mjs > legal/CASE-PACKAGE.md
//   node legal/assemble-package.mjs --case-name "Simmons v. Acme" > legal/CASE-PACKAGE.md

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");

function load(name) {
  try {
    return JSON.parse(readFileSync(join(DATA, `${name}.json`), "utf8"));
  } catch {
    return [];
  }
}

function caseName() {
  const i = process.argv.indexOf("--case-name");
  if (i !== -1 && process.argv[i + 1]) return process.argv[i + 1];
  return "Case Package";
}

function main() {
  const name = caseName();
  const generatedAt = new Date().toISOString();
  const timeline = load("timeline");
  const parties = load("parties");
  const evidence = load("evidence");
  const claims = load("claims");
  const deadlines = load("deadlines");

  const L = [];
  L.push(`# ${name}`, ``, `*Generated ${generatedAt}*`, ``);
  L.push(`> Auto-assembled case package. This is a working draft for attorney`);
  L.push(`> review — not legal advice. Verify every citation independently.`, ``);

  // Parties (grouped by role)
  L.push(`## Parties`, ``);
  if (parties.length === 0) {
    L.push(`_No parties recorded yet._`, ``);
  } else {
    const byRole = new Map();
    for (const p of parties) {
      const role = p.role || "other";
      if (!byRole.has(role)) byRole.set(role, []);
      byRole.get(role).push(p);
    }
    for (const [role, group] of byRole) {
      L.push(`### ${role.charAt(0).toUpperCase() + role.slice(1)}`, ``);
      for (const p of group) {
        const desc = p.description ? ` — ${p.description}` : "";
        L.push(`- **${p.name}**${desc}`);
      }
      L.push(``);
    }
  }

  // Timeline
  L.push(`## Timeline of Events`, ``);
  if (timeline.length === 0) {
    L.push(`_No timeline events recorded yet._`, ``);
  } else {
    const sorted = [...timeline].sort((a, b) =>
      String(a.event_date ?? "").localeCompare(String(b.event_date ?? "")),
    );
    for (const e of sorted) {
      const date = e.event_date ? `**${e.event_date}**` : "**(undated)**";
      L.push(`- ${date} — ${e.event_description}`);
      const involved = Array.isArray(e.parties_involved) ? e.parties_involved : [];
      if (involved.length > 0) L.push(`  - Parties: ${involved.join(", ")}`);
      if (e.significance) L.push(`  - Significance: ${e.significance}`);
    }
    L.push(``);
  }

  // Claims
  L.push(`## Legal Claims / Causes of Action`, ``);
  if (claims.length === 0) {
    L.push(`_No claims identified yet._`, ``);
  } else {
    let n = 1;
    for (const c of claims) {
      L.push(`### ${n}. ${c.claim_type}`, ``);
      if (c.statute) L.push(`- **Statute**: ${c.statute}`);
      if (c.statute_text) L.push(`- **Statute text**: ${c.statute_text}`);
      L.push(`- **Status**: ${c.status}`);
      const facts = Array.isArray(c.facts_supporting) ? c.facts_supporting : [];
      if (facts.length > 0) {
        L.push(`- **Supporting facts**:`);
        for (const f of facts) L.push(`  - ${f}`);
      }
      const ev = Array.isArray(c.evidence_refs) ? c.evidence_refs : [];
      if (ev.length > 0) L.push(`- **Evidence**: ${ev.join(", ")}`);
      L.push(``);
      n++;
    }
  }

  // Evidence
  L.push(`## Evidence Inventory`, ``);
  if (evidence.length === 0) {
    L.push(`_No evidence recorded yet._`, ``);
  } else {
    L.push(`| Description | Type | Status | Location | Supports |`);
    L.push(`|---|---|---|---|---|`);
    for (const e of evidence) {
      L.push(
        `| ${e.description} | ${e.evidence_type} | ${e.status} | ${e.location ?? "—"} | ${e.supports_claim ?? "—"} |`,
      );
    }
    L.push(``);
  }

  // Deadlines / SOL clock
  L.push(`## Deadlines & Statute of Limitations`, ``);
  if (deadlines.length === 0) {
    L.push(`_No deadlines recorded yet._`, ``);
  } else {
    const today = new Date();
    const sorted = [...deadlines].sort((a, b) =>
      String(a.deadline_date).localeCompare(String(b.deadline_date)),
    );
    L.push(`| Date | Description | Days Remaining | Status |`);
    L.push(`|---|---|---|---|`);
    for (const d of sorted) {
      const parsed = new Date(String(d.deadline_date));
      let remaining = "—";
      if (!Number.isNaN(parsed.getTime())) {
        const days = Math.ceil((parsed.getTime() - today.getTime()) / 86400000);
        remaining = days < 0 ? `PASSED (${Math.abs(days)}d ago)` : `${days}d`;
      }
      L.push(`| ${d.deadline_date} | ${d.description} | ${remaining} | ${d.status} |`);
    }
    L.push(``);
  }

  // Attorney intake checklist
  L.push(`## Attorney Intake — Open Questions`, ``);
  L.push(`- [ ] Which claims have the strongest evidence?`);
  L.push(`- [ ] Are all statutes of limitations still open?`);
  L.push(`- [ ] What evidence still needs to be secured?`);
  L.push(`- [ ] Estimated damages?`);
  L.push(`- [ ] Jurisdiction and venue?`);
  L.push(``);

  process.stdout.write(L.join("\n"));
}

main();
