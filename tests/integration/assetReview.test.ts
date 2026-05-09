import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

// IOSM Governance + TDD Red Team review endpoint tests.
// /assets is unauthenticated, so no Authorization header needed.

async function createAsset(id: string) {
  const response = await SELF.fetch("http://local.test/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id,
      filename: `${id}.png`,
      asset_type: "image",
      status: "draft",
      version: 1,
      model: "imagen-3",
      provider: "vertex-ai",
      mcp_server: "mcp-imagen",
      prompt: "test prompt",
      local_path: `/tmp/${id}.png`,
      tags: null,
      parent_assets: null,
      child_assets: null,
    }),
  });
  return response;
}

const passingGates = {
  improve: { pass: true, notes: "Better than baseline" },
  optimize: { pass: true, notes: "Within size spec" },
  shrink: { pass: true, notes: "No bloat" },
  modularize: { pass: true, notes: "Reusable component" },
};

describe("IOSM + Red Team Asset Review", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should approve when all gates pass and red team passes", async () => {
    await createAsset("review-pass-1");

    const response = await SELF.fetch(
      "http://local.test/assets/review-pass-1/review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer: "claude-opus",
          gates: passingGates,
          red_team: { failure_cases: [] },
          auto_promote: true,
        }),
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json<{
      success: boolean;
      decision: string;
      next_status: string;
      red_team_passed: boolean;
    }>();
    expect(body.success).toBe(true);
    expect(body.decision).toBe("approve");
    expect(body.next_status).toBe("approved");
    expect(body.red_team_passed).toBe(true);
  });

  it("should reject when any IOSM gate fails", async () => {
    await createAsset("review-fail-iosm");

    const response = await SELF.fetch(
      "http://local.test/assets/review-fail-iosm/review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer: "claude-opus",
          gates: {
            ...passingGates,
            shrink: { pass: false, notes: "Bloated output" },
          },
          red_team: { failure_cases: [] },
          auto_promote: true,
        }),
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json<{
      decision: string;
      next_status: string;
    }>();
    expect(body.decision).toBe("reject");
    expect(body.next_status).toBe("draft");
  });

  it("should reject when red team triggers a failure", async () => {
    await createAsset("review-fail-redteam");

    const response = await SELF.fetch(
      "http://local.test/assets/review-fail-redteam/review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer: "claude-opus",
          gates: passingGates,
          red_team: {
            failure_cases: [
              {
                id: "rt-001",
                description: "Watermark present",
                triggered: true,
              },
            ],
          },
          auto_promote: true,
        }),
      },
    );
    expect(response.status).toBe(200);
    const body = await response.json<{
      decision: string;
      red_team_passed: boolean;
      triggered_failures: string[];
    }>();
    expect(body.decision).toBe("reject");
    expect(body.red_team_passed).toBe(false);
    expect(body.triggered_failures).toContain("rt-001");
  });

  it("should 404 on missing asset", async () => {
    const response = await SELF.fetch(
      "http://local.test/assets/nonexistent/review",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewer: "claude-opus",
          gates: passingGates,
          red_team: { failure_cases: [] },
          auto_promote: true,
        }),
      },
    );
    expect(response.status).toBe(404);
  });
});
