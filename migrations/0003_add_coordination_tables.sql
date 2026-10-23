-- Migration number: 0003    2026-02-20
-- Symphony agent coordination tables
-- Matches schema on agent-coordination-db (54a2954e-d287-477b-b1f0-485543dbf6a8)

CREATE TABLE IF NOT EXISTS agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'online',
  last_heartbeat TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  sender TEXT NOT NULL,
  recipient TEXT NOT NULL,
  message_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  status TEXT DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS coordination_state (
  id TEXT PRIMARY KEY,
  state_type TEXT NOT NULL,
  active_agents TEXT DEFAULT '[]',
  pending_tasks TEXT DEFAULT '[]',
  shared_context TEXT DEFAULT '{}'
);
