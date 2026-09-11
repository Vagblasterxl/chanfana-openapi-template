-- Migration number: 0002 	 2026-09-11T00:00:00.000Z

-- Capability set granted by a subscription, as last reported by a *verified*
-- Polar webhook. One row per subscription; the webhook handler upserts it.
CREATE TABLE IF NOT EXISTS polar_entitlements (
    subscription_id TEXT PRIMARY KEY NOT NULL,
    customer_id TEXT NOT NULL,
    external_customer_id TEXT,
    product_id TEXT NOT NULL,
    product_name TEXT,
    status TEXT NOT NULL,
    active INTEGER NOT NULL,
    -- JSON array of capability flags, e.g. ["registry.admin","vault.read"]
    capabilities TEXT NOT NULL,
    -- Where the capability set came from: "product_metadata" | "product_map" | "none"
    source TEXT NOT NULL,
    event_type TEXT NOT NULL,
    event_id TEXT NOT NULL,
    occurred_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_polar_entitlements_customer
    ON polar_entitlements (customer_id);
CREATE INDEX IF NOT EXISTS idx_polar_entitlements_external_customer
    ON polar_entitlements (external_customer_id);
CREATE INDEX IF NOT EXISTS idx_polar_entitlements_product
    ON polar_entitlements (product_id);

-- Fallback product -> capability map, used only when a product carries no
-- `capabilities` metadata in Polar. Polar metadata stays the source of truth;
-- this table exists so a product that has not been annotated yet still
-- resolves to a known, explicit set instead of silently granting nothing.
CREATE TABLE IF NOT EXISTS polar_product_capabilities (
    product_id TEXT PRIMARY KEY NOT NULL,
    product_name TEXT NOT NULL,
    capabilities TEXT NOT NULL
);

INSERT OR IGNORE INTO polar_product_capabilities (product_id, product_name, capabilities) VALUES
    ('2c1fb64e-717f-47f6-943f-86e8ccfe5e41', 'OMEGA Role - Warden',   '["mesh.dispatch","registry.admin","vault.read"]'),
    ('cb2d4696-adbc-4f92-a214-1f67c19e3b8f', 'OMEGA Role - Receiver', '["comms.send","memory.write"]');

-- Delivery log, keyed by the Standard Webhooks `webhook-id`. Polar retries on
-- non-2xx, so the same event id can arrive more than once; replays are
-- acknowledged without re-applying the entitlement write.
CREATE TABLE IF NOT EXISTS polar_webhook_events (
    webhook_id TEXT PRIMARY KEY NOT NULL,
    event_type TEXT NOT NULL,
    received_at DATETIME NOT NULL
);
