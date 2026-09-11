import type { PolarSubscription } from "./events";

/**
 * Capability flags are the unit of authorization in the mesh (`registry.admin`,
 * `vault.read`, `comms.send`, ...). They are derived from the Polar product a
 * subscription is on, never from anything the caller sends.
 *
 * Resolution order:
 *   1. `capabilities` in the product's Polar metadata — Polar is the source of
 *      truth, so annotating a product there is all an operator has to do.
 *   2. the `polar_product_capabilities` table — a fallback for products that
 *      have not been annotated yet.
 *   3. nothing. An unrecognised product is a seat with no capabilities; it is
 *      recorded, it is never elevated by default.
 */

export type CapabilitySource = "product_metadata" | "product_map" | "none";

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

/** Capabilities declared on the product itself, if any. */
export function capabilitiesFromProductMetadata(
  subscription: PolarSubscription,
): string[] {
  return normalizeCapabilities(subscription.product?.metadata?.capabilities);
}

export function resolveCapabilities(
  fromMetadata: string[],
  fromMap: string[] | null,
): ResolvedCapabilities {
  if (fromMetadata.length > 0) {
    return { capabilities: fromMetadata, source: "product_metadata" };
  }
  if (fromMap && fromMap.length > 0) {
    return { capabilities: fromMap, source: "product_map" };
  }
  return { capabilities: [], source: "none" };
}
