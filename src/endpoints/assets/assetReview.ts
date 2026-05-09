import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

/**
 * IOSM Governance + TDD Red Team review endpoint.
 *
 * Runs an asset through the four IOSM gates (Improve, Optimize, Shrink,
 * Modularize) plus the Red Team failure-case checks. Records gate results
 * to the asset's tags field (JSON-encoded) and updates status accordingly.
 *
 * See: .agent/protocols/system-protocols.md
 */

const gateResult = z.object({
  pass: z.boolean(),
  notes: z.string().optional(),
});

const failureCase = z.object({
  id: z.string(),
  description: z.string(),
  triggered: z.boolean(),
});

export class AssetReview extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Assets"],
    summary: "Run IOSM Governance + TDD Red Team review on an asset",
    description:
      "Submits gate decisions for an asset. All four IOSM gates must pass " +
      "AND zero red_team failure cases may be triggered for the asset to " +
      "be auto-promoted from draft to approved.",
    request: {
      params: z.object({
        id: z.string().describe("Asset ID"),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              reviewer: z
                .string()
                .describe("Agent ID performing the review"),
              gates: z.object({
                improve: gateResult,
                optimize: gateResult,
                shrink: gateResult,
                modularize: gateResult,
              }),
              red_team: z.object({
                failure_cases: z.array(failureCase),
              }),
              auto_promote: z
                .boolean()
                .default(true)
                .describe(
                  "If true and all checks pass, sets asset status to 'approved'",
                ),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Review recorded",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              asset_id: z.string(),
              decision: z.enum(["approve", "reject"]),
              next_status: z.string(),
              gates: z.object({
                improve: gateResult,
                optimize: gateResult,
                shrink: gateResult,
                modularize: gateResult,
              }),
              red_team_passed: z.boolean(),
              triggered_failures: z.array(z.string()),
            }),
          },
        },
      },
      "404": {
        description: "Asset not found",
        content: {
          "application/json": {
            schema: z.object({ success: Bool(), error: z.string() }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const { id } = data.params;
    const body = data.body;
    const db = c.env.DB;

    // Verify asset exists
    const asset = await db
      .prepare(`SELECT id, status FROM assets WHERE id = ?1`)
      .bind(id)
      .first();

    if (!asset) {
      return c.json(
        { success: false, error: `Asset ${id} not found` },
        404,
      );
    }

    // Run gate logic
    const gates = body.gates;
    const allGatesPass =
      gates.improve.pass &&
      gates.optimize.pass &&
      gates.shrink.pass &&
      gates.modularize.pass;

    const triggeredFailures = body.red_team.failure_cases
      .filter((f) => f.triggered)
      .map((f) => f.id);
    const redTeamPassed = triggeredFailures.length === 0;

    const decision: "approve" | "reject" =
      allGatesPass && redTeamPassed ? "approve" : "reject";

    // Determine next status
    const nextStatus =
      decision === "approve" && body.auto_promote ? "approved" : "draft";

    // Record review payload as JSON in the tags field (or extend schema later).
    // The full review object is stored as a single JSON blob alongside any
    // existing tags, separated by a delimiter.
    const reviewPayload = {
      reviewed_at: new Date().toISOString(),
      reviewer: body.reviewer,
      gates,
      red_team: {
        failure_cases: body.red_team.failure_cases,
        approved: redTeamPassed,
      },
      decision,
    };
    const reviewJson = JSON.stringify(reviewPayload);
    const now = new Date().toISOString();

    if (body.auto_promote && decision === "approve") {
      await db
        .prepare(
          `UPDATE assets SET status = ?1, updated_at = ?2,
             tags = COALESCE(tags || char(31), '') || ?3
           WHERE id = ?4`,
        )
        .bind(nextStatus, now, "review:" + reviewJson, id)
        .run();
    } else {
      await db
        .prepare(
          `UPDATE assets SET updated_at = ?1,
             tags = COALESCE(tags || char(31), '') || ?2
           WHERE id = ?3`,
        )
        .bind(now, "review:" + reviewJson, id)
        .run();
    }

    return {
      success: true,
      asset_id: id,
      decision,
      next_status: nextStatus,
      gates,
      red_team_passed: redTeamPassed,
      triggered_failures: triggeredFailures,
    };
  }
}
