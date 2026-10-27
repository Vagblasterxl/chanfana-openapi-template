-- Migration number: 0004    2026-06-06
-- SVO Knowledge Extraction triples table
-- Stores Subject·Verb·Object triples from all ingested content

CREATE TABLE IF NOT EXISTS knowledge_triples (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  verb TEXT NOT NULL,
  object TEXT NOT NULL,
  context TEXT DEFAULT '{}',
  source_task TEXT,
  source_asset TEXT,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_triples_subject ON knowledge_triples(subject);
CREATE INDEX idx_triples_object ON knowledge_triples(object);
CREATE INDEX idx_triples_verb ON knowledge_triples(verb);
CREATE INDEX idx_triples_source_asset ON knowledge_triples(source_asset);
