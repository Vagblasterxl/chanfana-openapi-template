import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";
import { pipelineRequestSchema, generateJobId, buildPrompt, requestBuilders, responseExtractors } from "./base";

export class PipelineCreate extends OpenAPIRoute {
  schema = {
    summary: "Create a pipeline",
    description: "Create a multi-step processing pipeline that chains preprocessors",
    request: {
      body: {
        content: {
          "application/json": {
            schema: pipelineRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Pipeline created",
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = pipelineRequestSchema.parse(body);
    const db = c.env.DB;

    const result = await db
      .prepare(`
        INSERT INTO preprocessor_pipelines (name, description, steps, output_channel, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        data.name,
        data.description || null,
        JSON.stringify(data.steps),
        data.output_channel,
        new Date().toISOString()
      )
      .run();

    return c.json({
      success: true,
      pipeline: {
        id: result.meta.last_row_id,
        name: data.name,
        steps: data.steps.length,
      },
    });
  }
}

export class PipelineList extends OpenAPIRoute {
  schema = {
    summary: "List pipelines",
    responses: {
      200: {
        description: "Pipelines list",
      },
    },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const pipelines = await db
      .prepare("SELECT id, name, description, output_channel, active, created_at FROM preprocessor_pipelines ORDER BY name")
      .all();

    return c.json({
      success: true,
      pipelines: pipelines.results || [],
    });
  }
}

export class PipelineRun extends OpenAPIRoute {
  schema = {
    summary: "Run a pipeline",
    description: "Execute a multi-step pipeline on content",
    request: {
      params: z.object({
        name: z.string(),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.object({
              input_type: z.enum(["base64_image", "text", "url", "json"]),
              content: z.string(),
              output_agent: z.string().optional(),
              sync: z.boolean().default(false),
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Pipeline executed",
      },
      404: {
        description: "Pipeline not found",
      },
    },
  };

  async handle(c: AppContext) {
    const pipelineName = c.req.param("name");
    const body = await c.req.json();
    const db = c.env.DB;

    // Get pipeline
    const pipeline = await db
      .prepare("SELECT * FROM preprocessor_pipelines WHERE name = ? AND active = 1")
      .bind(pipelineName)
      .first();

    if (!pipeline) {
      return c.json({ success: false, error: "Pipeline not found" }, 404);
    }

    const steps = JSON.parse(pipeline.steps as string) as Array<{
      config: string;
      input_from?: string;
      output_key?: string;
    }>;

    const jobId = generateJobId();
    const results: Record<string, string> = {};
    let currentContent = body.content;
    let currentInputType = body.input_type;

    // Execute each step
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];

      // Get config for this step
      const config = await db
        .prepare("SELECT * FROM preprocessor_configs WHERE name = ? AND active = 1")
        .bind(step.config)
        .first();

      if (!config) {
        return c.json({
          success: false,
          error: `Config '${step.config}' not found for step ${i + 1}`,
        }, 404);
      }

      // Get worker for this config
      const worker = await db
        .prepare("SELECT * FROM worker_registry WHERE name = ? AND status = 'active'")
        .bind(config.worker_name)
        .first();

      if (!worker) {
        return c.json({
          success: false,
          error: `Worker '${config.worker_name}' not found for step ${i + 1}`,
        }, 404);
      }

      // Determine input for this step
      if (step.input_from && results[step.input_from]) {
        currentContent = results[step.input_from];
        currentInputType = "text"; // Previous step output is always text
      }

      // Build prompt
      const userPrompt = config.user_prompt_template
        ? buildPrompt(config.user_prompt_template as string, currentContent)
        : currentContent;

      // Build request (simplified - assumes OpenAI format)
      const request = requestBuilders.openai(
        config.system_prompt as string || "Process the following content.",
        userPrompt,
        config.max_tokens as number || 4096,
        config.temperature as number || 0.3
      );

      // Build headers
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      const authToken = worker.auth_token as string | null;
      if (worker.auth_type === "bearer" && authToken) {
        const token = authToken.startsWith("$")
          ? String(c.env[authToken.slice(1) as keyof typeof c.env] || "")
          : authToken;
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Make request
      const response = await fetch(worker.url as string, {
        method: "POST",
        headers,
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        return c.json({
          success: false,
          error: `Step ${i + 1} failed: ${response.status}`,
          step: step.config,
        }, 500);
      }

      const responseData = await response.json() as Record<string, unknown>;
      const result = responseExtractors.openai(responseData);

      // Store result
      const outputKey = step.output_key || `step_${i + 1}`;
      results[outputKey] = result;
      currentContent = result; // Pass to next step
    }

    // Get final result (last step's output)
    const finalResult = currentContent;

    // Push to inbox
    const inboxResult = await db
      .prepare(`
        INSERT INTO inbox (channel, from_agent, to_agent, message_type, content, metadata, created_at)
        VALUES (?, 'pipeline', ?, 'json', ?, ?, ?)
      `)
      .bind(
        pipeline.output_channel,
        body.output_agent || null,
        finalResult,
        JSON.stringify({ pipeline: pipelineName, job_id: jobId, steps: steps.length }),
        new Date().toISOString()
      )
      .run();

    return c.json({
      success: true,
      job_id: jobId,
      pipeline: pipelineName,
      steps_executed: steps.length,
      result: finalResult,
      output_channel: pipeline.output_channel,
      output_message_id: inboxResult.meta.last_row_id,
    });
  }
}
