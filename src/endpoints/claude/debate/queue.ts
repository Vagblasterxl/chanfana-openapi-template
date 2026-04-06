import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";
import { joinQueueSchema } from "./base";

export class DebateQueueJoin extends OpenAPIRoute {
  schema = {
    summary: "Join the debate queue",
    description: "Register availability to join debates. System can auto-match agents to open debates.",
    request: {
      body: {
        content: {
          "application/json": { schema: joinQueueSchema },
        },
      },
    },
    responses: {
      200: { description: "Joined queue" },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = joinQueueSchema.parse(body);
    const db = c.env.DB;
    const now = new Date();
    const availableUntil = new Date(now.getTime() + data.available_minutes * 60000).toISOString();

    // Remove any existing queue entry for this agent
    await db
      .prepare("DELETE FROM debate_queue WHERE agent_id = ?")
      .bind(data.agent_id)
      .run();

    // Add to queue
    await db
      .prepare(`
        INSERT INTO debate_queue (agent_id, preferred_role, preferred_mode, topics, available_until, joined_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(
        data.agent_id,
        data.preferred_role,
        data.preferred_mode || null,
        data.topics ? JSON.stringify(data.topics) : null,
        availableUntil,
        now.toISOString()
      )
      .run();

    return c.json({
      success: true,
      agent_id: data.agent_id,
      preferred_role: data.preferred_role,
      available_until: availableUntil,
    });
  }
}

export class DebateQueueLeave extends OpenAPIRoute {
  schema = {
    summary: "Leave the debate queue",
    request: {
      params: z.object({ agentId: z.string() }),
    },
    responses: {
      200: { description: "Left queue" },
    },
  };

  async handle(c: AppContext) {
    const agentId = c.req.param("agentId");
    const db = c.env.DB;

    await db
      .prepare("DELETE FROM debate_queue WHERE agent_id = ?")
      .bind(agentId)
      .run();

    return c.json({ success: true, agent_id: agentId });
  }
}

export class DebateQueueList extends OpenAPIRoute {
  schema = {
    summary: "List agents in queue",
    responses: {
      200: { description: "Queue list" },
    },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const now = new Date().toISOString();

    // Get active queue entries (not expired)
    const queue = await db
      .prepare("SELECT * FROM debate_queue WHERE available_until > ? ORDER BY joined_at")
      .bind(now)
      .all();

    return c.json({
      success: true,
      queue: (queue.results || []).map((q: Record<string, unknown>) => ({
        ...q,
        topics: q.topics ? JSON.parse(q.topics as string) : [],
      })),
      count: queue.results?.length || 0,
    });
  }
}

export class DebateAutoMatch extends OpenAPIRoute {
  schema = {
    summary: "Auto-match queued agents to open debates",
    description: "Finds open debates and matches them with available agents from the queue",
    responses: {
      200: { description: "Matches made" },
    },
  };

  async handle(c: AppContext) {
    const db = c.env.DB;
    const now = new Date().toISOString();

    // Get open debates needing participants
    const openDebates = await db
      .prepare(`
        SELECT * FROM debates
        WHERE status IN ('open', 'in_progress')
        AND (
          (thesis_position IS NULL) OR
          (thesis_position IS NOT NULL AND antithesis_position IS NULL)
        )
        ORDER BY created_at
      `)
      .all();

    // Get available agents
    const availableAgents = await db
      .prepare("SELECT * FROM debate_queue WHERE available_until > ? ORDER BY joined_at")
      .bind(now)
      .all();

    const matches: Array<{ debate_id: string; agent_id: string; role: string }> = [];

    for (const debate of (openDebates.results || []) as Record<string, unknown>[]) {
      const needsThesis = !debate.thesis_position;
      const needsAntithesis = debate.thesis_position && !debate.antithesis_position;

      for (const agent of (availableAgents.results || []) as Record<string, unknown>[]) {
        // Skip if agent already in this debate
        if (agent.agent_id === debate.thesis_agent || agent.agent_id === debate.antithesis_agent) {
          continue;
        }

        const role = agent.preferred_role as string;
        const mode = agent.preferred_mode as string | null;

        // Check mode preference
        if (mode && mode !== debate.mode) {
          continue;
        }

        // Check role match
        if (needsThesis && (role === "thesis" || role === "either")) {
          matches.push({
            debate_id: debate.debate_id as string,
            agent_id: agent.agent_id as string,
            role: "thesis",
          });
          // Remove from available pool for this run
          const idx = (availableAgents.results as unknown[]).indexOf(agent);
          if (idx > -1) (availableAgents.results as unknown[]).splice(idx, 1);
          break;
        }

        if (needsAntithesis && (role === "antithesis" || role === "either")) {
          matches.push({
            debate_id: debate.debate_id as string,
            agent_id: agent.agent_id as string,
            role: "antithesis",
          });
          const idx = (availableAgents.results as unknown[]).indexOf(agent);
          if (idx > -1) (availableAgents.results as unknown[]).splice(idx, 1);
          break;
        }
      }
    }

    // Broadcast matches to inbox
    for (const match of matches) {
      await db
        .prepare(`
          INSERT INTO inbox (channel, from_agent, to_agent, message_type, content, metadata, created_at)
          VALUES ('debate-active', 'matchmaker', ?, 'command', ?, ?, ?)
        `)
        .bind(
          match.agent_id,
          JSON.stringify({
            action: "join_debate",
            debate_id: match.debate_id,
            role: match.role,
          }),
          JSON.stringify({ debate_id: match.debate_id }),
          now
        )
        .run();

      // Remove matched agent from queue
      await db
        .prepare("DELETE FROM debate_queue WHERE agent_id = ?")
        .bind(match.agent_id)
        .run();
    }

    return c.json({
      success: true,
      matches,
      total_matches: matches.length,
    });
  }
}
