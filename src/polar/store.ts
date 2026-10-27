import type { CapabilitySource } from "./capabilities";

export interface EntitlementRow {
  subscription_id: string;
  customer_id: string;
  external_customer_id: string | null;
  product_id: string;
  product_name: string | null;
  status: string;
  active: boolean;
  capabilities: string[];
  source: CapabilitySource;
  event_type: string;
  event_id: string;
  occurred_at: string;
}

export interface StoredEntitlement
  extends Omit<EntitlementRow, "active" | "capabilities" | "source"> {
  active: boolean;
  capabilities: string[];
  source: string;
  updated_at: string;
}

interface EntitlementDbRow {
  subscription_id: string;
  customer_id: string;
  external_customer_id: string | null;
  product_id: string;
  product_name: string | null;
  status: string;
  active: number;
  capabilities: string;
  source: string;
  event_type: string;
  event_id: string;
  occurred_at: string;
  updated_at: string;
}

/** Capability set configured locally for a product, or null if unmapped. */
export async function lookupProductCapabilities(
  db: D1Database,
  productId: string,
): Promise<string[] | null> {
  const row = await db
    .prepare("SELECT capabilities FROM polar_product_capabilities WHERE product_id = ?")
    .bind(productId)
    .first<{ capabilities: string }>();

  if (!row) {
    return null;
  }
  return parseCapabilities(row.capabilities);
}

/**
 * Record the delivery and apply the entitlement in one atomic batch.
 *
 * Returns `replay: true` when this `webhook-id` was already recorded, so the
 * caller can acknowledge without treating it as new work. The entitlement write
 * is idempotent and refuses to move the row backwards, so a retry that arrives
 * after a newer event leaves the newer state intact.
 */
export async function applySubscriptionEvent(
  db: D1Database,
  webhookId: string,
  entitlement: EntitlementRow,
  receivedAt: string,
): Promise<{ replay: boolean }> {
  const [eventResult] = await db.batch([
    insertEventStatement(db, webhookId, entitlement.event_type, receivedAt),
    db
      .prepare(
        `INSERT INTO polar_entitlements (
           subscription_id, customer_id, external_customer_id, product_id,
           product_name, status, active, capabilities, source, event_type,
           event_id, occurred_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(subscription_id) DO UPDATE SET
           customer_id = excluded.customer_id,
           external_customer_id = excluded.external_customer_id,
           product_id = excluded.product_id,
           product_name = excluded.product_name,
           status = excluded.status,
           active = excluded.active,
           capabilities = excluded.capabilities,
           source = excluded.source,
           event_type = excluded.event_type,
           event_id = excluded.event_id,
           occurred_at = excluded.occurred_at,
           updated_at = excluded.updated_at
         WHERE excluded.occurred_at >= polar_entitlements.occurred_at`,
      )
      .bind(
        entitlement.subscription_id,
        entitlement.customer_id,
        entitlement.external_customer_id,
        entitlement.product_id,
        entitlement.product_name,
        entitlement.status,
        entitlement.active ? 1 : 0,
        JSON.stringify(entitlement.capabilities),
        entitlement.source,
        entitlement.event_type,
        entitlement.event_id,
        entitlement.occurred_at,
        receivedAt,
      ),
  ]);

  return { replay: (eventResult.meta?.changes ?? 0) === 0 };
}

/** Record a verified delivery we do not act on, so retries stay cheap. */
export async function recordEvent(
  db: D1Database,
  webhookId: string,
  eventType: string,
  receivedAt: string,
): Promise<{ replay: boolean }> {
  const result = await insertEventStatement(
    db,
    webhookId,
    eventType,
    receivedAt,
  ).run();
  return { replay: (result.meta?.changes ?? 0) === 0 };
}

function insertEventStatement(
  db: D1Database,
  webhookId: string,
  eventType: string,
  receivedAt: string,
): D1PreparedStatement {
  return db
    .prepare(
      "INSERT OR IGNORE INTO polar_webhook_events (webhook_id, event_type, received_at) VALUES (?, ?, ?)",
    )
    .bind(webhookId, eventType, receivedAt);
}

export interface EntitlementFilters {
  customer?: string;
  product_id?: string;
  active?: boolean;
}

export async function listEntitlements(
  db: D1Database,
  filters: EntitlementFilters = {},
): Promise<StoredEntitlement[]> {
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];

  if (filters.customer !== undefined) {
    conditions.push("(customer_id = ? OR external_customer_id = ?)");
    bindings.push(filters.customer, filters.customer);
  }
  if (filters.product_id !== undefined) {
    conditions.push("product_id = ?");
    bindings.push(filters.product_id);
  }
  if (filters.active !== undefined) {
    conditions.push("active = ?");
    bindings.push(filters.active ? 1 : 0);
  }

  const where = conditions.length > 0 ? ` WHERE ${conditions.join(" AND ")}` : "";
  const statement = db
    .prepare(`SELECT * FROM polar_entitlements${where} ORDER BY updated_at DESC`)
    .bind(...bindings);

  const { results } = await statement.all<EntitlementDbRow>();
  return results.map(deserialize);
}

/**
 * Everything a customer is currently entitled to: the union of capability flags
 * across their granting subscriptions. This is the answer an authorization
 * check needs.
 */
export async function getCustomerEntitlements(
  db: D1Database,
  customer: string,
): Promise<{ capabilities: string[]; subscriptions: StoredEntitlement[] }> {
  const subscriptions = await listEntitlements(db, { customer });
  const capabilities = new Set<string>();

  for (const subscription of subscriptions) {
    if (!subscription.active) {
      continue;
    }
    for (const capability of subscription.capabilities) {
      capabilities.add(capability);
    }
  }

  return { capabilities: [...capabilities].sort(), subscriptions };
}

function deserialize(row: EntitlementDbRow): StoredEntitlement {
  return {
    ...row,
    active: Boolean(row.active),
    capabilities: parseCapabilities(row.capabilities),
  };
}

function parseCapabilities(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}
