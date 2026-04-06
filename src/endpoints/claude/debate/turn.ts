import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";
import { submitTurnSchema, scoreTurnSchema, buildSynthesisPrompt, buildRapBattlePrompt } from "./base";

export class DebateTurn extends OpenAPIRoute {
  schema = {
    summary: "Submit a debate turn",
    description: "Submit thesis, antithesis, rebuttal, or synthesis. Auto-advances debate state.",
    request: {
      params: z.object({ debateId: z.string() }),
      body: {
        content: {
          "application/json": { schema: submitTurnSchema },
        },
      },
    },
    responses: {
      200: { description: "Turn submitted" },
      400: { description: "Invalid turn" },
      404: { description: "Debate not found" },
    },
  };

  async handle(c: AppContext) {
    const debateId = c.req.param("debateId");
    const body = await c.req.json();
    const data = submitTurnSchema.parse(body);
    const db = c.env.DB;
    const now = new Date().toISOString();

    const debate = await db
      .prepare("SELECT * FROM debates WHERE debate_id = ?")
      .bind(debateId)
      .first();

    if (!debate) {
      return c.json({ success: false, error: "Debate not found" }, 404);
    }

    if (debate.status === "closed") {
      return c.json({ success: false, error: "Debate is closed" }, 400);
    }

    // Validate the turn makes sense
    const currentTurn = debate.current_turn as number;
    let newStatus = debate.status as string;
    let newTurn = currentTurn;

    // Handle role-specific logic
    if (data.role === "thesis") {
      if (debate.thesis_position) {
        return c.json({ success: false, error: "Thesis already submitted" }, 400);
      }
      await db
        .prepare("UPDATE debates SET thesis_agent = ?, thesis_position = ?, thesis_submitted_at = ?, status = 'in_progress', current_turn = 1 WHERE debate_id = ?")
        .bind(data.agent_id, data.content, now, debateId)
        .run();
      newStatus = "in_progress";
      newTurn = 1;
    } else if (data.role === "antithesis") {
      if (!debate.thesis_position) {
        return c.json({ success: false, error: "Thesis must be submitted first" }, 400);
      }
      if (debate.antithesis_position) {
        return c.json({ success: false, error: "Antithesis already submitted" }, 400);
      }
      newTurn = currentTurn + 1;
      await db
        .prepare("UPDATE debates SET antithesis_agent = ?, antithesis_position = ?, antithesis_submitted_at = ?, current_turn = ? WHERE debate_id = ?")
        .bind(data.agent_id, data.content, now, newTurn, debateId)
        .run();
    } else if (data.role === "rebuttal") {
      if (!debate.antithesis_position) {
        return c.json({ success: false, error: "Antithesis must be submitted first" }, 400);
      }
      newTurn = currentTurn + 1;
      // Check if we've hit max turns
      if (newTurn >= (debate.max_turns as number)) {
        newStatus = "synthesizing";
      }
      await db
        .prepare("UPDATE debates SET current_turn = ?, status = ? WHERE debate_id = ?")
        .bind(newTurn, newStatus, debateId)
        .run();
    } else if (data.role === "synthesis") {
      if (debate.status !== "synthesizing" && currentTurn < 2) {
        return c.json({ success: false, error: "Debate not ready for synthesis" }, 400);
      }
      await db
        .prepare("UPDATE debates SET synthesis_agent = ?, synthesis = ?, synthesis_submitted_at = ?, status = 'closed', closed_at = ? WHERE debate_id = ?")
        .bind(data.agent_id, data.content, now, now, debateId)
        .run();
      newStatus = "closed";

      // Push synthesis to output channel
      await db
        .prepare(`
          INSERT INTO inbox (channel, from_agent, message_type, content, metadata, created_at)
          VALUES (?, ?, 'synthesis', ?, ?, ?)
        `)
        .bind(
          debate.output_channel,
          data.agent_id,
          data.content,
          JSON.stringify({ debate_id: debateId, title: debate.title, topic: debate.topic }),
          now
        )
        .run();
    }

    // Record the turn
    await db
      .prepare(`
        INSERT INTO debate_turns (debate_id, turn_number, agent_id, role, content, claims, evidence, concessions, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        debateId,
        newTurn,
        data.agent_id,
        data.role,
        data.content,
        data.claims ? JSON.stringify(data.claims) : null,
        data.evidence ? JSON.stringify(data.evidence) : null,
        data.concessions ? JSON.stringify(data.concessions) : null,
        now
      )
      .run();

    // Determine what's needed next
    let needs = "";
    if (newStatus === "in_progress") {
      if (!debate.antithesis_position && data.role !== "antithesis") {
        needs = "antithesis";
      } else {
        needs = "rebuttal or synthesis";
      }
    } else if (newStatus === "synthesizing") {
      needs = "synthesis";
    }

    return c.json({
      success: true,
      debate_id: debateId,
      role: data.role,
      turn_number: newTurn,
      status: newStatus,
      needs,
    });
  }
}

export class DebateScoreTurn extends OpenAPIRoute {
  schema = {
    summary: "Score a debate turn",
    request: {
      params: z.object({
        debateId: z.string(),
        turnId: z.string(),
      }),
      body: {
        content: {
          "application/json": { schema: scoreTurnSchema },
        },
      },
    },
    responses: {
      200: { description: "Turn scored" },
    },
  };

  async handle(c: AppContext) {
    const turnId = c.req.param("turnId");
    const body = await c.req.json();
    const data = scoreTurnSchema.parse(body);
    const db = c.env.DB;

    await db
      .prepare("UPDATE debate_turns SET score = ?, scored_by = ?, score_reason = ? WHERE id = ?")
      .bind(data.score, data.scored_by, data.reason || null, turnId)
      .run();

    return c.json({ success: true, turn_id: turnId, score: data.score });
  }
}

export class DebateGetPrompt extends OpenAPIRoute {
  schema = {
    summary: "Get prompt for next turn",
    description: "Returns a prompt appropriate for the next required action in the debate",
    request: {
      params: z.object({ debateId: z.string() }),
      query: z.object({
        role: z.string().optional(),
      }),
    },
    responses: {
      200: { description: "Prompt generated" },
      404: { description: "Debate not found" },
    },
  };

  async handle(c: AppContext) {
    const debateId = c.req.param("debateId");
    const requestedRole = c.req.query("role");
    const db = c.env.DB;

    const debate = await db
      .prepare("SELECT * FROM debates WHERE debate_id = ?")
      .bind(debateId)
      .first();

    if (!debate) {
      return c.json({ success: false, error: "Debate not found" }, 404);
    }

    let prompt = "";
    let role = requestedRole || "";
    const mode = debate.mode as string;
    const topic = debate.topic as string;

    if (mode === "rap_battle") {
      // Get last turn content
      const lastTurn = await db
        .prepare("SELECT content FROM debate_turns WHERE debate_id = ? ORDER BY turn_number DESC LIMIT 1")
        .bind(debateId)
        .first();

      const opponentBars = lastTurn?.content as string || "First up - drop your opening bars!";
      prompt = buildRapBattlePrompt(opponentBars, topic, (debate.current_turn as number) + 1);
      role = "rebuttal";
    } else {
      // Hegelian/adversarial/collaborative
      if (!debate.thesis_position) {
        role = "thesis";
        prompt = `You are presenting the THESIS position in a ${mode} debate.

TOPIC: ${topic}

Present your thesis position. Be clear, provide evidence, and make concrete claims.`;
      } else if (!debate.antithesis_position) {
        role = "antithesis";
        prompt = `You are presenting the ANTITHESIS position in a ${mode} debate.

TOPIC: ${topic}

THESIS (your opponent's position):
${debate.thesis_position}

Present your antithesis. Challenge the thesis directly, provide counter-evidence, and make your own claims.`;
      } else if (debate.status === "synthesizing" || requestedRole === "synthesis") {
        role = "synthesis";
        prompt = buildSynthesisPrompt(
          debate.thesis_position as string,
          debate.antithesis_position as string,
          topic
        );
      } else {
        role = "rebuttal";
        const lastTurn = await db
          .prepare("SELECT content, role FROM debate_turns WHERE debate_id = ? ORDER BY turn_number DESC LIMIT 1")
          .bind(debateId)
          .first();

        prompt = `You are presenting a REBUTTAL in a ${mode} debate.

TOPIC: ${topic}

Last position (${lastTurn?.role}):
${lastTurn?.content}

Respond to the above. You may concede valid points, but strengthen your overall position.`;
      }
    }

    return c.json({
      success: true,
      debate_id: debateId,
      role,
      mode,
      topic: debate.topic,
      prompt,
      current_turn: debate.current_turn,
      max_turns: debate.max_turns,
    });
  }
}
