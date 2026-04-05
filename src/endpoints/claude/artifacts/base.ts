import { z } from "zod";

export const originClasses = z.enum(["recovered", "synthesised", "hybrid", "imported"]);
export const nameStatuses = z.enum(["temporary", "canonical"]);
export const canonStatuses = z.enum(["proposed", "validated", "canonical", "rejected", "retired"]);
export const mvtStatuses = z.enum(["untested", "passed", "failed", "blocked"]);
export const promotionRisks = z.enum(["low", "medium", "high"]);
export const contentTypes = z.enum(["text", "json", "code", "schema", "protocol"]);
export const contaminationPatterns = z.enum(["source_saturation", "project_to_protocol", "forensic_override", "retroactive_canon"]);

// ============ ARTIFACT SCHEMA ============
export const artifact = z.object({
  id: z.number().int(),
  artifact_id: z.string(),
  name: z.string(),
  name_status: nameStatuses,
  origin_class: originClasses,
  origin_source: z.string().nullable().optional(),
  origin_agent: z.string().nullable().optional(),
  direct_evidence: z.string().nullable().optional(),
  inferred_extension: z.string().nullable().optional(),
  promotion_risk: promotionRisks,
  minimum_viable_test: z.string().nullable().optional(),
  mvt_expected_outcome: z.string().nullable().optional(),
  mvt_falsification: z.string().nullable().optional(),
  mvt_status: mvtStatuses,
  mvt_tested_at: z.string().nullable().optional(),
  mvt_tested_by: z.string().nullable().optional(),
  canon_status: canonStatuses,
  promoted_at: z.string().nullable().optional(),
  promoted_by: z.string().nullable().optional(),
  drift_checked: z.number().int().default(0),
  drift_score: z.number().nullable().optional(),
  drift_notes: z.string().nullable().optional(),
  content_type: contentTypes,
  content: z.string(),
  summary: z.string().nullable().optional(),
  tags: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(),
  priority: z.number().int().default(0),
  version: z.number().int().default(1),
  parent_artifact_id: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  metadata: z.string().nullable().optional(),
});

export const ArtifactModel = {
  tableName: "artifacts",
  primaryKeys: ["id"],
  schema: artifact,
  serializer: (obj: Record<string, string | number | boolean>) => obj,
};

// ============ REQUEST SCHEMAS ============
export const createArtifactSchema = z.object({
  name: z.string().min(1),
  name_status: nameStatuses.default("temporary"),
  origin_class: originClasses,
  origin_source: z.string().optional(),
  origin_agent: z.string().optional(),
  direct_evidence: z.array(z.string()).optional(),
  inferred_extension: z.string().optional(),
  minimum_viable_test: z.string().optional(),
  mvt_expected_outcome: z.string().optional(),
  mvt_falsification: z.string().optional(),
  content_type: contentTypes.default("text"),
  content: z.string().min(1),
  summary: z.string().optional(),
  tags: z.array(z.string()).optional(),
  session_id: z.string().optional(),
  priority: z.number().int().default(0),
  parent_artifact_id: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const promoteSchema = z.object({
  action: z.enum(["validate", "promote", "reject", "retire"]),
  performed_by: z.string().min(1),
  reason: z.string().min(1),
  evidence: z.array(z.string()).optional(),
});

export const driftCheckSchema = z.object({
  performed_by: z.string().min(1),
  drift_score: z.number().min(0).max(1),
  notes: z.string(),
});

export const mvtRunSchema = z.object({
  performed_by: z.string().min(1),
  passed: z.boolean(),
  notes: z.string().optional(),
});

export const flagContaminationSchema = z.object({
  pattern: contaminationPatterns,
  severity: z.enum(["info", "warning", "critical"]).default("warning"),
  description: z.string(),
  flagged_by: z.string().min(1),
});

export function generateArtifactId(): string {
  return `art_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Promotion risk auto-calculator
export function calculatePromotionRisk(data: {
  origin_class: string;
  has_mvt: boolean;
  has_evidence: boolean;
  drift_score?: number;
}): "low" | "medium" | "high" {
  let risk = 0;

  // Synthesised/hybrid = higher risk
  if (data.origin_class === "synthesised") risk += 2;
  if (data.origin_class === "hybrid") risk += 1;

  // No MVT = higher risk
  if (!data.has_mvt) risk += 2;

  // No evidence = higher risk
  if (!data.has_evidence) risk += 1;

  // High drift score = higher risk
  if (data.drift_score !== undefined && data.drift_score > 0.5) risk += 2;

  if (risk >= 4) return "high";
  if (risk >= 2) return "medium";
  return "low";
}
