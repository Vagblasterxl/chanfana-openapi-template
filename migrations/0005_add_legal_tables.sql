-- Migration number: 0005    2026-06-19
-- Legal case tables for the Ramble Scrambler
-- Raw rambles go in, structured case data comes out

-- Raw ramble transcripts (voice or text dumps)
CREATE TABLE IF NOT EXISTS legal_rambles (
  id TEXT PRIMARY KEY,
  raw_text TEXT NOT NULL,
  source TEXT DEFAULT 'voice',
  agent_id TEXT,
  processed INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

-- Extracted timeline events
CREATE TABLE IF NOT EXISTS legal_timeline (
  id TEXT PRIMARY KEY,
  ramble_id TEXT,
  event_date TEXT,
  event_description TEXT NOT NULL,
  parties_involved TEXT DEFAULT '[]',
  evidence_refs TEXT DEFAULT '[]',
  significance TEXT,
  created_at TEXT NOT NULL
);

-- Parties (people, orgs, entities)
CREATE TABLE IF NOT EXISTS legal_parties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  description TEXT,
  contact_info TEXT,
  first_mentioned_in TEXT,
  created_at TEXT NOT NULL
);

-- Evidence items
CREATE TABLE IF NOT EXISTS legal_evidence (
  id TEXT PRIMARY KEY,
  ramble_id TEXT,
  description TEXT NOT NULL,
  evidence_type TEXT DEFAULT 'document',
  location TEXT,
  status TEXT DEFAULT 'mentioned',
  supports_claim TEXT,
  created_at TEXT NOT NULL
);

-- Legal claims / causes of action
CREATE TABLE IF NOT EXISTS legal_claims (
  id TEXT PRIMARY KEY,
  claim_type TEXT NOT NULL,
  statute TEXT,
  statute_text TEXT,
  facts_supporting TEXT DEFAULT '[]',
  evidence_refs TEXT DEFAULT '[]',
  status TEXT DEFAULT 'identified',
  created_at TEXT NOT NULL
);

-- Deadlines and dates that matter
CREATE TABLE IF NOT EXISTS legal_deadlines (
  id TEXT PRIMARY KEY,
  deadline_date TEXT NOT NULL,
  description TEXT NOT NULL,
  claim_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_rambles_processed ON legal_rambles(processed);
CREATE INDEX idx_timeline_date ON legal_timeline(event_date);
CREATE INDEX idx_parties_role ON legal_parties(role);
CREATE INDEX idx_evidence_status ON legal_evidence(status);
CREATE INDEX idx_claims_status ON legal_claims(status);
CREATE INDEX idx_deadlines_date ON legal_deadlines(deadline_date);
