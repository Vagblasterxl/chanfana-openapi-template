import {
  createExecutionContext,
  env,
  SELF,
  waitOnExecutionContext,
} from "cloudflare:test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import worker from "../../src/index";

const SECRET = "polar_whs_test_secret";

// Seeded by migration 0002.
const WARDEN_PRODUCT = "2c1fb64e-717f-47f6-943f-86e8ccfe5e41";
const RECEIVER_PRODUCT = "cb2d4696-adbc-4f92-a214-1f67c19e3b8f";

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

async function signWith(
  key: Uint8Array,
  webhookId: string,
  timestamp: number,
  body: string,
): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    new TextEncoder().encode(`${webhookId}.${timestamp}.${body}`),
  );
  return `v1,${base64(new Uint8Array(mac))}`;
}

interface DeliveryOptions {
  webhookId?: string;
  timestamp?: number;
  signature?: string;
  secret?: string;
  omitHeaders?: boolean;
}

async function deliver(payload: unknown, options: DeliveryOptions = {}) {
  const body = JSON.stringify(payload);
  const webhookId = options.webhookId ?? `msg_${crypto.randomUUID()}`;
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (!options.omitHeaders) {
    headers["webhook-id"] = webhookId;
    headers["webhook-timestamp"] = String(timestamp);
    headers["webhook-signature"] =
      options.signature ??
      (await signWith(
        new TextEncoder().encode(options.secret ?? SECRET),
        webhookId,
        timestamp,
        body,
      ));
  }

  const response = await SELF.fetch("http://local.test/polar/webhook", {
    method: "POST",
    headers,
    body,
  });

  return { response, webhookId, body };
}

function subscriptionEvent(
  type: string,
  overrides: Record<string, unknown> = {},
  timestamp = "2026-09-11T13:26:15Z",
) {
  return {
    type,
    timestamp,
    data: {
      id: "8a94b735-aa9d-4009-a47d-323e31c2ee2f",
      status: "active",
      product_id: WARDEN_PRODUCT,
      customer_id: "cus_claude_cannon",
      modified_at: "2026-09-11T13:26:15Z",
      product: { id: WARDEN_PRODUCT, name: "OMEGA Role - Warden" },
      customer: { id: "cus_claude_cannon", external_id: "claude-cannon" },
      ...overrides,
    },
  };
}

/**
 * Run the Worker with an overridden binding. `SELF` always uses the bindings
 * from the test config, so this is the only way to exercise a differently
 * configured (or unconfigured) secret.
 */
async function fetchWithEnv(
  request: Request,
  overrides: Record<string, unknown>,
): Promise<Response> {
  const ctx = createExecutionContext();
  const response = await worker.fetch(
    request,
    { ...env, ...overrides } as typeof env,
    ctx,
  );
  await waitOnExecutionContext(ctx);
  return response;
}

async function readEntitlements(query = "") {
  const response = await SELF.fetch(
    `http://local.test/polar/entitlements${query}`,
  );
  return response.json<{ success: boolean; result: any[] }>();
}

