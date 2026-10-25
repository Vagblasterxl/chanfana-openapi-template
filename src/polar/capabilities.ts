import type { PolarSubscription } from "./events";

/**
 * Capability flags are the unit of authorization in the mesh (`registry.admin`,
 * `vault.read`, `comms.send`, ...). They are derived from the Polar product a
 * subscription is on, never from anything the caller sends.
 *
 * Resolution order:
 *   1. the product's `feature_flag` benefits, each carrying its flag in
 *      `metadata.cap`. This is Polar's native entitlement mechanism and the
 *      source of truth — granting a capability is attaching a benefit.
 *   2. the `polar_product_capabilities` table — a fallback for deliveries whose
 *      payload omits `product.benefits`, so a thin webhook body still resolves.
 *   3. nothing. An unrecognised product is a seat with no capabilities; it is
 *      recorded, it is never elevated by default.
 */

export type CapabilitySource = "product_benefits" | "product_map" | "none";

export interface ResolvedCapabilities {
  capabilities: string[];
  source: CapabilitySource;
}

const CAPABILITY_PATTERN = /^[a-z0-9][a-z0-9._:-]*$/;

/**
 * Accepts either an array or a delimited string (Polar metadata is often
 * entered as `registry.admin, vault.read` in the dashboard). Values are
 * lower-cased, de-duplicated, sorted for stable storage, and anything that is
 * not a plausible flag name is dropped rather than stored.
 */
export function normalizeCapabilities(value: unknown): string[] {
  let parts: unknown[];

  if (Array.isArray(value)) {
    parts = value;
  } else if (typeof value === "string") {
    parts = value.split(/[,;\s]+/);
  } else {
    return [];
  }

  const seen = new Set<string>();
  for (const part of parts) {
    if (typeof part !== "string") {
      continue;
    }
    const flag = part.trim().toLowerCase();
    if (flag !== "" && CAPABILITY_PATTERN.test(flag)) {
      seen.add(flag);
    }
  }

  return [...seen].sort();
}

/**
 * Capability flags attached to the product as `feature_flag` benefits. Benefits
 * of other types — the identity licence key, the config payload — carry no
 * capability and are ignored.
 */
export function capabilitiesFromProductBenefits(
  subscription: PolarSubscription,
): string[] {
  const flags: string[] = [];
  for (const benefit of subscription.product?.benefits ?? []) {
    if (benefit.type !== "feature_flag") {
      continue;
    }
    const cap = benefit.metadata?.cap;
    if (typeof cap === "string") {
      flags.push(cap);
    }
  }
  return normalizeCapabilities(flags);
}

export function resolveCapabilities(
  fromBenefits: string[],
  fromMap: string[] | null,
): ResolvedCapabilities {
  if (fromBenefits.length > 0) {
    return { capabilities: fromBenefits, source: "product_benefits" };
  }
  if (fromMap && fromMap.length > 0) {
    return { capabilities: fromMap, source: "product_map" };
  }
  return { capabilities: [], source: "none" };
}
