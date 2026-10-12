-- Migration number: 0002    2026-02-18
-- Asset catalog for tracking AI-generated media with lineage
CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY NOT NULL,
    filename TEXT NOT NULL,
    asset_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    version INTEGER NOT NULL DEFAULT 1,
    model TEXT,
    provider TEXT,
    mcp_server TEXT,
    prompt TEXT,
    local_path TEXT NOT NULL,
    tags TEXT,
    parent_assets TEXT,
    child_assets TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_assets_type ON assets(asset_type);
CREATE INDEX idx_assets_status ON assets(status);
CREATE INDEX idx_assets_created ON assets(created_at DESC);
