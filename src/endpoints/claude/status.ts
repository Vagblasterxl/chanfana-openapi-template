import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../types";

export class SystemStatus extends OpenAPIRoute {
  schema = {
    summary: "System-wide health dashboard",
    description: "Get a full picture of all subsystems - memory, inbox, debates, budgets, integrations, lateral sessions",
    responses: { 200: { description: "Full system status" } },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;

    // Run all counts in parallel
    const [
      memoryCount,
      activeSessions,
      inboxPending,
      inboxProcessed,
      activeDebates,
      closedDebates,
      preprocessorJobs,
      artifactsByStatus,
      budgetsStatus,
      lateralSessions,
      manusTasks,
      webhookReceivers,
      dispatchers,
      registeredWorkers,
    ] = await Promise.all([
      db.prepare("SELECT COUNT(*) as c FROM memories").first(),
      db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status = 'active'").first(),
      db.prepare("SELECT COUNT(*) as c FROM inbox WHERE status = 'pending'").first(),
      db.prepare("SELECT COUNT(*) as c FROM inbox WHERE status = 'processed'").first(),
      db.prepare("SELECT COUNT(*) as c FROM debates WHERE status IN ('open','in_progress','synthesizing')").first(),
      db.prepare("SELECT COUNT(*) as c FROM debates WHERE status = 'closed'").first(),
      db.prepare("SELECT status, COUNT(*) as c FROM preprocessor_jobs GROUP BY status").all(),
      db.prepare("SELECT canon_status, COUNT(*) as c FROM artifacts GROUP BY canon_status").all(),
      db.prepare("SELECT agent_id, platform, daily_limit, tokens_used_today FROM token_budgets WHERE active = 1 ORDER BY priority DESC").all(),
      db.prepare("SELECT COUNT(*) as c FROM lateral_sessions WHERE status = 'active'").first(),
      db.prepare("SELECT status, COUNT(*) as c FROM manus_tasks GROUP BY status").all(),
      db.prepare("SELECT COUNT(*) as c FROM webhook_receivers WHERE active = 1").first(),
      db.prepare("SELECT COUNT(*) as c FROM dispatchers WHERE active = 1").first(),
      db.prepare("SELECT COUNT(*) as c FROM worker_registry WHERE status = 'active'").first(),
    ]);

    // Compute budget health
    const budgets = (budgetsStatus.results || []) as Record<string, unknown>[];
    const budgetHealth = budgets.map(b => {
      const used = b.tokens_used_today as number;
      const limit = b.daily_limit as number | null;
      return {
        agent_id: b.agent_id,
        platform: b.platform,
        used_today: used,
        daily_limit: limit,
        available: limit ? Math.max(0, limit - used) : null,
        pct_used: limit ? Math.round((used / limit) * 100) : 0,
      };
    });

    // Recent activity
    const recentActivity = await db
      .prepare(`
        SELECT 'memory' as type, created_at FROM memories ORDER BY created_at DESC LIMIT 5
      `)
      .all();

    return c.json({
      success: true,
      timestamp: new Date().toISOString(),
      subsystems: {
        memory: {
          total: memoryCount?.c || 0,
          active_sessions: activeSessions?.c || 0,
        },
        inbox: {
          pending: inboxPending?.c || 0,
          processed: inboxProcessed?.c || 0,
        },
        debates: {
          active: activeDebates?.c || 0,
          closed: closedDebates?.c || 0,
        },
        preprocessor: {
          by_status: preprocessorJobs.results || [],
        },
        artifacts: {
          by_status: artifactsByStatus.results || [],
        },
        budgets: budgetHealth,
        lateral_coordination: {
          active_sessions: lateralSessions?.c || 0,
          manus_tasks_by_status: manusTasks.results || [],
        },
        integrations: {
          active_receivers: webhookReceivers?.c || 0,
          active_dispatchers: dispatchers?.c || 0,
        },
        workers: {
          registered: registeredWorkers?.c || 0,
        },
      },
    });
  }
}

export class SystemHealth extends OpenAPIRoute {
  schema = {
    summary: "Quick health check",
    responses: { 200: { description: "OK" } },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    try {
      await db.prepare("SELECT 1").first();
      return c.json({
        status: "healthy",
        timestamp: new Date().toISOString(),
        version: "1.0.0",
      });
    } catch (e) {
      return c.json({
        status: "unhealthy",
        error: e instanceof Error ? e.message : "Unknown",
      }, 500);
    }
  }
}
