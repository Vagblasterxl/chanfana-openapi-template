import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";
import { pushToMem } from "../../lib/mem";

export class RambleIngest extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Legal"],
    summary: "Ingest a raw ramble transcript",
    description:
      "Accepts raw voice transcript or text dump. Stores it and extracts " +
      "timeline events, parties, evidence mentions, and legal claims. " +
      "The Ramble Scrambler: talk into your phone, structured case file comes out.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              raw_text: z
                .string()
                .min(1)
                .describe("Raw transcript or text dump — unedited ramble is fine"),
              source: z
                .enum(["voice", "text", "paste", "ocr", "email"])
                .default("voice")
                .describe("How this text was captured"),
              agent_id: z
                .string()
                .optional()
                .describe("Which agent is submitting this ramble"),
              extract: z
                .object({
                  timeline: z
                    .array(
                      z.object({
                        date: z.string().optional().describe("ISO date or natural language date"),
                        description: z.string(),
                        parties: z.array(z.string()).optional(),
                        significance: z.string().optional(),
                      }),
                    )
                    .optional()
                    .describe("Pre-extracted timeline events (if agent already parsed)"),
                  parties: z
                    .array(
                      z.object({
                        name: z.string(),
                        role: z.string().describe("plaintiff, defendant, witness, counsel, judge, other"),
                        description: z.string().optional(),
                      }),
                    )
                    .optional(),
                  evidence: z
                    .array(
                      z.object({
                        description: z.string(),
                        type: z.string().default("document").describe("document, photo, recording, message, contract, receipt, other"),
                        location: z.string().optional().describe("Where this evidence lives"),
                        supports_claim: z.string().optional(),
                      }),
                    )
                    .optional(),
                  claims: z
                    .array(
                      z.object({
                        claim_type: z.string().describe("e.g. breach of contract, negligence, habitability"),
                        statute: z.string().optional().describe("e.g. CA Civil Code 1942.5"),
                        statute_text: z.string().optional(),
                        facts: z.array(z.string()).optional(),
                      }),
                    )
                    .optional(),
                  deadlines: z
                    .array(
                      z.object({
                        date: z.string(),
                        description: z.string(),
                        claim_id: z.string().optional(),
                      }),
                    )
                    .optional(),
                })
                .optional()
                .describe("Pre-extracted structured data. If omitted, raw text is stored for later processing."),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Ramble ingested and extracted",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              ramble_id: z.string(),
              extracted: z.object({
                timeline_events: z.number(),
                parties: z.number(),
                evidence_items: z.number(),
                claims: z.number(),
                deadlines: z.number(),
              }),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body;
    const db = c.env.DB;
    const now = new Date().toISOString();
    const ts = Date.now();
    const rnd = () => Math.random().toString(36).slice(2, 8);

    const rambleId = `ramble-${ts}-${rnd()}`;
    const counts = { timeline_events: 0, parties: 0, evidence_items: 0, claims: 0, deadlines: 0 };

    await db
      .prepare(
        `INSERT INTO legal_rambles (id, raw_text, source, agent_id, processed, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(rambleId, body.raw_text, body.source, body.agent_id ?? null, body.extract ? 1 : 0, now)
      .run();

    if (body.extract) {
      const ex = body.extract;

      if (ex.timeline) {
        for (const evt of ex.timeline) {
          const id = `evt-${ts}-${rnd()}`;
          await db
            .prepare(
              `INSERT INTO legal_timeline (id, ramble_id, event_date, event_description, parties_involved, significance, created_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
            )
            .bind(id, rambleId, evt.date ?? null, evt.description, JSON.stringify(evt.parties ?? []), evt.significance ?? null, now)
            .run();
          counts.timeline_events++;
        }
      }

      if (ex.parties) {
        for (const p of ex.parties) {
          const id = `party-${ts}-${rnd()}`;
          await db
            .prepare(
              `INSERT INTO legal_parties (id, name, role, description, first_mentioned_in, created_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
            )
            .bind(id, p.name, p.role, p.description ?? null, rambleId, now)
            .run();
          counts.parties++;
        }
      }

      if (ex.evidence) {
        for (const e of ex.evidence) {
          const id = `evid-${ts}-${rnd()}`;
          await db
            .prepare(
              `INSERT INTO legal_evidence (id, ramble_id, description, evidence_type, location, status, supports_claim, created_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
            )
            .bind(id, rambleId, e.description, e.type, e.location ?? null, "mentioned", e.supports_claim ?? null, now)
            .run();
          counts.evidence_items++;
        }
      }

      if (ex.claims) {
        for (const cl of ex.claims) {
          const id = `claim-${ts}-${rnd()}`;
          await db
            .prepare(
              `INSERT INTO legal_claims (id, claim_type, statute, statute_text, facts_supporting, status, created_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
            )
            .bind(id, cl.claim_type, cl.statute ?? null, cl.statute_text ?? null, JSON.stringify(cl.facts ?? []), "identified", now)
            .run();
          counts.claims++;
        }
      }

      if (ex.deadlines) {
        for (const d of ex.deadlines) {
          const id = `dl-${ts}-${rnd()}`;
          await db
            .prepare(
              `INSERT INTO legal_deadlines (id, deadline_date, description, claim_id, status, created_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
            )
            .bind(id, d.date, d.description, d.claim_id ?? null, "pending", now)
            .run();
          counts.deadlines++;
        }
      }
    }

    const memKey = c.env.MEM_API_KEY as string | undefined;
    if (memKey) {
      const preview = body.raw_text.length > 500 ? body.raw_text.slice(0, 500) + "..." : body.raw_text;
      const memContent = [
        `# Legal Ramble Ingested`,
        ``,
        `**ID**: ${rambleId}`,
        `**Source**: ${body.source}`,
        `**Agent**: ${body.agent_id ?? "unknown"}`,
        `**Extracted**: ${counts.timeline_events} events, ${counts.parties} parties, ${counts.evidence_items} evidence, ${counts.claims} claims, ${counts.deadlines} deadlines`,
        ``,
        `## Preview`,
        preview,
        ``,
        `#symphony #legal #ramble`,
      ].join("\n");
      c.executionCtx.waitUntil(pushToMem(memKey, memContent));
    }

    return { success: true, ramble_id: rambleId, extracted: counts };
  }
}
