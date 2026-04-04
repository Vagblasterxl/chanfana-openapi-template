import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";
import {
  submitRequestSchema,
  generateJobId,
  buildPrompt,
  requestBuilders,
  responseExtractors,
} from "./base";

export class PreprocessorSubmit extends OpenAPIRoute {
  schema = {
    summary: "Submit content for preprocessing",
    description: "Send content to a registered preprocessor (Gemma, Claude, etc.) for OCR, summarization, extraction, or custom processing.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: submitRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Job submitted (or completed if sync=true)",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              job_id: z.string(),
              status: z.string(),
              result: z.string().optional(),
              output_message_id: z.number().optional(),
            }),
          },
        },
      },
      404: {
        description: "Preprocessor not found in registry",
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = submitRequestSchema.parse(body);
    const db = c.env.DB;
    const jobId = generateJobId();
    const now = new Date().toISOString();

    // Look up preprocessor in worker registry
    const worker = await db
      .prepare("SELECT * FROM worker_registry WHERE name = ? AND status = 'active'")
      .bind(data.preprocessor)
      .first();

    if (!worker) {
      return c.json({
        success: false,
        error: `Preprocessor '${data.preprocessor}' not found in registry`,
      }, 404);
    }

    // Create job record
    await db
      .prepare(`
        INSERT INTO preprocessor_jobs
        (job_id, preprocessor, mode, input_type, input_content, custom_prompt, output_channel, output_agent, callback_url, priority, status, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
      `)
      .bind(
        jobId,
        data.preprocessor,
        data.mode,
        data.input_type,
        data.content,
        data.custom_prompt || null,
        data.output_channel,
        data.output_agent || null,
        data.callback_url || null,
        data.priority,
        data.metadata ? JSON.stringify(data.metadata) : null,
        now
      )
      .run();

    // If sync mode, process immediately
    if (data.sync) {
      const result = await this.processJob(c, jobId, data, worker);
      return c.json(result);
    }

    // Otherwise, process in background (fire and forget)
    // In production, this would be a queue, but for now we process inline
    this.processJob(c, jobId, data, worker).catch(console.error);

    return c.json({
      success: true,
      job_id: jobId,
      status: "processing",
    });
  }

  private async processJob(
    c: AppContext,
    jobId: string,
    data: z.infer<typeof submitRequestSchema>,
    worker: Record<string, unknown>
  ) {
    const db = c.env.DB;
    const startTime = Date.now();

    try {
      // Update status to processing
      await db
        .prepare("UPDATE preprocessor_jobs SET status = 'processing', started_at = ? WHERE job_id = ?")
        .bind(new Date().toISOString(), jobId)
        .run();

      // Build the request based on preprocessor type
      const { request, format } = this.buildPreprocessorRequest(data, worker);

      // Build headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };

      // Add auth
      const authToken = worker.auth_token as string | null;
      if (worker.auth_type === "bearer" && authToken) {
        const token = authToken.startsWith("$")
          ? String(c.env[authToken.slice(1) as keyof typeof c.env] || "")
          : authToken;
        headers["Authorization"] = `Bearer ${token}`;
      } else if (worker.auth_type === "header" && authToken) {
        headers[(worker.auth_header as string) || "X-API-Key"] = authToken;
      }

      // Log outgoing request
      await db
        .prepare(`
          INSERT INTO comms (direction, from_entity, to_entity, worker_url, method, payload, status, created_at)
          VALUES ('out', 'preprocessor', ?, ?, 'POST', ?, 'pending', ?)
        `)
        .bind(data.preprocessor, worker.url, JSON.stringify(request), new Date().toISOString())
        .run();

      // Make the request
      const response = await fetch(worker.url as string, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Preprocessor returned ${response.status}: ${await response.text()}`);
      }

      const responseData = await response.json() as Record<string, unknown>;

      // Extract result based on format
      const extractor = responseExtractors[format as keyof typeof responseExtractors] || responseExtractors.openai;
      const result = extractor(responseData);

      const processingTime = Date.now() - startTime;

      // Update job with result
      await db
        .prepare(`
          UPDATE preprocessor_jobs
          SET status = 'completed', result = ?, processing_time_ms = ?, completed_at = ?
          WHERE job_id = ?
        `)
        .bind(result, processingTime, new Date().toISOString(), jobId)
        .run();

      // Push result to inbox
      const inboxResult = await db
        .prepare(`
          INSERT INTO inbox (channel, from_agent, to_agent, message_type, content, priority, metadata, created_at)
          VALUES (?, 'preprocessor', ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          data.output_channel,
          data.output_agent || null,
          data.mode,
          result,
          data.priority,
          JSON.stringify({ job_id: jobId, preprocessor: data.preprocessor, mode: data.mode }),
          new Date().toISOString()
        )
        .run();

      // Fire callback if configured
      if (data.callback_url) {
        fetch(data.callback_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            job_id: jobId,
            status: "completed",
            result,
            output_channel: data.output_channel,
          }),
        }).catch(() => {}); // Fire and forget
      }

      return {
        success: true,
        job_id: jobId,
        status: "completed",
        result,
        output_message_id: inboxResult.meta.last_row_id,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await db
        .prepare("UPDATE preprocessor_jobs SET status = 'failed', error_message = ?, completed_at = ? WHERE job_id = ?")
        .bind(errorMessage, new Date().toISOString(), jobId)
        .run();

      return {
        success: false,
        job_id: jobId,
        status: "failed",
        error: errorMessage,
      };
    }
  }

  private buildPreprocessorRequest(
    data: z.infer<typeof submitRequestSchema>,
    worker: Record<string, unknown>
  ): { request: unknown; format: string } {
    // Detect format from URL or worker name
    const url = worker.url as string;
    const name = worker.name as string;

    let format = "openai"; // Default to OpenAI-compatible
    if (url.includes("aiplatform.googleapis.com")) {
      format = "vertex";
    } else if (url.includes("anthropic.com")) {
      format = "anthropic";
    }

    // Build prompts based on mode
    const modePrompts: Record<string, { system: string; user: string }> = {
      ocr: {
        system: "You are an OCR system. Extract all visible text accurately. Preserve formatting.",
        user: "Extract all text from this content:",
      },
      summarize: {
        system: "You are a summarization system. Create concise summaries with key points.",
        user: "Summarize the following:",
      },
      extract: {
        system: "You are a data extraction system. Return structured JSON only.",
        user: "Extract key information as JSON:",
      },
      transform: {
        system: "You are a content transformation system.",
        user: "Transform this content:",
      },
      custom: {
        system: "You are a helpful assistant.",
        user: data.custom_prompt || "Process this content:",
      },
    };

    const prompts = modePrompts[data.mode] || modePrompts.custom;
    const userPrompt = `${prompts.user}\n\n${data.content}`;

    // Build request based on format and input type
    if (data.input_type === "base64_image" && format === "openai") {
      return {
        request: requestBuilders.openaiVision(prompts.system, prompts.user, data.content, 4096, 0.3),
        format,
      };
    }

    if (format === "vertex") {
      return {
        request: requestBuilders.vertex(`${prompts.system}\n\n${userPrompt}`, 4096, 0.3),
        format,
      };
    }

    if (format === "anthropic") {
      return {
        request: requestBuilders.anthropic(prompts.system, [{ type: "text", text: userPrompt }], 4096),
        format,
      };
    }

    // Default OpenAI format
    return {
      request: requestBuilders.openai(prompts.system, userPrompt, 4096, 0.3),
      format,
    };
  }
}
