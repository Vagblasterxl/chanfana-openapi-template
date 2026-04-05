import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";
import { createArtifactSchema, generateArtifactId, calculatePromotionRisk } from "./base";

export class ArtifactCreate extends OpenAPIRoute {
  schema = {
    summary: "Create an artifact",
    description: "Create a new artifact with origin classification, evidence attribution, and optional MVT. Auto-calculates promotion risk.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: createArtifactSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Artifact created",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              artifact_id: z.string(),
              name: z.string(),
              origin_class: z.string(),
              canon_status: z.string(),
              promotion_risk: z.string(),
              warnings: z.array(z.string()),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = createArtifactSchema.parse(body);
    const db = c.env.DB;
    const artifactId = generateArtifactId();
    const now = new Date().toISOString();

    // Governance warnings
    const warnings: string[] = [];

    if (!data.minimum_viable_test) {
      warnings.push("NO_MVT: Artifact has no Minimum Viable Test - cannot be promoted to canonical without one");
    }

    if (!data.direct_evidence || data.direct_evidence.length === 0) {
      warnings.push("NO_EVIDENCE: No direct evidence provided - promotion risk elevated");
    }

    if (data.name_status === "canonical" && !data.minimum_viable_test) {
      warnings.push("PREMATURE_CANON: Cannot use canonical name without passing MVT - forced to temporary");
      data.name_status = "temporary";
    }

    // Auto-calculate promotion risk
    const promotionRisk = calculatePromotionRisk({
      origin_class: data.origin_class,
      has_mvt: !!data.minimum_viable_test,
      has_evidence: !!data.direct_evidence && data.direct_evidence.length > 0,
    });

    await db
      .prepare(`
        INSERT INTO artifacts
        (artifact_id, name, name_status, origin_class, origin_source, origin_agent,
         direct_evidence, inferred_extension, promotion_risk,
         minimum_viable_test, mvt_expected_outcome, mvt_falsification,
         content_type, content, summary, tags,
         session_id, priority, parent_artifact_id,
         canon_status, mvt_status, version,
         created_at, updated_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', 'untested', 1, ?, ?, ?)
      `)
      .bind(
        artifactId,
        data.name,
        data.name_status,
        data.origin_class,
        data.origin_source || null,
        data.origin_agent || null,
        data.direct_evidence ? JSON.stringify(data.direct_evidence) : null,
        data.inferred_extension || null,
        promotionRisk,
        data.minimum_viable_test || null,
        data.mvt_expected_outcome || null,
        data.mvt_falsification || null,
        data.content_type,
        data.content,
        data.summary || null,
        data.tags ? JSON.stringify(data.tags) : null,
        data.session_id || null,
        data.priority,
        data.parent_artifact_id || null,
        now,
        now,
        data.metadata ? JSON.stringify(data.metadata) : null
      )
      .run();

    // Log the creation
    await db
      .prepare(`
        INSERT INTO artifact_validations (artifact_id, action, performed_by, reason, new_status, created_at)
        VALUES (?, 'propose', ?, 'Initial creation', 'proposed', ?)
      `)
      .bind(artifactId, data.origin_agent || "system", now)
      .run();

    return c.json({
      success: true,
      artifact_id: artifactId,
      name: data.name,
      origin_class: data.origin_class,
      canon_status: "proposed",
      promotion_risk: promotionRisk,
      warnings,
    });
  }
}
