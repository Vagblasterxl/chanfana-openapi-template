-- Claude Inbox System - message queue for Claude-to-Claude relay
-- Append to existing migration or run separately

-- Inbox messages (async queue)
CREATE TABLE IF NOT EXISTS inbox (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT DEFAULT 'general',      -- namespace for different queues
    from_agent TEXT NOT NULL,            -- who sent it
    to_agent TEXT,                       -- specific recipient or NULL for broadcast
    message_type TEXT DEFAULT 'text',    -- 'text', 'ocr', 'compressed', 'json', 'command'
    content TEXT NOT NULL,
    priority INTEGER DEFAULT 0,          -- higher = more urgent
    status TEXT DEFAULT 'pending',       -- 'pending', 'claimed', 'read', 'processed', 'expired'
    claimed_by TEXT,                     -- which agent claimed it
    claimed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,                 -- auto-expire old messages
    metadata TEXT                        -- JSON blob for extra context
);
CREATE INDEX idx_inbox_channel ON inbox(channel);
CREATE INDEX idx_inbox_to ON inbox(to_agent);
CREATE INDEX idx_inbox_status ON inbox(status);
CREATE INDEX idx_inbox_priority ON inbox(priority DESC);

-- Broadcast channels (pub/sub style)
CREATE TABLE IF NOT EXISTS channels (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Channel subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    webhook_url TEXT,                    -- optional: push to this URL when message arrives
    last_read_id INTEGER DEFAULT 0,      -- for polling: last message ID this agent saw
    subscribed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel, agent_id)
);
CREATE INDEX idx_sub_agent ON subscriptions(agent_id);

-- Bucket bridge config (for R2 scooch)
CREATE TABLE IF NOT EXISTS bucket_bridges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    source_type TEXT NOT NULL,           -- 'inbox', 'memory', 'comms'
    target_type TEXT NOT NULL,           -- 'r2', 'worker', 'webhook'
    target_url TEXT NOT NULL,            -- R2 bucket URL or worker endpoint
    target_auth TEXT,                    -- auth token for target
    filter_channel TEXT,                 -- only bridge specific channel
    filter_agent TEXT,                   -- only bridge specific agent's messages
    transform TEXT,                      -- 'none', 'compress', 'json'
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Pre-create some useful channels
INSERT OR IGNORE INTO channels (name, description, created_by) VALUES
('general', 'General Claude-to-Claude chatter', 'system'),
('ocr-dump', 'Vision Claude dumps OCR text here', 'system'),
('commands', 'Task requests between agents', 'system'),
('code-review', 'Code snippets for review', 'system'),
('urgent', 'High priority messages', 'system');