describe("Polar webhook verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a delivery with no signature headers", async () => {
    const { response } = await deliver(subscriptionEvent("subscription.updated"), {
      omitHeaders: true,
    });

    expect(response.status).toBe(401);
    const body = await response.json<{ success: boolean; errors: any[] }>();
    expect(body.success).toBe(false);
    expect(body.errors[0].message).toContain("missing_headers");
  });

  it("rejects a signature computed with the wrong secret", async () => {
    const { response } = await deliver(subscriptionEvent("subscription.updated"), {
      secret: "not-the-secret",
    });

    expect(response.status).toBe(401);
    const body = await response.json<{ errors: any[] }>();
    expect(body.errors[0].message).toContain("no_matching_signature");
  });

  it("rejects a correctly signed body that was altered in transit", async () => {
    const payload = subscriptionEvent("subscription.updated");
    const body = JSON.stringify(payload);
    const webhookId = "msg_tampered";
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await signWith(
      new TextEncoder().encode(SECRET),
      webhookId,
      timestamp,
      body,
    );

    const response = await SELF.fetch("http://local.test/polar/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webhook-id": webhookId,
        "webhook-timestamp": String(timestamp),
        "webhook-signature": signature,
      },
      body: body.replace(WARDEN_PRODUCT, RECEIVER_PRODUCT),
    });

    expect(response.status).toBe(401);
  });

  it("rejects a replayable delivery outside the timestamp tolerance", async () => {
    const { response } = await deliver(subscriptionEvent("subscription.updated"), {
      timestamp: Math.floor(Date.now() / 1000) - 10 * 60,
    });

    expect(response.status).toBe(401);
    const body = await response.json<{ errors: any[] }>();
    expect(body.errors[0].message).toContain("timestamp_out_of_tolerance");
  });

  it("rejects a non-integer timestamp", async () => {
    const { response } = await deliver(subscriptionEvent("subscription.updated"), {
      timestamp: "not-a-timestamp" as unknown as number,
    });

    expect(response.status).toBe(401);
    const body = await response.json<{ errors: any[] }>();
    expect(body.errors[0].message).toContain("invalid_timestamp");
  });

  it("accepts a signature from any entry in a rotating signature header", async () => {
    const payload = subscriptionEvent("subscription.updated");
    const body = JSON.stringify(payload);
    const webhookId = "msg_rotating";
    const timestamp = Math.floor(Date.now() / 1000);
    const stale = await signWith(
      new TextEncoder().encode("previous-secret"),
      webhookId,
      timestamp,
      body,
    );
    const current = await signWith(
      new TextEncoder().encode(SECRET),
      webhookId,
      timestamp,
      body,
    );

    const response = await SELF.fetch("http://local.test/polar/webhook", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "webhook-id": webhookId,
        "webhook-timestamp": String(timestamp),
        "webhook-signature": `${stale} ${current}`,
      },
      body,
    });

    expect(response.status).toBe(202);
  });

  it("verifies a spec-compliant whsec_ secret against its decoded key", async () => {
    // Secrets Polar issued on or after 2026-09-08 follow Standard Webhooks:
    // the key is the base64-decoded remainder after the whsec_ prefix.
    const keyBytes = crypto.getRandomValues(new Uint8Array(24));
    const body = JSON.stringify(subscriptionEvent("subscription.updated"));
    const webhookId = "msg_whsec";
    const timestamp = Math.floor(Date.now() / 1000);

    const response = await fetchWithEnv(
      new Request("http://local.test/polar/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "webhook-id": webhookId,
          "webhook-timestamp": String(timestamp),
          "webhook-signature": await signWith(keyBytes, webhookId, timestamp, body),
        },
        body,
      }),
      { POLAR_WEBHOOK_SECRET: `whsec_${base64(keyBytes)}` },
    );

    expect(response.status).toBe(202);
  });

  it("fails closed when POLAR_WEBHOOK_SECRET is not configured", async () => {
    const body = JSON.stringify(subscriptionEvent("subscription.updated"));
    const webhookId = "msg_no_secret";
    const timestamp = Math.floor(Date.now() / 1000);

    const response = await fetchWithEnv(
      new Request("http://local.test/polar/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "webhook-id": webhookId,
          "webhook-timestamp": String(timestamp),
          "webhook-signature": await signWith(
            new TextEncoder().encode(SECRET),
            webhookId,
            timestamp,
            body,
          ),
        },
        body,
      }),
      { POLAR_WEBHOOK_SECRET: undefined },
    );

    // The delivery is refused, not accepted unverified — even though this
    // signature is the one a correctly configured Worker would have accepted.
    expect(response.status).toBe(503);
    const parsed = await response.json<{ success: boolean; errors: any[] }>();
    expect(parsed.success).toBe(false);
    expect(parsed.errors[0].message).toContain("not configured");

    const stored = await readEntitlements();
    expect(stored.result).toHaveLength(0);
  });
});

