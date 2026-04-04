import { OpenAPIRoute, D1ListEndpoint, D1ReadEndpoint, D1DeleteEndpoint } from "chanfana";
import { z } from "zod";
import { AppContext, HandleArgs } from "../../../types";
import { configRequestSchema, PreprocessorConfigModel } from "./base";

export class ConfigCreate extends OpenAPIRoute {
  schema = {
    summary: "Create preprocessor config",
    description: "Create a reusable preprocessor configuration with prompts and settings",
    request: {
      body: {
        content: {
          "application/json": {
            schema: configRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "Config created",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              config: z.object({
                id: z.number(),
                name: z.string(),
              }),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = configRequestSchema.parse(body);
    const db = c.env.DB;

    const result = await db
      .prepare(`
        INSERT INTO preprocessor_configs
        (name, worker_name, mode, system_prompt, user_prompt_template, max_tokens, temperature, output_format, output_channel, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        data.name,
        data.worker_name,
        data.mode,
        data.system_prompt || null,
        data.user_prompt_template || null,
        data.max_tokens,
        data.temperature,
        data.output_format,
        data.output_channel,
        data.metadata ? JSON.stringify(data.metadata) : null,
        new Date().toISOString()
      )
      .run();

    return c.json({
      success: true,
      config: {
        id: result.meta.last_row_id,
        name: data.name,
      },
    });
  }
}

export class ConfigList extends D1ListEndpoint<HandleArgs> {
  _meta = {
    model: PreprocessorConfigModel,
    searchFields: ["name", "worker_name", "mode"],
    defaultOrderBy: "name",
    defaultOrderByDirection: "asc" as const,
  };
}

export class ConfigRead extends OpenAPIRoute {
  schema = {
    summary: "Get config by name",
    request: {
      params: z.object({
        name: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Config found",
      },
      404: {
        description: "Config not found",
      },
    },
  };

  async handle(c: AppContext) {
    const name = c.req.param("name");
    const db = c.env.DB;

    const config = await db
      .prepare("SELECT * FROM preprocessor_configs WHERE name = ?")
      .bind(name)
      .first();

    if (!config) {
      return c.json({ success: false, error: "Config not found" }, 404);
    }

    return c.json({
      success: true,
      config: {
        ...config,
        metadata: config.metadata ? JSON.parse(config.metadata as string) : null,
      },
    });
  }
}

export class ConfigUpdate extends OpenAPIRoute {
  schema = {
    summary: "Update config",
    request: {
      params: z.object({
        name: z.string(),
      }),
      body: {
        content: {
          "application/json": {
            schema: configRequestSchema.partial(),
          },
        },
      },
    },
    responses: {
      200: {
        description: "Config updated",
      },
      404: {
        description: "Config not found",
      },
    },
  };

  async handle(c: AppContext) {
    const name = c.req.param("name");
    const body = await c.req.json();
    const db = c.env.DB;

    const updates: string[] = [];
    const values: (string | number | null)[] = [];

    const fields = [
      "worker_name", "mode", "system_prompt", "user_prompt_template",
      "max_tokens", "temperature", "output_format", "output_channel",
    ];

    for (const field of fields) {
      if (body[field] !== undefined) {
        updates.push(`${field} = ?`);
        values.push(body[field]);
      }
    }

    if (body.metadata !== undefined) {
      updates.push("metadata = ?");
      values.push(JSON.stringify(body.metadata));
    }

    if (updates.length === 0) {
      return c.json({ success: false, error: "No fields to update" }, 400);
    }

    values.push(name);

    const result = await db
      .prepare(`UPDATE preprocessor_configs SET ${updates.join(", ")} WHERE name = ?`)
      .bind(...values)
      .run();

    if (result.meta.changes === 0) {
      return c.json({ success: false, error: "Config not found" }, 404);
    }

    return c.json({ success: true, name });
  }
}

export class ConfigDelete extends OpenAPIRoute {
  schema = {
    summary: "Delete config",
    request: {
      params: z.object({
        name: z.string(),
      }),
    },
    responses: {
      200: {
        description: "Config deleted",
      },
    },
  };

  async handle(c: AppContext) {
    const name = c.req.param("name");
    const db = c.env.DB;

    await db
      .prepare("DELETE FROM preprocessor_configs WHERE name = ?")
      .bind(name)
      .run();

    return c.json({ success: true });
  }
}
