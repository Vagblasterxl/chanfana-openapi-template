import { SELF } from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";

// API key configured in wrangler.jsonc vars.API_KEY
const API_KEY = "symphony-ken-2026";
const auth = { Authorization: `Bearer ${API_KEY}` };
const jsonHeaders = { "Content-Type": "application/json", ...auth };

describe("Symphony Coordination Endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /health (no auth)", () => {
    it("should return health status without auth", async () => {
      const response = await SELF.fetch("http://local.test/health");
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        timestamp: string;
        agent_count: number;
        service: string;
      }>();
      expect(body.success).toBe(true);
      expect(body.service).toBe("symphony-coordination");
      expect(typeof body.agent_count).toBe("number");
      expect(typeof body.timestamp).toBe("string");
    });
  });

  describe("Auth middleware", () => {
    it("should reject /agents without bearer token", async () => {
      const response = await SELF.fetch("http://local.test/agents");
      expect(response.status).toBe(401);
    });

    it("should reject /messages with wrong token", async () => {
      const response = await SELF.fetch("http://local.test/messages", {
        headers: { Authorization: "Bearer wrong-token" },
      });
      expect(response.status).toBe(403);
    });
  });

  describe("POST /agents/register", () => {
    it("should register a new agent", async () => {
      const response = await SELF.fetch(
        "http://local.test/agents/register",
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            id: "test-agent-1",
            name: "Test Agent",
            type: "claude",
          }),
        },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        agent: { id: string; status: string };
      }>();
      expect(body.success).toBe(true);
      expect(body.agent.id).toBe("test-agent-1");
      expect(body.agent.status).toBe("online");
    });

    it("should upsert on duplicate ID", async () => {
      // First register
      await SELF.fetch("http://local.test/agents/register", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          id: "upsert-test",
          name: "Original Name",
          type: "claude",
        }),
      });

      // Re-register with new name
      const response = await SELF.fetch(
        "http://local.test/agents/register",
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            id: "upsert-test",
            name: "Updated Name",
            type: "discord-bot",
          }),
        },
      );
      expect(response.status).toBe(200);
    });
  });

  describe("POST /agents/:id/heartbeat", () => {
    it("should accept heartbeat and return pending message count", async () => {
      // Register first
      await SELF.fetch("http://local.test/agents/register", {
        method: "POST",
        headers: jsonHeaders,
        body: JSON.stringify({
          id: "heartbeat-agent",
          name: "Heartbeat Agent",
          type: "claude",
        }),
      });

      const response = await SELF.fetch(
        "http://local.test/agents/heartbeat-agent/heartbeat",
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({ status: "online" }),
        },
      );
      expect(response.status).toBe(200);
      const body = await response.json<{
        success: boolean;
        pending_messages: number;
      }>();
      expect(body.success).toBe(true);
      expect(typeof body.pending_messages).toBe("number");
    });
  });

  describe("Messages flow: send + receive", () => {
    it("should round-trip a message between two agents", async () => {
      // Register sender + recipient
      for (const id of ["msg-sender", "msg-recipient"]) {
        await SELF.fetch("http://local.test/agents/register", {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            id,
            name: id,
            type: "claude",
          }),
        });
      }

      // Send a message
      const sendResp = await SELF.fetch(
        "http://local.test/messages/send",
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            sender: "msg-sender",
            recipient: "msg-recipient",
            message_type: "command",
            payload: JSON.stringify({ action: "test" }),
          }),
        },
      );
      expect(sendResp.status).toBe(200);
      const sendBody = await sendResp.json<{
        success: boolean;
        message_id: string;
      }>();
      expect(sendBody.success).toBe(true);
      expect(sendBody.message_id).toMatch(/^msg-/);

      // Receive
      const recvResp = await SELF.fetch(
        "http://local.test/messages/receive/msg-recipient",
        { headers: auth },
      );
      expect(recvResp.status).toBe(200);
      const recvBody = await recvResp.json<{
        success: boolean;
        messages: any[];
      }>();
      expect(recvBody.success).toBe(true);
      expect(recvBody.messages.length).toBeGreaterThan(0);
      expect(recvBody.messages[0].sender).toBe("msg-sender");
      expect(recvBody.messages[0].message_type).toBe("command");
    });
  });

  describe("State get + update", () => {
    it("should upsert and read coordination state", async () => {
      const stateId = "test-state-1";

      // Update (creates)
      const updateResp = await SELF.fetch(
        "http://local.test/state/update",
        {
          method: "POST",
          headers: jsonHeaders,
          body: JSON.stringify({
            id: stateId,
            state_type: "session",
            active_agents: JSON.stringify(["agent-1", "agent-2"]),
            shared_context: JSON.stringify({ session_started: true }),
          }),
        },
      );
      expect(updateResp.status).toBe(200);

      // Read
      const getResp = await SELF.fetch(
        `http://local.test/state/${stateId}`,
        { headers: auth },
      );
      expect(getResp.status).toBe(200);
      const getBody = await getResp.json<{
        success: boolean;
        state: any;
      }>();
      expect(getBody.success).toBe(true);
      expect(getBody.state.id).toBe(stateId);
      expect(getBody.state.state_type).toBe("session");
    });
  });
});
