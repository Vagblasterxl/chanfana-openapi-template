import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

const API_KEY = "symphony-ken-2026";
const auth = { Authorization: `Bearer ${API_KEY}` };
const jsonHeaders = { "Content-Type": "application/json", ...auth };

describe("SVO Knowledge Extraction Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /knowledge/extract", () => {
    it("should store a single triple", async () => {
      const response = await SELF.fetch(
        "http://local.test/knowledge/extract",
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            agent_id: "claude-opus",
            source_asset: "img-20260218-001",
            triples: [
              {
                subject: "claude-opus",
                verb: "generated",
                object: "img-20260218-001",
                context: { model: "imagen-3", prompt: "test" },
              },
            ],
          }),
        },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        stored: number;
        triple_ids: string[];
      }>();
      expect(body.success).toBe(true);
      expect(body.stored).toBe(1);
      expect(body.triple_ids).toHaveLength(1);
      expect(body.triple_ids[0]).toMatch(/^svo-/);
    });

    it("should store multiple triples in one call", async () => {
      const response = await SELF.fetch(
        "http://local.test/knowledge/extract",
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            agent_id: "claude-opus",
            source_task: "task-20260606-batch",
            triples: [
              { subject: "vid-001", verb: "derived", object: "img-001" },
              { subject: "vid-001", verb: "references", object: "score-001" },
              { subject: "claude-opus", verb: "composed", object: "vid-001" },
            ],
          }),
        },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        stored: number;
        triple_ids: string[];
      }>();
      expect(body.stored).toBe(3);
      expect(body.triple_ids).toHaveLength(3);
    });

    it("should require auth", async () => {
      const response = await SELF.fetch(
        "http://local.test/knowledge/extract",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: "test",
            triples: [
              { subject: "a", verb: "created", object: "b" },
            ],
          }),
        },
      );
      expect(response.status).toBe(401);
    });
  });

  describe("GET /knowledge/query", () => {
    it("should return triples filtered by subject", async () => {
      // Seed data
      await SELF.fetch("http://local.test/knowledge/extract", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          agent_id: "claude-opus",
          triples: [
            { subject: "query-test-agent", verb: "generated", object: "asset-x" },
            { subject: "query-test-agent", verb: "approved", object: "asset-y" },
            { subject: "other-agent", verb: "created", object: "asset-z" },
          ],
        }),
      });

      const response = await SELF.fetch(
        "http://local.test/knowledge/query?subject=query-test-agent",
        { headers: auth },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        count: number;
        triples: any[];
      }>();
      expect(body.success).toBe(true);
      expect(body.count).toBe(2);
      for (const t of body.triples) {
        expect(t.subject).toBe("query-test-agent");
      }
    });

    it("should filter by verb", async () => {
      await SELF.fetch("http://local.test/knowledge/extract", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          agent_id: "test",
          triples: [
            { subject: "a1", verb: "supersedes", object: "b1" },
            { subject: "a2", verb: "extends", object: "b2" },
          ],
        }),
      });

      const response = await SELF.fetch(
        "http://local.test/knowledge/query?verb=supersedes",
        { headers: auth },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        count: number;
        triples: any[];
      }>();
      expect(body.count).toBeGreaterThanOrEqual(1);
      for (const t of body.triples) {
        expect(t.verb).toBe("supersedes");
      }
    });

    it("should return all triples with no filters", async () => {
      const response = await SELF.fetch(
        "http://local.test/knowledge/query",
        { headers: auth },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        count: number;
        triples: any[];
      }>();
      expect(body.success).toBe(true);
      expect(body.count).toBeGreaterThanOrEqual(0);
    });
  });

  describe("GET /knowledge/graph/:entity", () => {
    it("should return graph neighborhood for an entity", async () => {
      // Seed: entity-hub connects to multiple things
      await SELF.fetch("http://local.test/knowledge/extract", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          agent_id: "test",
          triples: [
            { subject: "graph-hub", verb: "generated", object: "graph-child-1" },
            { subject: "graph-hub", verb: "created", object: "graph-child-2" },
            { subject: "graph-parent", verb: "delegated", object: "graph-hub" },
          ],
        }),
      });

      const response = await SELF.fetch(
        "http://local.test/knowledge/graph/graph-hub",
        { headers: auth },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        entity: string;
        as_subject: any[];
        as_object: any[];
        related_entities: string[];
      }>();
      expect(body.success).toBe(true);
      expect(body.entity).toBe("graph-hub");
      expect(body.as_subject.length).toBeGreaterThanOrEqual(2);
      expect(body.as_object.length).toBeGreaterThanOrEqual(1);
      expect(body.related_entities).toContain("graph-child-1");
      expect(body.related_entities).toContain("graph-parent");
    });

    it("should return empty graph for unknown entity", async () => {
      const response = await SELF.fetch(
        "http://local.test/knowledge/graph/nonexistent-entity",
        { headers: auth },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        entity: string;
        as_subject: any[];
        as_object: any[];
        related_entities: string[];
      }>();
      expect(body.entity).toBe("nonexistent-entity");
      expect(body.as_subject).toHaveLength(0);
      expect(body.as_object).toHaveLength(0);
      expect(body.related_entities).toHaveLength(0);
    });
  });
});
