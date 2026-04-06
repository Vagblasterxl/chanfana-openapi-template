import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";
import { createDebateSchema, generateDebateId } from "./base";

export class DebateCreate extends OpenAPIRoute {
  schema = {
    summary: "Create a new debate",
    description: "Start a Hegelian dialectic, adversarial debate, collaborative discussion, or rap battle",
    request: {
      body: {
        content: {
          "application/json": { schema: createDebateSchema },
        },
      },
    },
    responses: {
      200: {
        description: "Debate created",
        content: {
          "application/json": {
            schema: z.object({
              success: z.boolean(),
              debate_id: z.string(),
              title: z.string(),
              mode: z.string(),
              status: z.string(),
              needs: z.string(),
            }),
          },
        },
      },
    },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = createDebateSchema.parse(body);
    const db = c.env.DB;
    const debateId = generateDebateId();
    const now = new Date().toISOString();

    // Determine initial status
    let status = "open";
    let currentTurn = 0;

    // If thesis provided, debate is in progress
    if (data.thesis_position) {
      status = "in_progress";
      currentTurn = 1;
    }

    await db
      .prepare(`
        INSERT INTO debates
        (debate_id, title, topic, mode, status, thesis_agent, thesis_position, thesis_submitted_at,
         max_turns, current_turn, turn_timeout_minutes, output_channel, created_by, created_at, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        debateId,
        data.title,
        data.topic,
        data.mode,
        status,
        data.thesis_agent || null,
        data.thesis_position || null,
        data.thesis_position ? now : null,
        data.max_turns,
        currentTurn,
        data.turn_timeout_minutes,
        data.output_channel,
        data.created_by,
        now,
        data.metadata ? JSON.stringify(data.metadata) : null
      )
      .run();

    // If thesis provided, log the first turn
    if (data.thesis_position && data.thesis_agent) {
      await db
        .prepare(`
          INSERT INTO debate_turns (debate_id, turn_number, agent_id, role, content, created_at)
          VALUES (?, 1, ?, 'thesis', ?, ?)
        `)
        .bind(debateId, data.thesis_agent, data.thesis_position, now)
        .run();
    }

    // Broadcast to debate-open channel
    await db
      .prepare(`
        INSERT INTO inbox (channel, from_agent, message_type, content, metadata, created_at)
        VALUES ('debate-open', ?, 'json', ?, ?, ?)
      `)
      .bind(
        data.created_by,
        JSON.stringify({
          debate_id: debateId,
          title: data.title,
          topic: data.topic,
          mode: data.mode,
          needs: data.thesis_position ? "antithesis" : "thesis",
        }),
        JSON.stringify({ debate_id: debateId }),
        now
      )
      .run();

    return c.json({
      success: true,
      debate_id: debateId,
      title: data.title,
      mode: data.mode,
      status,
      needs: data.thesis_position ? "antithesis" : "thesis",
    });
  }
}

export class DebateList extends OpenAPIRoute {
  schema = {
    summary: "List debates",
    request: {
      query: z.object({
        status: z.string().optional(),
        mode: z.string().optional(),
        limit: z.coerce.number().int().default(20),
      }),
    },
    responses: {
      200: { description: "Debates list" },
    },
  };

  async handle(c: AppContext) {
    const query = c.req.query();
    const db = c.env.DB;

    let sql = "SELECT debate_id, title, topic, mode, status, thesis_agent, antithesis_agent, current_turn, max_turns, created_at FROM debates WHERE 1=1";
    const params: string[] = [];

    if (query.status) {
      sql += " AND status = ?";
      params.push(query.status);
    }
    if (query.mode) {
      sql += " AND mode = ?";
      params.push(query.mode);
    }

    sql += ` ORDER BY created_at DESC LIMIT ${parseInt(query.limit || "20")}`;

    const debates = await db.prepare(sql).bind(...params).all();

    return c.json({
      success: true,
      debates: debates.results || [],
    });
  }
}

export class DebateRead extends OpenAPIRoute {
  schema = {
    summary: "Get debate details",
    request: {
      params: z.object({ debateId: z.string() }),
    },
    responses: {
      200: { description: "Debate found" },
      404: { description: "Debate not found" },
    },
  };

  async handle(c: AppContext) {
    const debateId = c.req.param("debateId");
    const db = c.env.DB;

    const debate = await db
      .prepare("SELECT * FROM debates WHERE debate_id = ?")
      .bind(debateId)
      .first();

    if (!debate) {
      return c.json({ success: false, error: "Debate not found" }, 404);
    }

    const turns = await db
      .prepare("SELECT * FROM debate_turns WHERE debate_id = ? ORDER BY turn_number, created_at")
      .bind(debateId)
      .all();

    return c.json({
      success: true,
      debate: {
        ...debate,
        metadata: debate.metadata ? JSON.parse(debate.metadata as string) : null,
      },
      turns: (turns.results || []).map((t: Record<string, unknown>) => ({
        ...t,
        claims: t.claims ? JSON.parse(t.claims as string) : [],
        evidence: t.evidence ? JSON.parse(t.evidence as string) : [],
        concessions: t.concessions ? JSON.parse(t.concessions as string) : [],
      })),
    });
  }
}
