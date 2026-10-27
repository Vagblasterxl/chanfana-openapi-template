import { Bool, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext, HandleArgs } from "../../types";

export class SyncSnapshotPush extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Sync"],
    summary: "Push coordination snapshot to R2",
    description:
      "Exports current agents, messages (pending only), and coordination state to R2 as a JSON snapshot. " +
      "Other workers can pull this to stay in sync.",
    responses: {
      "200": {
        description: "Snapshot pushed",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              key: z.string(),
              timestamp: z.string(),
              counts: z.object({
                agents: z.number().int(),
                messages: z.number().int(),
                state: z.number().int(),
                triples: z.number().int(),
              }),
            }),
          },
        },
      },
      "501": {
        description: "R2 bucket not configured",
        content: {
          "application/json": {
            schema: z.object({ success: Bool(), error: z.string() }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const r2 = (c.env as Record<string, unknown>).R2_BUCKET as R2Bucket | undefined;

    if (!r2) {
      return c.json({ success: false, error: "R2_BUCKET binding not configured" }, 501);
    }

    const [agents, messages, state, triples] = await Promise.all([
      db.prepare(`SELECT * FROM agents`).all(),
      db.prepare(`SELECT * FROM messages WHERE status = 'pending'`).all(),
      db.prepare(`SELECT * FROM coordination_state`).all(),
      db.prepare(`SELECT * FROM knowledge_triples ORDER BY created_at DESC LIMIT 500`).all().catch(() => ({ results: [] })),
    ]);

    const now = new Date().toISOString();
    const snapshot = {
      exported_at: now,
      source: "symphony-coordination",
      agents: agents.results,
      pending_messages: messages.results,
      coordination_state: state.results,
      knowledge_triples: triples.results,
    };

    const key = `snapshots/coordination-${now.replace(/[:.]/g, "-")}.json`;
    await r2.put(key, JSON.stringify(snapshot), {
      httpMetadata: { contentType: "application/json" },
    });

    await r2.put("snapshots/latest.json", JSON.stringify(snapshot), {
      httpMetadata: { contentType: "application/json" },
    });

    return {
      success: true,
      key,
      timestamp: now,
      counts: {
        agents: agents.results.length,
        messages: messages.results.length,
        state: state.results.length,
        triples: triples.results.length,
      },
    };
  }
}

export class SyncSnapshotPull extends OpenAPIRoute<HandleArgs> {
  schema = {
    tags: ["Sync"],
    summary: "Pull latest coordination snapshot from R2",
    description: "Returns the latest coordination snapshot stored in R2.",
    responses: {
      "200": {
        description: "Latest snapshot",
        content: {
          "application/json": {
            schema: z.object({
              success: Bool(),
              snapshot: z.object({
                exported_at: z.string(),
                source: z.string(),
                agents: z.array(z.unknown()),
                pending_messages: z.array(z.unknown()),
                coordination_state: z.array(z.unknown()),
                knowledge_triples: z.array(z.unknown()),
              }).nullable(),
            }),
          },
        },
      },
      "501": {
        description: "R2 bucket not configured",
        content: {
          "application/json": {
            schema: z.object({ success: Bool(), error: z.string() }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const r2 = (c.env as Record<string, unknown>).R2_BUCKET as R2Bucket | undefined;

    if (!r2) {
      return c.json({ success: false, error: "R2_BUCKET binding not configured" }, 501);
    }

    const obj = await r2.get("snapshots/latest.json");
    if (!obj) {
      return { success: true, snapshot: null };
    }

    const snapshot = await obj.json();
    return { success: true, snapshot };
  }
}
