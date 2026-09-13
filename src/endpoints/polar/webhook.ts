import { contentJson, OpenAPIRoute } from "chanfana";
import { z } from "zod";
import type { AppContext } from "../../types";
import {
  capabilitiesFromProductBenefits,
  resolveCapabilities,
} from "../../polar/capabilities";
import {
  grantsCapabilities,
  isSubscriptionEvent,
  polarSubscription,
  polarWebhookEnvelope,
  toIsoTimestamp,
} from "../../polar/events";
import {
  applySubscriptionEvent,
  lookupProductCapabilities,
  recordEvent,
} from "../../polar/store";
import { verifyPolarWebhook } from "../../polar/verify";

const errorBody = z.object({
  success: z.literal(false),
  errors: z.array(z.object({ code: z.number().int(), message: z.string() })),
});

export class PolarWebhook extends OpenAPIRoute {
  public schema = {
    tags: ["Polar"],
    summary: "Receive a Polar webhook delivery",
    description:
      "Verifies the Standard Webhooks signature and applies subscription " +
      "entitlements. Requires the POLAR_WEBHOOK_SECRET binding; without it " +
      "every delivery is rejected with 503 rather than trusted.",
    operationId: "polar-webhook",
    request: {
      body: contentJson(
        z
          .object({
            type: z.string().openapi({ example: "subscription.updated" }),
            data: z.record(z.unknown()),
          })
          .passthrough(),
      ),
    },
    responses: {
      "202": {
        description: "Delivery verified and processed",
        ...contentJson({
          success: z.literal(true),
          result: z.object({
            event_type: z.string(),
            handled: z.boolean(),
            replay: z.boolean(),
            subscription_id: z.string().nullable(),
            capabilities: z.array(z.string()),
          }),
        }),
      },
      "400": {
        description: "Body is not a Polar webhook envelope",
        ...contentJson(errorBody),
      },
      "401": {
        description: "Signature missing, stale, or invalid",
        ...contentJson(errorBody),
      },
      "503": {
        description: "POLAR_WEBHOOK_SECRET is not configured on this Worker",
        ...contentJson(errorBody),
      },
    },
  };

  public async handle(c: AppContext) {
    // The signature covers the exact bytes Polar sent, so the raw body has to
    // be read before anything parses or re-serializes it.
    const rawBody = await c.req.text();
    const verification = await verifyPolarWebhook(
      rawBody,
      c.req.raw.headers,
      c.env.POLAR_WEBHOOK_SECRET,
    );

    if (!verification.ok) {
      if (verification.reason === "secret_not_configured") {
        console.error(
          "Polar webhook rejected: POLAR_WEBHOOK_SECRET is not set. " +
            "Deliveries cannot be authenticated and are being refused.",
        );
        return c.json(
          {
            success: false,
            errors: [
              {
                code: 7503,
                message:
                  "Webhook verification is not configured; delivery refused.",
              },
            ],
          },
          503,
        );
      }

      console.warn(`Polar webhook rejected: ${verification.reason}`);
      return c.json(
        {
          success: false,
          errors: [{ code: 7401, message: `Invalid signature: ${verification.reason}` }],
        },
        401,
      );
    }

    let envelope: z.infer<typeof polarWebhookEnvelope>;
    try {
      envelope = polarWebhookEnvelope.parse(JSON.parse(rawBody));
    } catch {
      return c.json(
        {
          success: false,
          errors: [{ code: 7400, message: "Malformed Polar webhook payload" }],
        },
        400,
      );
    }

    const receivedAt = new Date().toISOString();

    if (!isSubscriptionEvent(envelope.type)) {
      // Verified, but not an event that moves entitlements. Log it so retries
      // are cheap and acknowledge.
      const { replay } = await recordEvent(
        c.env.DB,
        verification.webhookId,
        envelope.type,
        receivedAt,
      );
      return c.json(
        {
          success: true,
          result: {
            event_type: envelope.type,
            handled: false,
            replay,
            subscription_id: null,
            capabilities: [],
          },
        },
        202,
      );
    }

    const parsedSubscription = polarSubscription.safeParse(envelope.data);
    if (!parsedSubscription.success) {
      return c.json(
        {
          success: false,
          errors: [
            {
              code: 7400,
              message: `Malformed subscription payload for ${envelope.type}`,
            },
          ],
        },
        400,
      );
    }
    const subscription = parsedSubscription.data;

    const fromBenefits = capabilitiesFromProductBenefits(subscription);
    const fromMap =
      fromBenefits.length > 0
        ? null
        : await lookupProductCapabilities(c.env.DB, subscription.product_id);
    const resolved = resolveCapabilities(fromBenefits, fromMap);

    // A subscription that is not in good standing keeps its row for audit but
    // grants nothing.
    const active = grantsCapabilities(subscription.status);
    const capabilities = active ? resolved.capabilities : [];

    const occurredAt =
      toIsoTimestamp(envelope.timestamp) ??
      toIsoTimestamp(subscription.modified_at) ??
      new Date(verification.timestamp * 1000).toISOString();

    const { replay } = await applySubscriptionEvent(
      c.env.DB,
      verification.webhookId,
      {
        subscription_id: subscription.id,
        customer_id: subscription.customer_id,
        external_customer_id: subscription.customer?.external_id ?? null,
        product_id: subscription.product_id,
        product_name: subscription.product?.name ?? null,
        status: subscription.status,
        active,
        capabilities,
        source: active ? resolved.source : "none",
        event_type: envelope.type,
        event_id: verification.webhookId,
        occurred_at: occurredAt,
      },
      receivedAt,
    );

    return c.json(
      {
        success: true,
        result: {
          event_type: envelope.type,
          handled: true,
          replay,
          subscription_id: subscription.id,
          capabilities,
        },
      },
      202,
    );
  }
}
