-- Debate/Dialogue System - structured multi-agent discourse
-- Implements Hegelian dialectic: thesis → antithesis → synthesis

CREATE TABLE IF NOT EXISTS debates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debate_id TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    topic TEXT NOT NULL,                      -- the question/problem being debated
    mode TEXT DEFAULT 'hegelian',             -- 'hegelian', 'adversarial', 'collaborative', 'rap_battle'
    status TEXT DEFAULT 'open',               -- 'open', 'in_progress', 'synthesizing', 'closed'

    -- Positions
    thesis_agent TEXT,
    thesis_position TEXT,
    thesis_submitted_at DATETIME,

    antithesis_agent TEXT,
    antithesis_position TEXT,
    antithesis_submitted_at DATETIME,

    -- Synthesis
    synthesis_agent TEXT,                     -- who synthesizes (can be third party or system)
    synthesis TEXT,
    synthesis_submitted_at DATETIME,

    -- Scoring
    thesis_score REAL,
    antithesis_score REAL,
    synthesis_quality REAL,
    winner TEXT,                              -- for adversarial mode

    -- Config
    max_turns INTEGER DEFAULT 3,              -- rounds before forced synthesis
    current_turn INTEGER DEFAULT 0,
    turn_timeout_minutes INTEGER DEFAULT 30,

    -- Metadata
    output_channel TEXT DEFAULT 'debate-results',
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    closed_at DATETIME,
    metadata TEXT
);
CREATE INDEX idx_debate_id ON debates(debate_id);
CREATE INDEX idx_debate_status ON debates(status);

-- Debate turns (full history)
CREATE TABLE IF NOT EXISTS debate_turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    debate_id TEXT NOT NULL,
    turn_number INTEGER NOT NULL,
    agent_id TEXT NOT NULL,
    role TEXT NOT NULL,                       -- 'thesis', 'antithesis', 'rebuttal', 'synthesis', 'judge'
    content TEXT NOT NULL,

    -- Hegelian tracking
    claims TEXT,                              -- JSON array of claims made
    evidence TEXT,                            -- JSON array of evidence cited
    concessions TEXT,                         -- JSON array of points conceded

    -- Scoring
    score REAL,
    scored_by TEXT,
    score_reason TEXT,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (debate_id) REFERENCES debates(debate_id)
);
CREATE INDEX idx_turn_debate ON debate_turns(debate_id);
CREATE INDEX idx_turn_agent ON debate_turns(agent_id);

-- Debate queue (agents waiting to join debates)
CREATE TABLE IF NOT EXISTS debate_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    preferred_role TEXT,                      -- 'thesis', 'antithesis', 'either', 'judge'
    preferred_mode TEXT,                      -- 'hegelian', 'adversarial', etc.
    topics TEXT,                              -- JSON array of topic preferences
    available_until DATETIME,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_queue_agent ON debate_queue(agent_id);

-- Add debate channels
INSERT OR IGNORE INTO channels (name, description, created_by) VALUES
('debate-open', 'Open debates looking for participants', 'system'),
('debate-active', 'Currently active debates', 'system'),
('debate-results', 'Completed debate syntheses', 'system'),
('rap-battles', 'Agent rap battle outputs', 'system');
