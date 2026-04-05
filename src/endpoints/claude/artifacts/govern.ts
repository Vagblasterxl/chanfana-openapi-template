import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";
import { promoteSchema, driftCheckSchema, mvtRunSchema, flagContaminationSchema, calculatePromotionRisk } from "./base";

// ============ PROMOTE / VALIDATE / REJECT / RETIRE ============
export class ArtifactPromote extends OpenAPIRoute {
  schema = {
    summary: "Promote, validate, reject, or retire an artifact",
    description: "Runs the Recovered Artifact Validation Gate. Cannot promote without passing MVT.",
    request: {
      params: z.object({ artifactId: z.string() }),
      body: {
        content: {
          "application/json": { schema: promoteSchema },
        },
      },
    },
    responses: {
      200: { description: "Action performed" },
      403: { description: "Validation gate failed" },
      404: { description: "Artifact not found" },
    },
  };

  async handle(c: AppContext) {
    const artifactId = c.req.param("artifactId");
    const body = await c.req.json();
    const data = promoteSchema.parse(body);
    const db = c.env.DB;
    const now = new Date().toISOString();

    const artifact = await db
      .prepare("SELECT * FROM artifacts WHERE artifact_id = ?")
      .bind(artifactId)
      .first();

    if (!artifact) {
      return c.json({ success: false, error: "Artifact not found" }, 404);
    }

    // === VALIDATION GATE ===
    const gateFailures: string[] = [];

    if (data.action === "promote") {
      // Gate: MVT must be passed
      if (artifact.mvt_status !== "passed") {
        gateFailures.push("MVT_NOT_PASSED: Minimum Viable Test must pass before promotion to canonical");
      }

      // Gate: Must have direct evidence
      if (!artifact.direct_evidence) {
        gateFailures.push("NO_EVIDENCE: Direct evidence required for canonical promotion");
      }

      // Gate: Drift check recommended for synthesised/hybrid
      if ((artifact.origin_class === "synthesised" || artifact.origin_class === "hybrid") && !artifact.drift_checked) {
        gateFailures.push("NO_DRIFT_CHECK: Synthesised/hybrid artifacts should be drift-checked before promotion");
      }

      // Gate: Name should be canonical
      if (artifact.name_status === "temporary") {
        gateFailures.push("TEMP_NAME: Artifact still has temporary name - consider canonicalizing first");
      }

      if (gateFailures.length > 0) {
        return c.json({
          success: false,
          error: "Validation gate failed",
          gate_failures: gateFailures,
        }, 403);
      }
    }

    // Map action to new canon_status
    const statusMap: Record<string, string> = {
      validate: "validated",
      promote: "canonical",
      reject: "rejected",
      retire: "retired",
    };

    const newStatus = statusMap[data.action];
    const previousStatus = artifact.canon_status as string;

    // Update artifact
    const updates: string[] = [`canon_status = '${newStatus}'`, `updated_at = ?`];
    const values: (string | null)[] = [now];

    if (data.action === "promote") {
      updates.push("promoted_at = ?", "promoted_by = ?", "name_status = 'canonical'");
      values.push(now, data.performed_by);
    }

    values.push(artifactId);
    await db
      .prepare(`UPDATE artifacts SET ${updates.join(", ")} WHERE artifact_id = ?`)
      .bind(...values)
      .run();

    // Log validation
    await db
      .prepare(`
        INSERT INTO artifact_validations (artifact_id, action, performed_by, reason, evidence, previous_status, new_status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        artifactId,
        data.action,
        data.performed_by,
        data.reason,
        data.evidence ? JSON.stringify(data.evidence) : null,
        previousStatus,
        newStatus,
        now
      )
      .run();

    return c.json({
      success: true,
      artifact_id: artifactId,
      action: data.action,
      previous_status: previousStatus,
      new_status: newStatus,
    });
  }
}

// ============ DRIFT CHECK ============
export class ArtifactDriftCheck extends OpenAPIRoute {
  schema = {
    summary: "Run forensic override drift check",
    description: "Assess whether an artifact shows signs of forensic override drift (AI substituting speculation for analysis)",
    request: {
      params: z.object({ artifactId: z.string() }),
      body: {
        content: {
          "application/json": { schema: driftCheckSchema },
        },
      },
    },
    responses: {
      200: { description: "Drift check recorded" },
      404: { description: "Artifact not found" },
    },
  };

  async handle(c: AppContext) {
    const artifactId = c.req.param("artifactId");
    const body = await c.req.json();
    const data = driftCheckSchema.parse(body);
    const db = c.env.DB;
    const now = new Date().toISOString();

    const artifact = await db
      .prepare("SELECT * FROM artifacts WHERE artifact_id = ?")
      .bind(artifactId)
      .first();

    if (!artifact) {
      return c.json({ success: false, error: "Artifact not found" }, 404);
    }

    // Recalculate promotion risk with drift score
    const newRisk = calculatePromotionRisk({
      origin_class: artifact.origin_class as string,
      has_mvt: !!artifact.minimum_viable_test,
      has_evidence: !!artifact.direct_evidence,
      drift_score: data.drift_score,
    });

    await db
      .prepare("UPDATE artifacts SET drift_checked = 1, drift_score = ?, drift_notes = ?, promotion_risk = ?, updated_at = ? WHERE artifact_id = ?")
      .bind(data.drift_score, data.notes, newRisk, now, artifactId)
      .run();

    // Auto-flag if high drift
    if (data.drift_score > 0.7) {
      await db
        .prepare(`
          INSERT INTO contamination_flags (artifact_id, pattern, severity, description, flagged_by, created_at)
          VALUES (?, 'forensic_override', 'critical', ?, ?, ?)
        `)
        .bind(artifactId, `High drift score (${data.drift_score}): ${data.notes}`, data.performed_by, now)
        .run();
    }

    // Log validation
    await db
      .prepare(`
        INSERT INTO artifact_validations (artifact_id, action, performed_by, reason, evidence, created_at)
        VALUES (?, 'drift_check', ?, ?, ?, ?)
      `)
      .bind(artifactId, data.performed_by, `Drift score: ${data.drift_score}`, JSON.stringify({ score: data.drift_score, notes: data.notes }), now)
      .run();

    return c.json({
      success: true,
      artifact_id: artifactId,
      drift_score: data.drift_score,
      promotion_risk: newRisk,
      auto_flagged: data.drift_score > 0.7,
    });
  }
}

// ============ MVT RUN ============
export class ArtifactMVTRun extends OpenAPIRoute {
  schema = {
    summary: "Record MVT result",
    description: "Record the result of running an artifact's Minimum Viable Test",
    request: {
      params: z.object({ artifactId: z.string() }),
      body: {
        content: {
          "application/json": { schema: mvtRunSchema },
        },
      },
    },
    responses: {
      200: { description: "MVT result recorded" },
      404: { description: "Artifact not found" },
      400: { description: "No MVT defined" },
    },
  };

  async handle(c: AppContext) {
    const artifactId = c.req.param("artifactId");
    const body = await c.req.json();
    const data = mvtRunSchema.parse(body);
    const db = c.env.DB;
    const now = new Date().toISOString();

    const artifact = await db
      .prepare("SELECT * FROM artifacts WHERE artifact_id = ?")
      .bind(artifactId)
      .first();

    if (!artifact) {
      return c.json({ success: false, error: "Artifact not found" }, 404);
    }

    if (!artifact.minimum_viable_test) {
      return c.json({ success: false, error: "No MVT defined for this artifact" }, 400);
    }

    const newMvtStatus = data.passed ? "passed" : "failed";

    await db
      .prepare("UPDATE artifacts SET mvt_status = ?, mvt_tested_at = ?, mvt_tested_by = ?, updated_at = ? WHERE artifact_id = ?")
      .bind(newMvtStatus, now, data.performed_by, now, artifactId)
      .run();

    // Log
    await db
      .prepare(`
        INSERT INTO artifact_validations (artifact_id, action, performed_by, reason, previous_status, new_status, created_at)
        VALUES (?, 'mvt_run', ?, ?, ?, ?, ?)
      `)
      .bind(artifactId, data.performed_by, data.notes || (data.passed ? "MVT passed" : "MVT failed"), artifact.mvt_status, newMvtStatus, now)
      .run();

    return c.json({
      success: true,
      artifact_id: artifactId,
      mvt_status: newMvtStatus,
      tested_by: data.performed_by,
    });
  }
}

// ============ FLAG CONTAMINATION ============
export class ArtifactFlagContamination extends OpenAPIRoute {
  schema = {
    summary: "Flag source contamination",
    description: "Flag an artifact for source contamination (saturation, project-to-protocol inflation, forensic override, retroactive canonisation)",
    request: {
      params: z.object({ artifactId: z.string() }),
      body: {
        content: {
          "application/json": { schema: flagContaminationSchema },
        },
      },
    },
    responses: {
      200: { description: "Contamination flagged" },
    },
  };

  async handle(c: AppContext) {
    const artifactId = c.req.param("artifactId");
    const body = await c.req.json();
    const data = flagContaminationSchema.parse(body);
    const db = c.env.DB;
    const now = new Date().toISOString();

    await db
      .prepare(`
        INSERT INTO contamination_flags (artifact_id, pattern, severity, description, flagged_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(artifactId, data.pattern, data.severity, data.description, data.flagged_by, now)
      .run();

    return c.json({
      success: true,
      artifact_id: artifactId,
      pattern: data.pattern,
      severity: data.severity,
    });
  }
}
