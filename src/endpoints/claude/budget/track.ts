import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";
import { createBudgetSchema, recordUsageSchema } from "./base";

export class BudgetCreate extends OpenAPIRoute {
  schema = {
    summary: "Create or update a token budget",
    description: "Set daily/monthly limits for an agent+platform combo. Priority determines who gets tokens first when tight.",
    request: {
      body: {
        content: {
          "application/json": { schema: createBudgetSchema },
        },
      },
    },
    responses: { 200: { description: "Budget set" } },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = createBudgetSchema.parse(body);
    const db = c.env.DB;
    const now = new Date().toISOString();

    // Upsert
    await db
      .prepare(`
        INSERT INTO token_budgets (agent_id, platform, daily_limit, monthly_limit, cost_per_1k_tokens, priority, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(agent_id, platform) DO UPDATE SET
          daily_limit = excluded.daily_limit,
          monthly_limit = excluded.monthly_limit,
          cost_per_1k_tokens = excluded.cost_per_1k_tokens,
          priority = excluded.priority
      `)
      .bind(
        data.agent_id,
        data.platform,
        data.daily_limit || null,
        data.monthly_limit || null,
        data.cost_per_1k_tokens,
        data.priority,
        now
      )
      .run();

    return c.json({
      success: true,
      agent_id: data.agent_id,
      platform: data.platform,
      daily_limit: data.daily_limit,
      priority: data.priority,
    });
  }
}

export class BudgetList extends OpenAPIRoute {
  schema = {
    summary: "List all token budgets with usage",
    request: {
      query: z.object({
        platform: z.string().optional(),
        agent_id: z.string().optional(),
      }),
    },
    responses: { 200: { description: "Budgets list" } },
  };

  async handle(c: AppContext) {
    const query = c.req.query();
    const db = c.env.DB;

    let sql = "SELECT * FROM token_budgets WHERE active = 1";
    const params: string[] = [];

    if (query.platform) {
      sql += " AND platform = ?";
      params.push(query.platform);
    }
    if (query.agent_id) {
      sql += " AND agent_id = ?";
      params.push(query.agent_id);
    }

    sql += " ORDER BY priority DESC, platform";

    const budgets = await db.prepare(sql).bind(...params).all();

    // Calculate remaining budget for each
    const enriched = (budgets.results || []).map((b: Record<string, unknown>) => ({
      ...b,
      tokens_available_today: b.daily_limit
        ? Math.max(0, (b.daily_limit as number) - (b.tokens_used_today as number))
        : null,
      tokens_available_this_month: b.monthly_limit
        ? Math.max(0, (b.monthly_limit as number) - (b.tokens_used_this_month as number))
        : null,
      budget_status: computeBudgetStatus(b),
    }));

    return c.json({
      success: true,
      budgets: enriched,
    });
  }
}

export class BudgetRecordUsage extends OpenAPIRoute {
  schema = {
    summary: "Record token usage",
    description: "Log token consumption and update budget counters. Returns alert if over threshold.",
    request: {
      body: {
        content: {
          "application/json": { schema: recordUsageSchema },
        },
      },
    },
    responses: { 200: { description: "Usage recorded" } },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = recordUsageSchema.parse(body);
    const db = c.env.DB;
    const now = new Date().toISOString();

    // Get budget
    const budget = await db
      .prepare("SELECT * FROM token_budgets WHERE agent_id = ? AND platform = ?")
      .bind(data.agent_id, data.platform)
      .first();

    // Calculate cost
    const costPer1k = (budget?.cost_per_1k_tokens as number) || 0;
    const cost = (data.tokens_used / 1000) * costPer1k;

    // Log usage
    await db
      .prepare(`
        INSERT INTO token_usage_log (agent_id, platform, operation, tokens_used, cost, reference_id, metadata, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        data.agent_id,
        data.platform,
        data.operation || null,
        data.tokens_used,
        cost,
        data.reference_id || null,
        data.metadata ? JSON.stringify(data.metadata) : null,
        now
      )
      .run();

    // Update budget counters (create if doesn't exist)
    if (budget) {
      await db
        .prepare(`
          UPDATE token_budgets SET
            tokens_used_today = tokens_used_today + ?,
            tokens_used_this_month = tokens_used_this_month + ?,
            requests_today = requests_today + 1,
            total_tokens = total_tokens + ?,
            total_cost = total_cost + ?,
            last_used_at = ?
          WHERE agent_id = ? AND platform = ?
        `)
        .bind(
          data.tokens_used,
          data.tokens_used,
          data.tokens_used,
          cost,
          now,
          data.agent_id,
          data.platform
        )
        .run();
    } else {
      // Auto-create budget entry
      await db
        .prepare(`
          INSERT INTO token_budgets (agent_id, platform, tokens_used_today, tokens_used_this_month, requests_today, total_tokens, total_cost, last_used_at, created_at)
          VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)
        `)
        .bind(
          data.agent_id,
          data.platform,
          data.tokens_used,
          data.tokens_used,
          data.tokens_used,
          cost,
          now,
          now
        )
        .run();
    }

    // Check alert thresholds
    const warnings: string[] = [];
    if (budget && budget.daily_limit) {
      const newUsed = (budget.tokens_used_today as number) + data.tokens_used;
      const pct = (newUsed / (budget.daily_limit as number)) * 100;
      if (pct >= 100) warnings.push("DAILY_LIMIT_EXCEEDED");
      else if (pct >= 90) warnings.push("DAILY_LIMIT_90_PCT");
      else if (pct >= 75) warnings.push("DAILY_LIMIT_75_PCT");

      if (warnings.length > 0) {
        // Push alert to budget-alerts channel
        await db
          .prepare(`
            INSERT INTO inbox (channel, from_agent, message_type, content, metadata, created_at)
            VALUES ('budget-alerts', 'budget-tracker', 'alert', ?, ?, ?)
          `)
          .bind(
            `Budget alert for ${data.agent_id} on ${data.platform}: ${warnings.join(", ")} (${pct.toFixed(1)}%)`,
            JSON.stringify({ agent_id: data.agent_id, platform: data.platform, pct, warnings }),
            now
          )
          .run();
      }
    }

    return c.json({
      success: true,
      agent_id: data.agent_id,
      platform: data.platform,
      tokens_used: data.tokens_used,
      cost,
      warnings,
    });
  }
}

export class BudgetResetDaily extends OpenAPIRoute {
  schema = {
    summary: "Reset daily counters",
    description: "Reset tokens_used_today and requests_today for all budgets. Call from cron.",
    responses: { 200: { description: "Daily counters reset" } },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const now = new Date().toISOString();

    const result = await db
      .prepare("UPDATE token_budgets SET tokens_used_today = 0, requests_today = 0, daily_reset_at = ?")
      .bind(now)
      .run();

    return c.json({
      success: true,
      budgets_reset: result.meta.changes,
      reset_at: now,
    });
  }
}

function computeBudgetStatus(b: Record<string, unknown>): string {
  if (!b.daily_limit) return "unlimited";
  const used = b.tokens_used_today as number;
  const limit = b.daily_limit as number;
  const pct = (used / limit) * 100;
  if (pct >= 100) return "exhausted";
  if (pct >= 90) return "critical";
  if (pct >= 75) return "warning";
  if (pct >= 50) return "moderate";
  return "healthy";
}
