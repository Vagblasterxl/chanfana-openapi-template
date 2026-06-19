import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";
import { pushToMem } from "../../lib/mem";

interface Row {
  [key: string]: unknown;
}

function safeParse(json: unknown): unknown[] {
  if (typeof json !== "string") return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export class CasePackage extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Legal"],
    summary: "Assemble the full case package (markdown)",
    description:
      "Pulls timeline, parties, evidence, claims, and deadlines into one " +
      "lawyer-ready document. This is the deliverable: hand it to an attorney " +
      "or use it as your own intake packet. Optionally pushes a copy to Mem.",
    request: {
      query: z.object({
        push_to_mem: z
          .enum(["true", "false"])
          .optional()
          .describe("Also save the assembled package to Mem.ai"),
        case_name: z
          .string()
          .optional()
          .describe("Title for the package, e.g. 'Simmons v. Landlord'"),
      }),
    },
    responses: {
      "200": {
        description: "Assembled case package",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              case_name: z.string(),
              generated_at: z.string(),
              stats: z.object({
                timeline_events: z.number(),
                parties: z.number(),
                evidence_items: z.number(),
                claims: z.number(),
                deadlines: z.number(),
              }),
              markdown: z.string(),
              pushed_to_mem: z.boolean(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const caseName = data.query.case_name ?? "Case Package";
    const pushMem = data.query.push_to_mem === "true";
    const db = c.env.DB;
    const generatedAt = new Date().toISOString();

    const [timeline, parties, evidence, claims, deadlines] = await Promise.all([
      db.prepare(`SELECT * FROM legal_timeline ORDER BY event_date ASC, created_at ASC`).all(),
      db.prepare(`SELECT * FROM legal_parties ORDER BY role ASC, created_at ASC`).all(),
      db.prepare(`SELECT * FROM legal_evidence ORDER BY created_at ASC`).all(),
      db.prepare(`SELECT * FROM legal_claims ORDER BY created_at ASC`).all(),
      db.prepare(`SELECT * FROM legal_deadlines ORDER BY deadline_date ASC`).all(),
    ]);

    const tRows = timeline.results as Row[];
    const pRows = parties.results as Row[];
    const eRows = evidence.results as Row[];
    const cRows = claims.results as Row[];
    const dRows = deadlines.results as Row[];

    const lines: string[] = [];
    lines.push(`# ${caseName}`, ``, `*Generated ${generatedAt}*`, ``);
    lines.push(`> Auto-assembled case package. This is a working draft for attorney`);
    lines.push(`> review — not legal advice. Verify every citation independently.`, ``);

    // Parties
    lines.push(`## Parties`, ``);
    if (pRows.length === 0) {
      lines.push(`_No parties recorded yet._`, ``);
    } else {
      const byRole = new Map<string, Row[]>();
      for (const p of pRows) {
        const role = String(p.role ?? "other");
        if (!byRole.has(role)) byRole.set(role, []);
        byRole.get(role)!.push(p);
      }
      for (const [role, group] of byRole) {
        lines.push(`### ${role.charAt(0).toUpperCase() + role.slice(1)}`, ``);
        for (const p of group) {
          const desc = p.description ? ` — ${p.description}` : "";
          lines.push(`- **${p.name}**${desc}`);
        }
        lines.push(``);
      }
    }

    // Timeline
    lines.push(`## Timeline of Events`, ``);
    if (tRows.length === 0) {
      lines.push(`_No timeline events recorded yet._`, ``);
    } else {
      for (const e of tRows) {
        const date = e.event_date ? `**${e.event_date}**` : "**(undated)**";
        lines.push(`- ${date} — ${e.event_description}`);
        const involved = safeParse(e.parties_involved);
        if (involved.length > 0) {
          lines.push(`  - Parties: ${involved.join(", ")}`);
        }
        if (e.significance) {
          lines.push(`  - Significance: ${e.significance}`);
        }
      }
      lines.push(``);
    }

    // Claims
    lines.push(`## Legal Claims / Causes of Action`, ``);
    if (cRows.length === 0) {
      lines.push(`_No claims identified yet._`, ``);
    } else {
      let n = 1;
      for (const cl of cRows) {
        lines.push(`### ${n}. ${cl.claim_type}`, ``);
        if (cl.statute) lines.push(`- **Statute**: ${cl.statute}`);
        if (cl.statute_text) lines.push(`- **Statute text**: ${cl.statute_text}`);
        lines.push(`- **Status**: ${cl.status}`);
        const facts = safeParse(cl.facts_supporting);
        if (facts.length > 0) {
          lines.push(`- **Supporting facts**:`);
          for (const f of facts) lines.push(`  - ${f}`);
        }
        const ev = safeParse(cl.evidence_refs);
        if (ev.length > 0) {
          lines.push(`- **Evidence**: ${ev.join(", ")}`);
        }
        lines.push(``);
        n++;
      }
    }

    // Evidence
    lines.push(`## Evidence Inventory`, ``);
    if (eRows.length === 0) {
      lines.push(`_No evidence recorded yet._`, ``);
    } else {
      lines.push(`| Description | Type | Status | Location | Supports |`);
      lines.push(`|---|---|---|---|---|`);
      for (const e of eRows) {
        lines.push(
          `| ${e.description} | ${e.evidence_type} | ${e.status} | ${e.location ?? "—"} | ${e.supports_claim ?? "—"} |`,
        );
      }
      lines.push(``);
    }

    // Deadlines
    lines.push(`## Deadlines & Statute of Limitations`, ``);
    if (dRows.length === 0) {
      lines.push(`_No deadlines recorded yet._`, ``);
    } else {
      const today = new Date();
      lines.push(`| Date | Description | Days Remaining | Status |`);
      lines.push(`|---|---|---|---|`);
      for (const d of dRows) {
        const parsed = new Date(String(d.deadline_date));
        let remaining = "—";
        if (!Number.isNaN(parsed.getTime())) {
          const days = Math.ceil((parsed.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          remaining = days < 0 ? `PASSED (${Math.abs(days)}d ago)` : `${days}d`;
        }
        lines.push(`| ${d.deadline_date} | ${d.description} | ${remaining} | ${d.status} |`);
      }
      lines.push(``);
    }

    // Attorney intake checklist
    lines.push(`## Attorney Intake — Open Questions`, ``);
    lines.push(`- [ ] Which claims have the strongest evidence?`);
    lines.push(`- [ ] Are all statutes of limitations still open?`);
    lines.push(`- [ ] What evidence still needs to be secured?`);
    lines.push(`- [ ] Estimated damages?`);
    lines.push(`- [ ] Jurisdiction and venue?`);
    lines.push(``);

    const markdown = lines.join("\n");
    const stats = {
      timeline_events: tRows.length,
      parties: pRows.length,
      evidence_items: eRows.length,
      claims: cRows.length,
      deadlines: dRows.length,
    };

    let pushedToMem = false;
    const memKey = c.env.MEM_API_KEY as string | undefined;
    if (pushMem && memKey) {
      const memDoc = `${markdown}\n\n#symphony #legal #casepackage`;
      c.executionCtx.waitUntil(pushToMem(memKey, memDoc));
      pushedToMem = true;
    }

    return {
      success: true,
      case_name: caseName,
      generated_at: generatedAt,
      stats,
      markdown,
      pushed_to_mem: pushedToMem,
    };
  }
}
