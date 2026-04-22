import { OpenAPIRoute } from "chanfana";
import { z } from "zod";
import { AppContext } from "../../../types";
import { createLateralSessionSchema, relayLateralMessageSchema, generateSessionId, generateTaskId, estimateTokens } from "../budget/base";

export class LateralSessionCreate extends OpenAPIRoute {
  schema = {
    summary: "Start a lateral coordination session",
    description: "Create a session where multiple Claudes across different Slacks/platforms coordinate via Manus as lubricant",
    request: {
      body: {
        content: {
          "application/json": { schema: createLateralSessionSchema },
        },
      },
    },
    responses: { 200: { description: "Lateral session started" } },
  };

  async handle(c: AppContext) {
    const body = await c.req.json();
    const data = createLateralSessionSchema.parse(body);
    const db = c.env.DB;
    const sessionId = generateSessionId();
    const now = new Date().toISOString();

    await db
      .prepare(`
        INSERT INTO lateral_sessions
        (session_id, purpose, participants, coordinator_agent, coordinator_platform, budget_mode, started_at, last_activity_at, metadata)
        VALUES (?, ?, ?, ?, 'manus', ?, ?, ?, ?)
      `)
      .bind(
        sessionId,
        data.purpose,
        JSON.stringify(data.participants),
        data.coordinator_agent || "manus-free",
        data.budget_mode,
        now,
        now,
        data.metadata ? JSON.stringify(data.metadata) : null
      )
      .run();

    // Announce to all participants via inbox
    for (const participant of data.participants) {
      await db
        .prepare(`
          INSERT INTO inbox (channel, from_agent, to_agent, message_type, content, metadata, created_at)
          VALUES ('lateral-coord', 'coordinator', ?, 'command', ?, ?, ?)
        `)
        .bind(
          participant.agent_id,
          JSON.stringify({
            action: "join_lateral_session",
            session_id: sessionId,
            purpose: data.purpose,
            other_participants: data.participants.filter(p => p.agent_id !== participant.agent_id),
          }),
          JSON.stringify({ lateral_session_id: sessionId }),
          now
        )
        .run();
    }

    return c.json({
      success: true,
      session_id: sessionId,
      purpose: data.purpose,
      participants: data.participants,
      coordinator: data.coordinator_agent || "manus-free",
    });
  }
}

export class LateralRelay extends OpenAPIRoute {
  schema = {
    summary: "Relay a message through lateral session",
    description: "Send a message from one participant to another via Manus coordinator. Respects budget_mode.",
    request: {
      params: z.object({ sessionId: z.string() }),
      body: {
        content: {
          "application/json": { schema: relayLateralMessageSchema },
        },
      },
    },
    responses: {
      200: { description: "Message relayed" },
      402: { description: "Insufficient budget" },
      404: { description: "Session not found" },
    },
  };

