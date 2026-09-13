import { z } from "zod";

/**
 * Subset of the Polar webhook envelope this Worker acts on. Unknown event types
 * and unknown fields are tolerated — Polar adds both, and a delivery we do not
 * model must still be acknowledged rather than retried forever.
 */

/** Polar metadata values are scalars or arrays of scalars. */
const metadataValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.union([z.string(), z.number(), z.boolean()])),
]);

const metadata = z.record(metadataValue);

/**
 * A Polar benefit. Capability flags ride on `feature_flag` benefits, with the
 * flag name in `metadata.cap` — that is Polar's native entitlement mechanism
 * and the only place these products declare capabilities.
 */
const polarBenefit = z
  .object({
    type: z.string(),
    description: z.string().optional(),
    metadata: metadata.optional(),
  })
  .passthrough();

const polarProduct = z
  .object({
    id: z.string(),
    name: z.string().optional(),
    metadata: metadata.optional(),
    benefits: z.array(polarBenefit).optional(),
  })
  .passthrough();

const polarCustomer = z
  .object({
    id: z.string(),
    external_id: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
  })
  .passthrough();

export const polarSubscription = z
  .object({
    id: z.string(),
    status: z.string(),
    product_id: z.string(),
    customer_id: z.string(),
    product: polarProduct.optional(),
    customer: polarCustomer.optional(),
    metadata: metadata.optional(),
    modified_at: z.string().nullable().optional(),
    created_at: z.string().nullable().optional(),
  })
  .passthrough();

export const polarWebhookEnvelope = z
  .object({
    type: z.string(),
    data: z.unknown(),
    timestamp: z.string().optional(),
  })
  .passthrough();

export type PolarSubscription = z.infer<typeof polarSubscription>;
export type PolarWebhookEnvelope = z.infer<typeof polarWebhookEnvelope>;

/** Events that carry a subscription object and therefore move entitlements. */
export const SUBSCRIPTION_EVENT_TYPES = [
  "subscription.created",
  "subscription.updated",
  "subscription.active",
  "subscription.canceled",
  "subscription.uncanceled",
  "subscription.revoked",
] as const;

export function isSubscriptionEvent(type: string): boolean {
  return (SUBSCRIPTION_EVENT_TYPES as readonly string[]).includes(type);
}

/**
 * Statuses that grant capabilities. Anything else — `past_due`, `unpaid`,
 * `paused`, `canceled`, `incomplete` — resolves to no capabilities. These flags
 * gate privileged operations, so a subscription that is not unambiguously in
 * good standing grants nothing until a later event says otherwise.
 */
const GRANTING_STATUSES = new Set(["active", "trialing"]);

export function grantsCapabilities(status: string): boolean {
  return GRANTING_STATUSES.has(status);
}

/**
 * Canonical UTC ISO-8601, so `occurred_at` values are ordered correctly by the
 * lexicographic comparison the entitlement upsert relies on. Returns null when
 * the input is missing or not a date.
 */
export function toIsoTimestamp(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
