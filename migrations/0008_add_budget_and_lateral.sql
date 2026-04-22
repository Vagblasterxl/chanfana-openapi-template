-- Token Budget + Lateral Coordination System
-- Tracks token consumption across agents/platforms, routes lateral comms

-- Token budgets (per agent/platform)
CREATE TABLE IF NOT EXISTS token_budgets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    platform TEXT NOT NULL,                      -- 'claude-sonnet', 'claude-opus', 'gemma-4', 'manus', 'slack-claude', etc.

    -- Budget limits (NULL = unlimited)
    daily_limit INTEGER,
    monthly_limit INTEGER,
    cost_per_1k_tokens REAL DEFAULT 0,          -- USD cost

    -- Current usage
    tokens_used_today INTEGER DEFAULT 0,
    tokens_used_this_month INTEGER DEFAULT 0,
    requests_today INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    total_cost REAL DEFAULT 0,

    -- Reset tracking
    daily_reset_at DATETIME,
    monthly_reset_at DATETIME,
    last_used_at DATETIME,

    -- Priority (for when budgets tight - who gets tokens first)
    priority INTEGER DEFAULT 5,                  -- 0-10, higher = more priority
    active INTEGER DEFAULT 1,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(agent_id, platform)
);
CREATE INDEX idx_budget_agent ON token_budgets(agent_id);
CREATE INDEX idx_budget_platform ON token_budgets(platform);

-- Token consumption log
CREATE TABLE IF NOT EXISTS token_usage_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    platform TEXT NOT NULL,
    operation TEXT,                              -- 'debate_turn', 'preprocess', 'dispatch', 'relay'
    tokens_used INTEGER,
    cost REAL DEFAULT 0,
    reference_id TEXT,                           -- ID of the operation (debate_id, job_id, etc.)
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_usage_agent ON token_usage_log(agent_id);
CREATE INDEX idx_usage_platform ON token_usage_log(platform);
CREATE INDEX idx_usage_created ON token_usage_log(created_at);

-- Lateral coordination sessions
-- Maps Claude instances across different Slacks/platforms that are talking to each other
CREATE TABLE IF NOT EXISTS lateral_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT UNIQUE NOT NULL,
    purpose TEXT,                                -- what this lateral chat is for

    -- Participants (JSON array of {agent_id, platform, slack_workspace, channel})
    participants TEXT NOT NULL,

    -- Coordinator (usually Manus)
    coordinator_agent TEXT,
    coordinator_platform TEXT DEFAULT 'manus',

    -- State
    status TEXT DEFAULT 'active',                -- 'active', 'paused', 'completed'
    current_speaker TEXT,                        -- whose turn
    turn_counter INTEGER DEFAULT 0,
    message_counter INTEGER DEFAULT 0,

    -- Economics
    total_tokens_consumed INTEGER DEFAULT 0,
    manus_tokens_used INTEGER DEFAULT 0,
    budget_mode TEXT DEFAULT 'normal',           -- 'cheap', 'normal', 'max_power'

    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_activity_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    metadata TEXT
);
CREATE INDEX idx_lateral_status ON lateral_sessions(status);

-- Lateral messages (messages passed between Claudes via Manus coordinator)
CREATE TABLE IF NOT EXISTS lateral_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    lateral_session_id TEXT NOT NULL,
    from_agent TEXT NOT NULL,
    from_platform TEXT,
    from_slack TEXT,
    to_agent TEXT,
    to_platform TEXT,
    to_slack TEXT,

    content TEXT NOT NULL,
    original_content TEXT,                       -- pre-compression/translation
    message_type TEXT DEFAULT 'chat',            -- 'chat', 'command', 'result', 'coordinator_note'

    -- Relay tracking
    relayed_via TEXT,                            -- which coordinator relayed this
    relay_method TEXT,                           -- 'manus_browse', 'webhook', 'direct_api'
    relay_tokens_used INTEGER,

    status TEXT DEFAULT 'pending',               -- 'pending', 'relayed', 'failed'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_lat_msg_session ON lateral_messages(lateral_session_id);

-- Manus task tracking (since tokens are precious)
CREATE TABLE IF NOT EXISTS manus_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT UNIQUE NOT NULL,
    manus_external_id TEXT,                      -- ID returned from Manus API

    -- Task details
    task_type TEXT NOT NULL,                     -- 'lateral_relay', 'browse', 'research', 'autonomous'
    task_content TEXT NOT NULL,
    estimated_tokens INTEGER,
    actual_tokens INTEGER,

    -- Relationship
    lateral_session_id TEXT,
    triggered_by_agent TEXT,

    -- Status
    status TEXT DEFAULT 'queued',                -- 'queued', 'running', 'completed', 'failed', 'skipped'
    result TEXT,
    error_message TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME
);
CREATE INDEX idx_manus_status ON manus_tasks(status);
CREATE INDEX idx_manus_task_id ON manus_tasks(task_id);

-- Pre-seed token budgets for known platforms
INSERT OR IGNORE INTO token_budgets (agent_id, platform, daily_limit, monthly_limit, cost_per_1k_tokens, priority) VALUES
-- Manus accounts (2 free @ 300/day each, 1 paid @ 8k/month)
('manus-free-1', 'manus', 300, NULL, 0, 9),              -- FREE account #1: 300 daily tokens
('manus-free-2', 'manus', 300, NULL, 0, 9),              -- FREE account #2: 300 daily tokens
('manus-paid', 'manus', NULL, 8000, 0.001, 8),           -- PAID account: 8000 monthly tokens, priority use for complex tasks

-- Gemma 4 (local = unlimited free, vertex = metered)
('gemma-local', 'gemma-4', NULL, NULL, 0, 10),           -- unlimited, free, highest priority
('gemma-vertex', 'gemma-4', 100000, NULL, 0.00025, 7),   -- paid tier

-- Claude API tiers
('claude-sonnet-4-6', 'claude', 1000000, NULL, 0.003, 5),
('claude-opus-4-7', 'claude', 500000, NULL, 0.015, 3),

-- Slack Claude instances (4 accounts)
('slack-claude-1', 'slack', NULL, NULL, 0, 6),
('slack-claude-2', 'slack', NULL, NULL, 0, 6),
('slack-claude-3', 'slack', NULL, NULL, 0, 6),
('slack-claude-4', 'slack', NULL, NULL, 0, 6);

-- Add coordination channels
INSERT OR IGNORE INTO channels (name, description, created_by) VALUES
('lateral-coord', 'Lateral coordination between Claudes', 'system'),
('manus-lubricant', 'Manus acting as lateral lubricator', 'system'),
('budget-alerts', 'Token budget alerts and warnings', 'system');
