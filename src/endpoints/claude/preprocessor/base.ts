import { z } from "zod";

// ============ ENUMS ============
export const preprocessModes = z.enum(["ocr", "summarize", "extract", "transform", "custom"]);
export const inputTypes = z.enum(["base64_image", "text", "url", "inbox_id", "json"]);
export const jobStatuses = z.enum(["pending", "processing", "completed", "failed", "cancelled"]);
export const outputFormats = z.enum(["text", "json", "markdown"]);

// ============ JOB MODEL ============
export const preprocessorJob = z.object({
  id: z.number().int(),
  job_id: z.string(),
  preprocessor: z.string(),
  mode: preprocessModes,
  input_type: inputTypes,
  input_content: z.string(),
  custom_prompt: z.string().nullable().optional(),
  output_channel: z.string().default("processed"),
  output_agent: z.string().nullable().optional(),
  status: jobStatuses,
  result: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  tokens_used: z.number().int().nullable().optional(),
  processing_time_ms: z.number().int().nullable().optional(),
  source_inbox_id: z.number().int().nullable().optional(),
  callback_url: z.string().nullable().optional(),
  priority: z.number().int().default(0),
  created_at: z.string(),
  started_at: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
  metadata: z.string().nullable().optional(),
});

export const PreprocessorJobModel = {
  tableName: "preprocessor_jobs",
  primaryKeys: ["id"],
  schema: preprocessorJob,
  serializer: (obj: Record<string, string | number | boolean>) => obj,
};

// ============ CONFIG MODEL ============
export const preprocessorConfig = z.object({
  id: z.number().int(),
  name: z.string(),
  worker_name: z.string(),
  mode: preprocessModes,
  system_prompt: z.string().nullable().optional(),
  user_prompt_template: z.string().nullable().optional(),
  max_tokens: z.number().int().default(4096),
  temperature: z.number().default(0.3),
  output_format: outputFormats.default("text"),
  output_channel: z.string().default("processed"),
  active: z.number().int().default(1),
  metadata: z.string().nullable().optional(),
  created_at: z.string(),
});

export const PreprocessorConfigModel = {
  tableName: "preprocessor_configs",
  primaryKeys: ["id"],
  schema: preprocessorConfig,
  serializer: (obj: Record<string, string | number | boolean>) => obj,
};

// ============ PIPELINE MODEL ============
export const preprocessorPipeline = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable().optional(),
  steps: z.string(), // JSON array
  output_channel: z.string().default("processed"),
  active: z.number().int().default(1),
  created_at: z.string(),
});

export const PreprocessorPipelineModel = {
  tableName: "preprocessor_pipelines",
  primaryKeys: ["id"],
  schema: preprocessorPipeline,
  serializer: (obj: Record<string, string | number | boolean>) => obj,
};

// ============ AUTOBRIDGE MODEL ============
export const preprocessorAutobridge = z.object({
  id: z.number().int(),
  name: z.string(),
  source_channel: z.string(),
  filter_message_type: z.string().nullable().optional(),
  filter_from_agent: z.string().nullable().optional(),
  preprocessor_config: z.string(),
  output_channel: z.string(),
  batch_size: z.number().int().default(10),
  active: z.number().int().default(1),
  last_triggered_at: z.string().nullable().optional(),
  total_processed: z.number().int().default(0),
  created_at: z.string(),
});

export const PreprocessorAutobridgeModel = {
  tableName: "preprocessor_autobridges",
  primaryKeys: ["id"],
  schema: preprocessorAutobridge,
  serializer: (obj: Record<string, string | number | boolean>) => obj,
};

// ============ REQUEST SCHEMAS ============
export const submitRequestSchema = z.object({
  preprocessor: z.string().min(1).describe("Worker name from registry (e.g., 'gemma-4-local')"),
  mode: preprocessModes,
  input_type: inputTypes,
  content: z.string().min(1).describe("The content to process"),
  custom_prompt: z.string().optional().describe("Custom prompt for 'custom' mode"),
  output_channel: z.string().default("processed"),
  output_agent: z.string().optional().describe("Specific agent to receive output"),
  callback_url: z.string().url().optional().describe("Webhook URL for completion notification"),
  priority: z.number().int().default(0),
  sync: z.boolean().default(false).describe("Wait for result instead of returning job_id"),
  metadata: z.record(z.unknown()).optional(),
});

export const configRequestSchema = z.object({
  name: z.string().min(1),
  worker_name: z.string().min(1),
  mode: preprocessModes,
  system_prompt: z.string().optional(),
  user_prompt_template: z.string().optional().describe("Use {content} as placeholder"),
  max_tokens: z.number().int().default(4096),
  temperature: z.number().min(0).max(2).default(0.3),
  output_format: outputFormats.default("text"),
  output_channel: z.string().default("processed"),
  metadata: z.record(z.unknown()).optional(),
});

export const pipelineRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  steps: z.array(z.object({
    config: z.string().describe("Config name to use"),
    input_from: z.string().optional().describe("Key from previous step output"),
    output_key: z.string().optional().describe("Key to store this step's output"),
  })),
  output_channel: z.string().default("processed"),
});

export const autobridgeRequestSchema = z.object({
  name: z.string().min(1),
  source_channel: z.string().min(1),
  filter_message_type: z.string().optional(),
  filter_from_agent: z.string().optional(),
  preprocessor_config: z.string().min(1),
  output_channel: z.string().min(1),
  batch_size: z.number().int().default(10),
});

// ============ HELPERS ============
export function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function buildPrompt(template: string, content: string): string {
  return template.replace(/\{content\}/g, content);
}

// Model-specific request builders (pluggable)
export const requestBuilders = {
  // OpenAI-compatible format (Ollama, vLLM, etc.)
  openai: (systemPrompt: string, userPrompt: string, maxTokens: number, temperature: number) => ({
    model: "gemma-4",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
  }),

  // OpenAI with vision
  openaiVision: (systemPrompt: string, textPrompt: string, base64Image: string, maxTokens: number, temperature: number) => ({
    model: "gemma-4",
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          { type: "text", text: textPrompt },
          { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } },
        ],
      },
    ],
    max_tokens: maxTokens,
    temperature,
  }),

  // Vertex AI format
  vertex: (prompt: string, maxTokens: number, temperature: number) => ({
    instances: [{ prompt }],
    parameters: { maxOutputTokens: maxTokens, temperature },
  }),

  // Anthropic format
  anthropic: (systemPrompt: string, userContent: unknown[], maxTokens: number) => ({
    model: "claude-3-haiku-20240307",
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userContent }],
  }),
};

// Response extractors (pluggable)
export const responseExtractors = {
  openai: (response: Record<string, unknown>) => {
    const choices = response.choices as Array<{ message?: { content?: string } }>;
    return choices?.[0]?.message?.content || "";
  },
  vertex: (response: Record<string, unknown>) => {
    const predictions = response.predictions as Array<{ content?: string }>;
    return predictions?.[0]?.content || "";
  },
  anthropic: (response: Record<string, unknown>) => {
    const content = response.content as Array<{ text?: string }>;
    return content?.[0]?.text || "";
  },
};
