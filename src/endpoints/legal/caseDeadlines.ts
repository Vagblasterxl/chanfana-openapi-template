import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class CaseDeadlines extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Legal"],
    summary: "List deadlines with days-remaining (SOL clock)",
    description:
      "Returns every deadline ordered by date, with computed days remaining. " +
      "Critical for statute-of-limitations tracking when you're about to file.",
    responses: {
      "200": {
        description: "Deadlines",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              count: z.number(),
              today: z.string(),
              deadlines: z.array(
                z.object({
                  id: z.string(),
                  deadline_date: z.string(),
                  description: z.string(),
                  claim_id: z.string().nullable(),
                  status: z.string(),
                  days_remaining: z.number().nullable(),
                  urgency: z.string(),
                  created_at: z.string(),
                }),
              ),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const { results } = await db
      .prepare(
        `SELECT id, deadline_date, description, claim_id, status, created_at
         FROM legal_deadlines ORDER BY deadline_date ASC`,
      )
      .all();

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const deadlines = (results as Array<Record<string, unknown>>).map((row) => {
      const dateStr = String(row.deadline_date);
      const parsed = new Date(dateStr);
      let daysRemaining: number | null = null;
      let urgency = "unknown";

      if (!Number.isNaN(parsed.getTime())) {
        const ms = parsed.getTime() - today.getTime();
        daysRemaining = Math.ceil(ms / (1000 * 60 * 60 * 24));
        if (daysRemaining < 0) urgency = "passed";
        else if (daysRemaining <= 7) urgency = "critical";
        else if (daysRemaining <= 30) urgency = "soon";
        else urgency = "ok";
      }

      return { ...row, days_remaining: daysRemaining, urgency };
    });

    return { success: true, count: deadlines.length, today: todayStr, deadlines };
  }
}

export class CaseDeadlineCreate extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Legal"],
    summary: "Add a deadline to the SOL clock",
    description:
      "Record a statute-of-limitations or filing deadline. Date should be ISO " +
      "(YYYY-MM-DD) so days-remaining can be computed.",
    request: {
      body: {
        content: {
          "application/json": {
            schema: z.object({
              deadline_date: z.string().describe("ISO date YYYY-MM-DD"),
              description: z.string().describe("What this deadline is for"),
              claim_id: z.string().optional().describe("Related claim, if any"),
            }),
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Deadline stored",
        content: {
          "application/json": {
            schema: z.object({ success: Bool(), deadline_id: z.string() }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const data = await this.getValidatedData<typeof this.schema>();
    const body = data.body;
    const db = c.env.DB;
    const now = new Date().toISOString();
    const id = `dl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await db
      .prepare(
        `INSERT INTO legal_deadlines (id, deadline_date, description, claim_id, status, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(id, body.deadline_date, body.description, body.claim_id ?? null, "pending", now)
      .run();

    return { success: true, deadline_id: id };
  }
}