  async handle(c: AppContext) {
    const sessionId = c.req.param("sessionId");
    const body = await c.req.json();
    const data = relayLateralMessageSchema.parse(body);
    const db = c.env.DB;
    const now = new Date().toISOString();

    // Get session
    const session = await db
      .prepare("SELECT * FROM lateral_sessions WHERE session_id = ? AND status = 'active'")
      .bind(sessionId)
      .first();

    if (!session) {
      return c.json({ success: false, error: "Session not found or not active" }, 404);
    }

    const participants = JSON.parse(session.participants as string) as Array<{
      agent_id: string;
      platform: string;
      slack_workspace?: string;
      channel?: string;
    }>;

    // Find sender
    const sender = participants.find(p => p.agent_id === data.from_agent);
    if (!sender) {
      return c.json({ success: false, error: "Sender not in session" }, 400);
    }

    // Find recipients (all others if no specific to_agent)
    const recipients = data.to_agent
      ? participants.filter(p => p.agent_id === data.to_agent)
      : participants.filter(p => p.agent_id !== data.from_agent);

    if (recipients.length === 0) {
      return c.json({ success: false, error: "No recipients" }, 400);
    }

    const estimatedTokens = estimateTokens(data.content) + 50; // +50 for Manus overhead

    // Check Manus budget if using Manus
    if (data.use_manus) {
      const manusBudget = await db
        .prepare("SELECT * FROM token_budgets WHERE platform = 'manus' AND active = 1 ORDER BY priority DESC LIMIT 1")
        .first();

      if (manusBudget && manusBudget.daily_limit) {
        const available = (manusBudget.daily_limit as number) - (manusBudget.tokens_used_today as number);
        if (available < estimatedTokens) {
          return c.json({
            success: false,
            error: "Insufficient Manus budget for today",
            available,
            needed: estimatedTokens,
            suggestion: "Wait for daily reset or use direct inbox relay (use_manus: false)",
          }, 402);
        }
      }
    }

    const relayedMessages: Array<{ to_agent: string; relay_id: number; method: string }> = [];

    // Relay to each recipient
    for (const recipient of recipients) {
      let relayMethod = data.use_manus ? "manus_browse" : "direct_inbox";
      let relayTokens = 0;

      // Log the lateral message
      const msgResult = await db
        .prepare(`
          INSERT INTO lateral_messages
          (lateral_session_id, from_agent, from_platform, from_slack, to_agent, to_platform, to_slack, content, message_type, relay_method, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          sessionId,
          data.from_agent,
          sender.platform,
          sender.slack_workspace || null,
          recipient.agent_id,
          recipient.platform,
          recipient.slack_workspace || null,
          data.content,
          data.message_type,
          relayMethod,
          "pending",
          now
        )
        .run();

      const relayId = msgResult.meta.last_row_id as number;

      // If using Manus and recipient is on different Slack workspace, create Manus task
      if (data.use_manus && recipient.platform === "slack" && sender.slack_workspace !== recipient.slack_workspace) {
        const taskId = generateTaskId();
        relayTokens = estimatedTokens;

        await db
          .prepare(`
            INSERT INTO manus_tasks
            (task_id, task_type, task_content, estimated_tokens, lateral_session_id, triggered_by_agent, created_at)
            VALUES (?, 'lateral_relay', ?, ?, ?, ?, ?)
          `)
          .bind(
            taskId,
            JSON.stringify({
              action: "relay_slack_message",
              from_workspace: sender.slack_workspace,
              to_workspace: recipient.slack_workspace,
              to_channel: recipient.channel,
              to_agent: recipient.agent_id,
              message: data.content,
            }),
            estimatedTokens,
            sessionId,
            data.from_agent,
            now
          )
          .run();

        // Record Manus token usage
        await db
          .prepare(`
            UPDATE token_budgets SET
              tokens_used_today = tokens_used_today + ?,
              tokens_used_this_month = tokens_used_this_month + ?,
              total_tokens = total_tokens + ?,
              last_used_at = ?
            WHERE platform = 'manus' AND active = 1
          `)
          .bind(relayTokens, relayTokens, relayTokens, now)
          .run();

        // Update session manus counter
        await db
          .prepare("UPDATE lateral_sessions SET manus_tokens_used = manus_tokens_used + ?, total_tokens_consumed = total_tokens_consumed + ? WHERE session_id = ?")
          .bind(relayTokens, relayTokens, sessionId)
          .run();
      } else {
        // Direct inbox relay (free, no Manus needed)
        relayMethod = "direct_inbox";
        await db
          .prepare(`
            INSERT INTO inbox (channel, from_agent, to_agent, message_type, content, metadata, created_at)
            VALUES ('lateral-coord', ?, ?, ?, ?, ?, ?)
          `)
          .bind(
            data.from_agent,
            recipient.agent_id,
            data.message_type,
            data.content,
            JSON.stringify({ lateral_session_id: sessionId, relay_id: relayId }),
            now
          )
          .run();
      }

      await db
        .prepare("UPDATE lateral_messages SET status = 'relayed', relay_method = ?, relay_tokens_used = ? WHERE id = ?")
        .bind(relayMethod, relayTokens, relayId)
        .run();

      relayedMessages.push({ to_agent: recipient.agent_id, relay_id: relayId, method: relayMethod });
    }

    // Update session activity
    await db
      .prepare("UPDATE lateral_sessions SET last_activity_at = ?, message_counter = message_counter + 1 WHERE session_id = ?")
      .bind(now, sessionId)
      .run();

    return c.json({
      success: true,
      session_id: sessionId,
      relayed_to: relayedMessages,
      tokens_used: estimatedTokens,
    });
  }
}

export class LateralSessionList extends OpenAPIRoute {
  schema = {
    summary: "List lateral sessions",
    request: {
      query: z.object({
        status: z.string().optional(),
      }),
    },
    responses: { 200: { description: "Sessions list" } },
  };

  async handle(c: AppContext) {
    const query = c.req.query();
    const db = c.env.DB;

    let sql = "SELECT session_id, purpose, status, coordinator_agent, budget_mode, message_counter, total_tokens_consumed, manus_tokens_used, started_at, last_activity_at FROM lateral_sessions WHERE 1=1";
    const params: string[] = [];

    if (query.status) {
      sql += " AND status = ?";
      params.push(query.status);
    }

    sql += " ORDER BY last_activity_at DESC LIMIT 50";

    const sessions = await db.prepare(sql).bind(...params).all();

    return c.json({
      success: true,
      sessions: sessions.results || [],
    });
  }
}

export class LateralSessionRead extends OpenAPIRoute {
  schema = {
    summary: "Get lateral session with message history",
    request: {
      params: z.object({ sessionId: z.string() }),
    },
    responses: { 200: { description: "Session details" } },
  };

  async handle(c: AppContext) {
    const sessionId = c.req.param("sessionId");
    const db = c.env.DB;

    const session = await db
      .prepare("SELECT * FROM lateral_sessions WHERE session_id = ?")
      .bind(sessionId)
      .first();

    if (!session) {
      return c.json({ success: false, error: "Session not found" }, 404);
    }

    const messages = await db
      .prepare("SELECT * FROM lateral_messages WHERE lateral_session_id = ? ORDER BY created_at")
      .bind(sessionId)
      .all();

    return c.json({
      success: true,
      session: {
        ...session,
        participants: JSON.parse(session.participants as string),
      },
      messages: messages.results || [],
    });
  }
}
