CREATE TABLE IF NOT EXISTS oracle_messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    channel    TEXT    NOT NULL DEFAULT 'general',
    sender     TEXT    NOT NULL,
    body       TEXT    NOT NULL,
    metadata   TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_oracle_channel    ON oracle_messages(channel);
CREATE INDEX IF NOT EXISTS idx_oracle_created_at ON oracle_messages(created_at);
