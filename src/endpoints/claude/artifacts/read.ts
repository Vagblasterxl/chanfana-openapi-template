import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

export class ArtifactRead extends OpenAPIRoute {
  schema = {
    summary: "Get artifact by ID",
    description: "Retrieve a full artifact with all governance fields",
    request: {
      params: z.object({
        artifactId: z.string(),
      }),
    },
    responses: {
      200: { description: "Artifact found" },
      404: { description: "Artifact not found" },
    },
  };

  async handle(c: AppContext) {
    const artifactId = c.req.param("artifactId");
    const db = c.env.DB;

    const artifact = await db
      .prepare("SELECT * FROM artifacts WHERE artifact_id = ?")
      .bind(artifactId)
      .first();

    if (!artifact) {
      return c.json({ success: false, error: "Artifact not found" }, 404);
    }

    // Get validation history
    const validations = await db
      .prepare("SELECT * FROM artifact_validations WHERE artifact_id = ? ORDER BY created_at DESC")
      .bind(artifactId)
      .all();

    // Get contamination flags
    const flags = await db
      .prepare("SELECT * FROM contamination_flags WHERE artifact_id = ? ORDER BY created_at DESC")
      .bind(artifactId)
      .all();

    return c.json({
      success: true,
      artifact: {
        ...artifact,
        direct_evidence: artifact.direct_evidence ? JSON.parse(artifact.direct_evidence as string) : [],
        tags: artifact.tags ? JSON.parse(artifact.tags as string) : [],
        metadata: artifact.metadata ? JSON.parse(artifact.metadata as string) : null,
      },
      validations: validations.results || [],
      contamination_flags: flags.results || [],
    });
  }
}

export class ArtifactList extends OpenAPIRoute {
  schema = {
    summary: "List artifacts",
    description: "List artifacts with filters for origin, canon status, MVT status",
    request: {
      query: z.object({
        origin_class: z.string().optional(),
        canon_status: z.string().optional(),
        mvt_status: z.string().optional(),
        name_status: z.string().optional(),
        origin_agent: z.string().optional(),
        tag: z.string().optional(),
        limit: z.coerce.number().int().default(50),
      }),
    },
    responses: {
      200: { description: "Artifacts list" },
    },
  };

  async handle(c: AppContext) {
    const query = c.req.query();
    const db = c.env.DB;

    let sql = "SELECT artifact_id, name, name_status, origin_class, canon_status, mvt_status, promotion_risk, drift_score, summary, created_at FROM artifacts WHERE 1=1";
    const params: string[] = [];

    if (query.origin_class) {
      sql += " AND origin_class = ?";
      params.push(query.origin_class);
    }
    if (query.canon_status) {
      sql += " AND canon_status = ?";
      params.push(query.canon_status);
    }
    if (query.mvt_status) {
      sql += " AND mvt_status = ?";
      params.push(query.mvt_status);
    }
    if (query.name_status) {
      sql += " AND name_status = ?";
      params.push(query.name_status);
    }
    if (query.origin_agent) {
      sql += " AND origin_agent = ?";
      params.push(query.origin_agent);
    }
    if (query.tag) {
      sql += " AND tags LIKE ?";
      params.push(`%"${query.tag}"%`);
    }

    const limit = parseInt(query.limit || "50");
    sql += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const artifacts = await db.prepare(sql).bind(...params).all();

    return c.json({
      success: true,
      artifacts: artifacts.results || [],
      count: artifacts.results?.length || 0,
    });
  }
}
