-- Preprocessor System - modular content processing pipeline
-- Designed to be pluggable with any model (Gemma, Claude, local, etc.)

-- Preprocessor jobs (tracks all processing requests)
CREATE TABLE IF NOT EXISTS preprocessor_jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT UNIQUE NOT NULL,
    preprocessor TEXT NOT NULL,            -- worker name from registry
    mode TEXT NOT NULL,                    -- 'ocr', 'summarize', 'extract', 'transform', 'custom'
    input_type TEXT NOT NULL,              -- 'base64_image', 'text', 'url', 'inbox_id', 'json'
    input_content TEXT NOT NULL,
    custom_prompt TEXT,
    output_channel TEXT DEFAULT 'processed',
    output_agent TEXT,
    status TEXT DEFAULT 'pending',         -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
    result TEXT,
    error_message TEXT,
    tokens_used INTEGER,
    processing_time_ms INTEGER,
    source_inbox_id INTEGER,
    callback_url TEXT,                     -- webhook on completion
    priority INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    started_at DATETIME,
    completed_at DATETIME,
    metadata TEXT
);
CREATE INDEX idx_job_status ON preprocessor_jobs(status);
CREATE INDEX idx_job_preprocessor ON preprocessor_jobs(preprocessor);
CREATE INDEX idx_job_id ON preprocessor_jobs(job_id);
CREATE INDEX idx_job_priority ON preprocessor_jobs(priority DESC);

-- Preprocessor configs (reusable presets)
CREATE TABLE IF NOT EXISTS preprocessor_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    worker_name TEXT NOT NULL,             -- must exist in worker_registry
    mode TEXT NOT NULL,
    system_prompt TEXT,
    user_prompt_template TEXT,             -- use {content} as placeholder
    max_tokens INTEGER DEFAULT 4096,
    temperature REAL DEFAULT 0.3,
    output_format TEXT DEFAULT 'text',     -- 'text', 'json', 'markdown'
    output_channel TEXT DEFAULT 'processed',
    active INTEGER DEFAULT 1,
    metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Preprocessor pipelines (chain multiple processors)
CREATE TABLE IF NOT EXISTS preprocessor_pipelines (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    steps TEXT NOT NULL,                   -- JSON array: [{"config":"name","input_map":"result"}]
    output_channel TEXT DEFAULT 'processed',
    active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Auto-bridges (watch channel, auto-process)
CREATE TABLE IF NOT EXISTS preprocessor_autobridges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    source_channel TEXT NOT NULL,
    filter_message_type TEXT,              -- optional: only process specific types
    filter_from_agent TEXT,                -- optional: only from specific agent
    preprocessor_config TEXT NOT NULL,     -- config name to use
    output_channel TEXT NOT NULL,
    batch_size INTEGER DEFAULT 10,
    active INTEGER DEFAULT 1,
    last_triggered_at DATETIME,
    total_processed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Add preprocessor-related channels
INSERT OR IGNORE INTO channels (name, description, created_by) VALUES
('raw-content', 'Raw content awaiting preprocessing (screenshots, docs, etc.)', 'system'),
('processed', 'General preprocessed output', 'system'),
('ocr-output', 'OCR text extraction results', 'system'),
('summaries', 'Summarized content', 'system'),
('extractions', 'Structured data extractions (JSON)', 'system'),
('transforms', 'Transformed/reformatted content', 'system');

-- Pre-seed some useful preprocessor configs
INSERT OR IGNORE INTO preprocessor_configs (name, worker_name, mode, system_prompt, user_prompt_template, output_format, output_channel) VALUES
('gemma-ocr', 'gemma-4-local', 'ocr',
 'You are an OCR system. Extract all visible text from images accurately. Preserve formatting where possible.',
 'Extract all text from this image:\n\n{content}',
 'text', 'ocr-output'),

('gemma-summarize', 'gemma-4-local', 'summarize',
 'You are a summarization system. Create concise summaries focusing on key points and actionable information.',
 'Summarize the following content in 2-3 paragraphs:\n\n{content}',
 'text', 'summaries'),

('gemma-extract-json', 'gemma-4-local', 'extract',
 'You are a data extraction system. Extract structured information and return valid JSON only.',
 'Extract key information from the following and return as JSON:\n\n{content}',
 'json', 'extractions'),

('gemma-transform', 'gemma-4-local', 'transform',
 'You are a content transformation system. Reformat and restructure content as requested.',
 '{content}',
 'text', 'transforms');

-- Pre-seed a useful pipeline
INSERT OR IGNORE INTO preprocessor_pipelines (name, description, steps, output_channel) VALUES
('screenshot-to-summary', 'OCR a screenshot then summarize the text',
 '[{"config":"gemma-ocr","output_key":"ocr_text"},{"config":"gemma-summarize","input_from":"ocr_text"}]',
 'summaries');
