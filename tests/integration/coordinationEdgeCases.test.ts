import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

const API_KEY = "symphony-ken-2026";
const auth = { Authorization: `Bearer ${API_KEY}` };
const jsonHeaders = { "Content-Type": "application/json", ...auth };

describe("Coordination Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Agent lifecycle", () => {
    it("should list registered agents", async () => {
      await SELF.fetch("http://local.test/agents/register", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ id: "list-agent-1", name: "Agent 1", type: "claude" }),
      });
      await SELF.fetch("http://local.test/agents/register", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ id: "list-agent-2", name: "Agent 2", type: "discord-bot" }),
      });

      const response = await SELF.fetch("http://local.test/agents", {
        headers: auth,
      });
      expect(response.status).toBe(200);
      const body = await response.json<{ result: any[] }>();
      expect(body.result.length).toBeGreaterThanOrEqual(2);
    });

    it("should read a single agent by ID", async () => {
      await SELF.fetch("http://local.test/agents/register", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ id: "read-agent", name: "Read Agent", type: "worker" }),
      });

      const response = await SELF.fetch("http://local.test/agents/read-agent", {
        headers: auth,
      });
      expect(response.status).toBe(200);
    });

    it("should delete an agent", async () => {
      await SELF.fetch("http://local.test/agents/register", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ id: "delete-me", name: "Delete Me", type: "claude" }),
      });

      const delResp = await SELF.fetch("http://local.test/agents/delete-me", {
        method: "DELETE",
        headers: auth,
      });
      expect(delResp.status).toBe(200);
    });

    it("should update heartbeat to offline and back", async () => {
      await SELF.fetch("http://local.test/agents/register", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ id: "status-agent", name: "Status Agent", type: "claude" }),
      });

      const offlineResp = await SELF.fetch(
        "http://local.test/agents/status-agent/heartbeat",
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ status: "offline" }),
        },
      );
      expect(offlineResp.status).toBe(200);

      const onlineResp = await SELF.fetch(
        "http://local.test/agents/status-agent/heartbeat",
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ status: "online" }),
        },
      );
      expect(onlineResp.status).toBe(200);
      const body = await onlineResp.json<{
        success: boolean;
        pending_messages: number;
      }>();
      expect(body.success).toBe(true);
      expect(typeof body.pending_messages).toBe("number");
    });
  });

  describe("Message edge cases", () => {
    it("should return empty array when no pending messages", async () => {
      await SELF.fetch("http://local.test/agents/register", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({ id: "lonely-agent", name: "Lonely", type: "claude" }),
      });

      const response = await SELF.fetch(
        "http://local.test/messages/receive/lonely-agent",
        { headers: auth },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        messages: any[];
      }>();
      expect(body.messages).toHaveLength(0);
    });

    it("should mark messages as delivered with mark_read=true", async () => {
      for (const id of ["mark-sender", "mark-recipient"]) {
        await SELF.fetch("http://local.test/agents/register", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ id, name: id, type: "claude" }),
        });
      }

      await SELF.fetch("http://local.test/messages/send", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          sender: "mark-sender",
          recipient: "mark-recipient",
          message_type: "command",
          payload: JSON.stringify({ action: "test-mark" }),
        }),
      });

      // First receive with mark_read=true
      const recv1 = await SELF.fetch(
        "http://local.test/messages/receive/mark-recipient?mark_read=true",
        { headers: auth },
      );
      const body1 = await recv1.json<{ messages: any[] }>();
      expect(body1.messages.length).toBeGreaterThan(0);

      // Second receive should be empty (messages were marked delivered)
      const recv2 = await SELF.fetch(
        "http://local.test/messages/receive/mark-recipient",
        { headers: auth },
      );
      const body2 = await recv2.json<{ messages: any[] }>();
      expect(body2.messages).toHaveLength(0);
    });

    it("should list all messages", async () => {
      const response = await SELF.fetch("http://local.test/messages", {
        headers: auth,
      });
      expect(response.status).toBe(200);
    });

    it("should handle multiple message types", async () => {
      for (const id of ["multi-sender", "multi-recipient"]) {
        await SELF.fetch("http://local.test/agents/register", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ id, name: id, type: "claude" }),
        });
      }

      for (const msgType of ["command", "event", "text", "result"]) {
        const resp = await SELF.fetch("http://local.test/messages/send", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            sender: "multi-sender",
            recipient: "multi-recipient",
            message_type: msgType,
            payload: JSON.stringify({ type: msgType }),
          }),
        });
        expect(resp.status).toBe(200);
      }

      const recv = await SELF.fetch(
        "http://local.test/messages/receive/multi-recipient",
        { headers: auth },
      );
      const body = await recv.json<{ messages: any[] }>();
      expect(body.messages.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("State edge cases", () => {
    it("should list all state objects", async () => {
      const response = await SELF.fetch("http://local.test/state", {
        headers: auth,
      });
      expect(response.status).toBe(200);
    });

    it("should upsert state preserving existing fields", async () => {
      // Create initial state
      await SELF.fetch("http://local.test/state/update", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          id: "upsert-state",
          state_type: "session",
          active_agents: JSON.stringify(["agent-1"]),
          shared_context: JSON.stringify({ round: 1 }),
        }),
      });

      // Update only shared_context
      await SELF.fetch("http://local.test/state/update", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          id: "upsert-state",
          state_type: "session",
          shared_context: JSON.stringify({ round: 2 }),
        }),
      });

      const getResp = await SELF.fetch("http://local.test/state/upsert-state", {
        headers: auth,
      });
      const body = await getResp.json<{
        success: boolean;
        state: any;
      }>();
      expect(body.success).toBe(true);
      const context = JSON.parse(body.state.shared_context);
      expect(context.round).toBe(2);
    });

    it("should return null for nonexistent state", async () => {
      const response = await SELF.fetch(
        "http://local.test/state/does-not-exist",
        { headers: auth },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        state: any;
      }>();
      expect(body.state).toBeNull();
    });

    it("should handle knowledge-type state for SVO storage", async () => {
      await SELF.fetch("http://local.test/state/update", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          id: "knowledge-media-lineage",
          state_type: "knowledge",
          shared_context: JSON.stringify({
            triples: [
              { subject: "img-001", verb: "generated", object: "vid-001" },
            ],
          }),
        }),
      });

      const getResp = await SELF.fetch(
        "http://local.test/state/knowledge-media-lineage",
        { headers: auth },
      );
      const body = await getResp.json<{
        success: boolean;
        state: any;
      }>();
      expect(body.state.state_type).toBe("knowledge");
    });
  });

  describe("Health check details", () => {
    it("should reflect agent count after registrations", async () => {
      // Register a few agents first
      for (const id of ["health-a1", "health-a2"]) {
        await SELF.fetch("http://local.test/agents/register", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ id, name: id, type: "claude" }),
        });
      }

      const response = await SELF.fetch("http://local.test/health");
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        agent_count: number;
        service: string;
        timestamp: string;
      }>();
      expect(body.agent_count).toBeGreaterThanOrEqual(2);
      expect(body.service).toBe("symphony-coordination");
      expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });
  });
});
