import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";

export class PreprocessorStatus extends OpenAPIRoute {
  schema = {
    summary: "Get job status",
    description: "Check the status of a preprocessing job by job_id",
    request: {
      params: z.object({
        jobId: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Job status",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              job: z.object({
                job_id: z.string(),
                preprocessor: z.string(),
                mode: z.string(),
                status: z.string(),
                result: z.string().nullable(),
                error_message: z.string().nullable(),
                tokens_used: z.number().nullable(),
                processing_time_ms: z.number().nullable(),
                output_channel: z.string(),
                created_at: z.string(),
                completed_at: z.string().nullable(),
              }),
            }),
          },
        },
      },
      404: {
        description: "Job not found",
      },
    },
  };

  async handle(c: AppContext) {
    const jobId = c.req.param("jobId");
    const db = c.env.DB;

    const job = await db
      .prepare("SELECT * FROM preprocessor_jobs WHERE job_id = ?")
      .bind(jobId)
      .first();

    if (!job) {
      return c.json({ success: false, error: "Job not found" }, 404);
    }

    return c.json({
      success: true,
      job: {
        job_id: job.job_id,
        preprocessor: job.preprocessor,
        mode: job.mode,
        status: job.status,
        result: job.result,
        error_message: job.error_message,
        tokens_used: job.tokens_used,
        processing_time_ms: job.processing_time_ms,
        output_channel: job.output_channel,
        created_at: job.created_at,
        completed_at: job.completed_at,
      },
    });
  }
}

export class PreprocessorList extends OpenAPIRoute {
  schema = {
    summary: "List recent jobs",
    description: "List preprocessing jobs with optional filters",
    request: {
      query: z.object({
        status: z.string().optional(),
        preprocessor: z.string().optional(),
        limit: z.coerce.number().int().default(20),
      }),
    },
    responses: {
      200: {
        description: "Jobs list",
      },
    },
  };

  async handle(c: AppContext) {
    const query = c.req.query();
    const status = query.status;
    const preprocessor = query.preprocessor;
    const limit = parseInt(query.limit || "20");

    const db = c.env.DB;

    let sql = "SELECT job_id, preprocessor, mode, status, output_channel, created_at, completed_at FROM preprocessor_jobs WHERE 1=1";
    const params: string[] = [];

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }
    if (preprocessor) {
      sql += " AND preprocessor = ?";
      params.push(preprocessor);
    }

    sql += ` ORDER BY created_at DESC LIMIT ${limit}`;

    const jobs = await db.prepare(sql).bind(...params).all();

    return c.json({
      success: true,
      jobs: jobs.results || [],
      count: jobs.results?.length || 0,
    });
  }
}

export class PreprocessorCancel extends OpenAPIRoute {
  schema = {
    summary: "Cancel a pending job",
    request: {
      params: z.object({
        jobId: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Job cancelled",
      },
      404: {
        description: "Job not found or not cancellable",
      },
    },
  };

  async handle(c: AppContext) {
    const jobId = c.req.param("jobId");
    const db = c.env.DB;

    const result = await db
      .prepare("UPDATE preprocessor_jobs SET status = 'cancelled' WHERE job_id = ? AND status = 'pending'")
      .bind(jobId)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: "Job not found or already processed" }, 404);
    }

    return c.json({ success: true, job_id: jobId, status: "cancelled" });
  }
}
