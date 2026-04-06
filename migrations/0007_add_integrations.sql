-- Integrations System - webhook receivers and outbound dispatchers
-- Connects Discord, Slack, Polar, Manus, and any other service

-- Webhook receivers (inbound)
CREATE TABLE IF NOT EXISTS webhook_receivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL,                    -- 'discord', 'slack', 'polar', 'github', 'generic'
    endpoint_path TEXT UNIQUE NOT NULL,        -- e.g., '/hooks/discord/abc123'
    secret TEXT,                               -- for HMAC verification
    active INTEGER DEFAULT 1,

    -- Routing
    route_to TEXT NOT NULL,                    -- 'inbox', 'debate', 'preprocessor', 'custom'
    route_channel TEXT,                        -- inbox channel if route_to='inbox'
    route_config TEXT,                         -- JSON config for routing

    -- Stats
    total_received INTEGER DEFAULT 0,
    last_received_at DATETIME,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT
);
CREATE INDEX idx_hook_platform ON webhook_receivers(platform);
CREATE INDEX idx_hook_path ON webhook_receivers(endpoint_path);

-- Webhook log (all received webhooks)
CREATE TABLE IF NOT EXISTS webhook_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    receiver_id INTEGER,
    receiver_name TEXT,
    platform TEXT,
    event_type TEXT,                           -- platform-specific event type
    payload TEXT,                              -- raw JSON payload
    headers TEXT,                              -- relevant headers
    signature_valid INTEGER,                   -- 1 if signature verified
    routed_to TEXT,
    routed_id TEXT,                            -- inbox message ID, debate ID, etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_log_receiver ON webhook_log(receiver_name);
CREATE INDEX idx_log_platform ON webhook_log(platform);

-- Outbound dispatchers
CREATE TABLE IF NOT EXISTS dispatchers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    platform TEXT NOT NULL,                    -- 'discord', 'slack', 'manus', 'email', 'generic'
    endpoint_url TEXT NOT NULL,
    auth_type TEXT DEFAULT 'bearer',           -- 'bearer', 'bot', 'basic', 'hmac', 'none'
    auth_token TEXT,
    active INTEGER DEFAULT 1,

    -- Config
    default_channel TEXT,                      -- for Slack/Discord
    rate_limit_per_minute INTEGER DEFAULT 60,

    -- Stats
    total_sent INTEGER DEFAULT 0,
    last_sent_at DATETIME,
    last_error TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT
);
CREATE INDEX idx_dispatch_platform ON dispatchers(platform);

-- Dispatch log
CREATE TABLE IF NOT EXISTS dispatch_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    dispatcher_name TEXT,
    platform TEXT,
    destination TEXT,                          -- channel, user, etc.
    content TEXT,
    status TEXT DEFAULT 'pending',             -- 'pending', 'sent', 'failed'
    response TEXT,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_displog_dispatcher ON dispatch_log(dispatcher_name);

-- Integration bridges (auto-route between systems)
CREATE TABLE IF NOT EXISTS integration_bridges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,

    -- Source
    source_type TEXT NOT NULL,                 -- 'webhook', 'inbox', 'debate'
    source_filter TEXT,                        -- JSON filter config

    -- Destination
    dest_type TEXT NOT NULL,                   -- 'dispatcher', 'inbox', 'debate', 'preprocessor'
    dest_name TEXT NOT NULL,                   -- dispatcher name, channel name, etc.
    dest_config TEXT,                          -- JSON config

    -- Transform
    transform TEXT,                            -- 'none', 'extract', 'summarize', 'custom'
    transform_config TEXT,                     -- JSON transform config

    active INTEGER DEFAULT 1,
    total_bridged INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pre-register common platforms
INSERT OR IGNORE INTO dispatchers (name, platform, endpoint_url, auth_type, metadata) VALUES
('manus-default', 'manus', 'https://api.manus.im/v1/tasks', 'bearer', '{"description":"Manus autonomous agent"}'),
('discord-webhook', 'discord', 'CONFIGURE_ME', 'none', '{"description":"Discord webhook URL"}'),
('slack-webhook', 'slack', 'CONFIGURE_ME', 'none', '{"description":"Slack incoming webhook"}');

-- Add integration channels
INSERT OR IGNORE INTO channels (name, description, created_by) VALUES
('integrations', 'Messages from external integrations', 'system'),
('manus-tasks', 'Tasks dispatched to Manus', 'system'),
('discord-bridge', 'Messages bridged from/to Discord', 'system'),
('slack-bridge', 'Messages bridged from/to Slack', 'system');
