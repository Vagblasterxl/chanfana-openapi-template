import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../types";

export class HealthCheck extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["System"],
    summary: "Health check - returns timestamp and agent count",
    responses: {
      "200": {
        description: "Service health",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              timestamp: z.string(),
              agent_count: z.number().int(),
              service: z.string(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;

    let agentCount = 0;
    try {
      const result = await db
        .prepare(`SELECT COUNT(*) as count FROM agents`)
        .first<{ count: number }>();
      agentCount = result?.count ?? 0;
    } catch {
      // Table may not exist yet if migration hasn't run
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      agent_count: agentCount,
      service: "symphony-coordination",
    };
  }
}
