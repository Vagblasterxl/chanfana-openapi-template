import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

const API_KEY = "symphony-ken-2026";
const auth = { Authorization: `Bearer ${API_KEY}` };
const jsonHeaders = { "Content-Type": "application/json", ...auth };

describe("Legal — Ramble Scrambler Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /legal/ramble", () => {
    it("should ingest a raw ramble with no extraction", async () => {
      const response = await SELF.fetch("http://local.test/legal/ramble", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          raw_text: "So basically the landlord never fixed the heater all winter long.",
          source: "voice",
          agent_id: "claude-opus",
        }),
      });
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        ramble_id: string;
        extracted: Record<string, number>;
      }>();
      expect(body.success).toBe(true);
      expect(body.ramble_id).toMatch(/^ramble-/);
      expect(body.extracted.timeline_events).toBe(0);
    });

    it("should ingest a ramble with full structured extraction", async () => {
      const response = await SELF.fetch("http://local.test/legal/ramble", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          raw_text: "The heater broke on Jan 3, I told the landlord, he ignored me for months.",
          source: "voice",
          agent_id: "claude-opus",
          extract: {
            timeline: [
              {
                date: "2026-01-03",
                description: "Heater stopped working",
                parties: ["Ken", "Landlord"],
                significance: "Start of habitability violation",
              },
            ],
            parties: [
              { name: "Ken Simmons", role: "plaintiff" },
              { name: "Acme Properties", role: "defendant", description: "Property management co" },
            ],
            evidence: [
              { description: "Text message to landlord", type: "message", location: "phone" },
            ],
            claims: [
              {
                claim_type: "breach of warranty of habitability",
                statute: "CA Civil Code 1941.1",
                facts: ["No heat for 3 months"],
              },
            ],
            deadlines: [
              { date: "2026-12-31", description: "Statute of limitations for breach" },
            ],
          },
        }),
      });
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        extracted: Record<string, number>;
      }>();
      expect(body.success).toBe(true);
      expect(body.extracted.timeline_events).toBe(1);
      expect(body.extracted.parties).toBe(2);
      expect(body.extracted.evidence_items).toBe(1);
      expect(body.extracted.claims).toBe(1);
      expect(body.extracted.deadlines).toBe(1);
    });

    it("should require auth", async () => {
      const response = await SELF.fetch("http://local.test/legal/ramble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_text: "test" }),
      });
      expect(response.status).toBe(401);
    });
  });

  describe("GET /legal/rambles", () => {
    it("should list rambles", async () => {
      await SELF.fetch("http://local.test/legal/ramble", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ raw_text: "List test ramble", source: "text" }),
      });
      const response = await SELF.fetch("http://local.test/legal/rambles", {
        headers: auth,
      });
      expect(response.status).toBe(200);
      const body = await response.json<{ success: boolean; count: number; rambles: any[] }>();
      expect(body.success).toBe(true);
      expect(body.count).toBeGreaterThanOrEqual(1);
    });

    it("should filter to unprocessed rambles", async () => {
      await SELF.fetch("http://local.test/legal/ramble", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ raw_text: "Unprocessed dump, no extract" }),
      });
      const response = await SELF.fetch(
        "http://local.test/legal/rambles?unprocessed=true",
        { headers: auth },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{ success: boolean; rambles: any[] }>();
      for (const r of body.rambles) {
        expect(r.processed).toBe(0);
      }
    });
  });

  describe("GET /legal/timeline", () => {
    it("should return timeline events ordered by date", async () => {
      await SELF.fetch("http://local.test/legal/ramble", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          raw_text: "timeline seed",
          extract: {
            timeline: [
              { date: "2026-02-01", description: "Second event" },
              { date: "2026-01-01", description: "First event" },
            ],
          },
        }),
      });
      const response = await SELF.fetch("http://local.test/legal/timeline", {
        headers: auth,
      });
      expect(response.status).toBe(200);
      const body = await response.json<{ success: boolean; count: number; events: any[] }>();
      expect(body.success).toBe(true);
      expect(body.count).toBeGreaterThanOrEqual(2);
    });
  });

  describe("GET /legal/parties", () => {
    it("should list parties and filter by role", async () => {
      await SELF.fetch("http://local.test/legal/ramble", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          raw_text: "party seed",
          extract: {
            parties: [
              { name: "Witness Jane", role: "witness" },
              { name: "Defendant Co", role: "defendant" },
            ],
          },
        }),
      });
      const response = await SELF.fetch(
        "http://local.test/legal/parties?role=witness",
        { headers: auth },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{ success: boolean; parties: any[] }>();
      for (const p of body.parties) {
        expect(p.role).toBe("witness");
      }
    });
  });

  describe("GET /legal/evidence", () => {
    it("should list evidence", async () => {
      await SELF.fetch("http://local.test/legal/ramble", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          raw_text: "evidence seed",
          extract: {
            evidence: [{ description: "Lease agreement", type: "contract" }],
          },
        }),
      });
      const response = await SELF.fetch("http://local.test/legal/evidence", {
        headers: auth,
      });
      expect(response.status).toBe(200);
      const body = await response.json<{ success: boolean; count: number; evidence: any[] }>();
      expect(body.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("POST + GET /legal/claims", () => {
    it("should upsert a claim with researched statute", async () => {
      const create = await SELF.fetch("http://local.test/legal/claims", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          claim_type: "retaliatory eviction",
          statute: "CA Civil Code 1942.5",
          statute_text: "A lessor may not retaliate against a lessee...",
          facts_supporting: ["Eviction filed 2 weeks after complaint"],
          status: "researched",
        }),
      });
      expect(create.status).toBe(200);
      const created = await create.json<{ success: boolean; claim_id: string }>();
      expect(created.success).toBe(true);
      expect(created.claim_id).toMatch(/^claim-/);

      // Update the same claim
      const update = await SELF.fetch("http://local.test/legal/claims", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          id: created.claim_id,
          claim_type: "retaliatory eviction",
          status: "supported",
        }),
      });
      expect(update.status).toBe(200);

      const list = await SELF.fetch("http://local.test/legal/claims", {
        headers: auth,
      });
      const body = await list.json<{ claims: any[] }>();
      const found = body.claims.find((c) => c.id === created.claim_id);
      expect(found).toBeDefined();
      expect(found.status).toBe("supported");
    });
  });

  describe("POST + GET /legal/deadlines", () => {
    it("should create a deadline and compute days remaining", async () => {
      const future = new Date();
      future.setDate(future.getDate() + 10);
      const futureStr = future.toISOString().slice(0, 10);

      const create = await SELF.fetch("http://local.test/legal/deadlines", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          deadline_date: futureStr,
          description: "File complaint",
        }),
      });
      expect(create.status).toBe(200);

      const list = await SELF.fetch("http://local.test/legal/deadlines", {
        headers: auth,
      });
      expect(list.status).toBe(200);
      const body = await list.json<{ success: boolean; deadlines: any[] }>();
      const found = body.deadlines.find((d) => d.description === "File complaint");
      expect(found).toBeDefined();
      expect(found.days_remaining).toBeGreaterThan(0);
      expect(["critical", "soon", "ok"]).toContain(found.urgency);
    });
  });

  describe("GET /legal/package", () => {
    it("should assemble a full case package as markdown", async () => {
      // Seed a complete mini-case
      await SELF.fetch("http://local.test/legal/ramble", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          raw_text: "package seed",
          extract: {
            timeline: [{ date: "2026-03-01", description: "Lease signed" }],
            parties: [{ name: "Pkg Plaintiff", role: "plaintiff" }],
            evidence: [{ description: "Signed lease", type: "contract" }],
            claims: [{ claim_type: "breach of contract", statute: "CA Civ 1550" }],
          },
        }),
      });

      const response = await SELF.fetch(
        "http://local.test/legal/package?case_name=Test+v.+Defendant",
        { headers: auth },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        case_name: string;
        markdown: string;
        stats: Record<string, number>;
        pushed_to_mem: boolean;
      }>();
      expect(body.success).toBe(true);
      expect(body.case_name).toBe("Test v. Defendant");
      expect(body.markdown).toContain("# Test v. Defendant");
      expect(body.markdown).toContain("## Timeline of Events");
      expect(body.markdown).toContain("## Legal Claims");
      expect(body.markdown).toContain("## Evidence Inventory");
      expect(body.stats.timeline_events).toBeGreaterThanOrEqual(1);
      expect(body.pushed_to_mem).toBe(false);
    });
  });
});
