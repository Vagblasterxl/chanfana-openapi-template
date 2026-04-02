-- Claude Sustain Network Tables
-- Provides memory, comms, sessions, and worker registry for agent persistence

-- Agent memories (context, learnings, tasks, facts)
CREATE TABLE IF NOT EXISTS memories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    session_id TEXT,
    memory_type TEXT NOT NULL,  -- 'context', 'learning', 'task', 'fact'
    key TEXT,                    -- optional lookup key
    content TEXT NOT NULL,
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
);
CREATE INDEX idx_mem_agent ON memories(agent_id);
CREATE INDEX idx_mem_type ON memories(memory_type);
CREATE INDEX idx_mem_key ON memories(key);

-- Comms log (messages in/out to other workers)
CREATE TABLE IF NOT EXISTS comms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    direction TEXT NOT NULL,     -- 'in', 'out'
    from_entity TEXT NOT NULL,
    to_entity TEXT NOT NULL,
    worker_url TEXT,
    method TEXT DEFAULT 'POST',
    payload TEXT,
    response TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_comms_dir ON comms(direction);
CREATE INDEX idx_comms_status ON comms(status);
CREATE INDEX idx_comms_from ON comms(from_entity);
CREATE INDEX idx_comms_to ON comms(to_entity);

-- Sessions (agent state tracking)
CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    agent_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',  -- 'active', 'paused', 'ended'
    context_summary TEXT,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT  -- JSON blob
);
CREATE INDEX idx_sess_agent ON sessions(agent_id);
CREATE INDEX idx_sess_status ON sessions(status);

-- Worker registry (URLs & auth for relay)
CREATE TABLE IF NOT EXISTS worker_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    url TEXT NOT NULL,
    auth_type TEXT DEFAULT 'none',  -- 'bearer', 'basic', 'none', 'header'
    auth_header TEXT,                -- custom header name (default: Authorization)
    auth_token TEXT,                 -- token value (or env var reference like $BRAIN_API_TOKEN)
    account TEXT,                    -- 'vagblasterxl', 'kenwsimmons', 'rogerdoger'
    description TEXT,
    status TEXT DEFAULT 'active',    -- 'active', 'inactive'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_worker_name ON worker_registry(name);
CREATE INDEX idx_worker_account ON worker_registry(account);

-- Pre-seed with Ken's known workers
INSERT OR IGNORE INTO worker_registry (name, url, auth_type, account, description) VALUES
('brain-api', 'https://brain-api.vagblasterxl.workers.dev', 'bearer', 'vagblasterxl', 'Knowledge/memory API, R2 read/write'),
('comms-api', 'https://comms-api.vagblasterxl.workers.dev', 'none', 'vagblasterxl', 'Inter-agent communications bus'),
('agent-router', 'https://agent-router.vagblasterxl.workers.dev', 'none', 'vagblasterxl', 'Routes requests to appropriate agent'),
('agent-hub', 'https://agent-hub.vagblasterxl.workers.dev', 'none', 'vagblasterxl', 'Agent coordination, shows Alpha/Bravo/Charlie status'),
('ledger-worker', 'https://ledger-worker.vagblasterxl.workers.dev', 'none', 'vagblasterxl', 'Append-only ledger system'),
('steno-compressor', 'https://steno-compressor.vagblasterxl.workers.dev', 'none', 'vagblasterxl', 'Stenographic compression for token reduction'),
('r2-writer', 'https://r2-writer.vagblasterxl.workers.dev', 'none', 'vagblasterxl', 'Generic R2 read/write/list/delete utility'),
('vectorembed', 'https://vectorembed.vagblasterxl.workers.dev', 'none', 'vagblasterxl', 'Vector embedding worker'),
('d1-rest', 'https://d1-rest.vagblasterxl.workers.dev', 'none', 'vagblasterxl', 'Character Vault - character storage, NPC spawning'),
('extractor-bus', 'https://extractor-bus.kenwsimmons.workers.dev', 'bearer', 'kenwsimmons', 'Knowledge graph extraction pipeline with GateSpec v1'),
('captain-proton', 'https://captain-proton.kenwsimmons.workers.dev', 'none', 'kenwsimmons', 'Webhook fan-out system with Polar HMAC'),
('memory-bridge', 'https://memory-bridge.kenwsimmons.workers.dev', 'none', 'kenwsimmons', 'KV-backed cross-agent conversation memory'),
('knowledge-sphere', 'https://knowledge-sphere.kenwsimmons.workers.dev', 'none', 'kenwsimmons', 'Knowledge storage service'),
('r2-vault', 'https://r2-vault.kenwsimmons.workers.dev', 'none', 'kenwsimmons', 'R2 storage service'),
('claude-symphony', 'https://claude-symphony.kenwsimmons.workers.dev', 'none', 'kenwsimmons', 'Claude-only communication hub');