describe("Polar entitlement application", () => {
  it("grants the product's mapped capabilities on an active subscription", async () => {
    const { response } = await deliver(subscriptionEvent("subscription.updated"));

    expect(response.status).toBe(202);
    const body = await response.json<{ success: boolean; result: any }>();
    expect(body.success).toBe(true);
    expect(body.result.handled).toBe(true);
    expect(body.result.replay).toBe(false);
    expect(body.result.capabilities).toEqual([
      "mesh.dispatch",
      "registry.admin",
      "vault.read",
    ]);

    const stored = await readEntitlements();
    expect(stored.result).toHaveLength(1);
    expect(stored.result[0]).toEqual(
      expect.objectContaining({
        subscription_id: "8a94b735-aa9d-4009-a47d-323e31c2ee2f",
        product_id: WARDEN_PRODUCT,
        product_name: "OMEGA Role - Warden",
        status: "active",
        active: true,
        source: "product_map",
        external_customer_id: "claude-cannon",
      }),
    );
  });

  it("prefers capabilities declared in the product's Polar metadata", async () => {
    const { response } = await deliver(
      subscriptionEvent("subscription.updated", {
        product: {
          id: WARDEN_PRODUCT,
          name: "OMEGA Role - Warden",
          metadata: { capabilities: "Registry.Admin, vault.read, vault.read" },
        },
      }),
    );

    expect(response.status).toBe(202);
    const body = await response.json<{ result: any }>();
    expect(body.result.capabilities).toEqual(["registry.admin", "vault.read"]);

    const stored = await readEntitlements();
    expect(stored.result[0].source).toBe("product_metadata");
  });

  it("grants nothing for a product with no mapping and no metadata", async () => {
    const { response } = await deliver(
      subscriptionEvent("subscription.updated", {
        id: "sub_unmapped",
        product_id: "00000000-0000-4000-8000-000000000000",
        product: { id: "00000000-0000-4000-8000-000000000000", name: "Agent Seat" },
      }),
    );

    const body = await response.json<{ result: any }>();
    expect(body.result.capabilities).toEqual([]);

    const stored = await readEntitlements("?customer=cus_claude_cannon");
    expect(stored.result[0].source).toBe("none");
    expect(stored.result[0].active).toBe(true);
  });

  it("revokes capabilities when the subscription stops granting", async () => {
    await deliver(subscriptionEvent("subscription.updated"));

    const { response } = await deliver(
      subscriptionEvent("subscription.revoked", {
        status: "canceled",
        modified_at: "2026-09-11T14:00:00Z",
      }),
    );

    const body = await response.json<{ result: any }>();
    expect(body.result.capabilities).toEqual([]);

    const resolved = await SELF.fetch(
      "http://local.test/polar/entitlements/claude-cannon",
    );
    const resolvedBody = await resolved.json<{ result: any }>();
    expect(resolvedBody.result.capabilities).toEqual([]);
    expect(resolvedBody.result.subscriptions[0].status).toBe("canceled");
    expect(resolvedBody.result.subscriptions[0].active).toBe(false);
  });

  it("does not let a retried older event overwrite newer state", async () => {
    await deliver(
      subscriptionEvent(
        "subscription.revoked",
        { status: "canceled" },
        "2026-09-11T14:00:00Z",
      ),
    );

    // Same subscription, an earlier event redelivered after the newer one.
    await deliver(
      subscriptionEvent(
        "subscription.updated",
        { status: "active" },
        "2026-09-11T13:00:00Z",
      ),
    );

    const stored = await readEntitlements();
    expect(stored.result[0].status).toBe("canceled");
    expect(stored.result[0].active).toBe(false);
  });

  it("acknowledges a replayed delivery without reapplying it", async () => {
    const payload = subscriptionEvent("subscription.updated");
    const webhookId = "msg_replayed";

    const first = await deliver(payload, { webhookId });
    const firstBody = await first.response.json<{ result: any }>();
    expect(firstBody.result.replay).toBe(false);

    const second = await deliver(payload, { webhookId });
    expect(second.response.status).toBe(202);
    const secondBody = await second.response.json<{ result: any }>();
    expect(secondBody.result.replay).toBe(true);

    const stored = await readEntitlements();
    expect(stored.result).toHaveLength(1);
  });

  it("acknowledges verified events it does not act on", async () => {
    const { response } = await deliver({
      type: "customer.updated",
      data: { id: "cus_claude_cannon" },
    });

    expect(response.status).toBe(202);
    const body = await response.json<{ result: any }>();
    expect(body.result.handled).toBe(false);
    expect(body.result.subscription_id).toBeNull();

    const stored = await readEntitlements();
    expect(stored.result).toHaveLength(0);
  });

  it("rejects a verified delivery whose subscription payload is malformed", async () => {
    const { response } = await deliver({
      type: "subscription.updated",
      data: { id: "sub_broken" },
    });

    expect(response.status).toBe(400);
  });
});

describe("Polar entitlement reads", () => {
  it("unions capabilities across a customer's granting subscriptions", async () => {
    await deliver(subscriptionEvent("subscription.updated"));
    await deliver(
      subscriptionEvent("subscription.updated", {
        id: "sub_receiver",
        product_id: RECEIVER_PRODUCT,
        product: { id: RECEIVER_PRODUCT, name: "OMEGA Role - Receiver" },
      }),
    );

    const response = await SELF.fetch(
      "http://local.test/polar/entitlements/cus_claude_cannon",
    );
    const body = await response.json<{ result: any }>();

    expect(body.result.capabilities).toEqual([
      "comms.send",
      "memory.write",
      "mesh.dispatch",
      "registry.admin",
      "vault.read",
    ]);
    expect(body.result.subscriptions).toHaveLength(2);
  });

  it("returns an empty capability set for an unknown customer", async () => {
    const response = await SELF.fetch(
      "http://local.test/polar/entitlements/nobody",
    );

    expect(response.status).toBe(200);
    const body = await response.json<{ success: boolean; result: any }>();
    expect(body.success).toBe(true);
    expect(body.result.capabilities).toEqual([]);
    expect(body.result.subscriptions).toEqual([]);
  });

  it("filters the entitlement list by product and active state", async () => {
    await deliver(subscriptionEvent("subscription.updated"));
    await deliver(
      subscriptionEvent("subscription.updated", {
        id: "sub_receiver",
        status: "past_due",
        product_id: RECEIVER_PRODUCT,
        product: { id: RECEIVER_PRODUCT, name: "OMEGA Role - Receiver" },
      }),
    );

    const byProduct = await readEntitlements(`?product_id=${RECEIVER_PRODUCT}`);
    expect(byProduct.result).toHaveLength(1);
    expect(byProduct.result[0].status).toBe("past_due");
    // past_due is not a granting status, so it holds no capabilities.
    expect(byProduct.result[0].active).toBe(false);
    expect(byProduct.result[0].capabilities).toEqual([]);

    const active = await readEntitlements("?active=true");
    expect(active.result).toHaveLength(1);
    expect(active.result[0].product_id).toBe(WARDEN_PRODUCT);
  });
});
