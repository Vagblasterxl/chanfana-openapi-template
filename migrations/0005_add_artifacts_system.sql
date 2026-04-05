-- Artifacts system with governance framework
-- Implements the 5 Keepers: origin classification, evidence attribution,
-- MVT requirement, temp vs canonical naming, forensic override drift detection

CREATE TABLE IF NOT EXISTS artifacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artifact_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    name_status TEXT NOT NULL DEFAULT 'temporary',  -- 'temporary', 'canonical'

    -- Keeper 1: Origin Classification
    origin_class TEXT NOT NULL,                     -- 'recovered', 'synthesised', 'hybrid', 'imported'
    origin_source TEXT,                              -- where it came from (thread, session, external URL, etc.)
    origin_agent TEXT,                               -- which agent produced it

    -- Keeper 2: Evidence Attribution
    direct_evidence TEXT,                            -- JSON array of source references
    inferred_extension TEXT,                         -- what was extrapolated beyond evidence
    promotion_risk TEXT DEFAULT 'high',              -- 'low', 'medium', 'high'

    -- Keeper 3: Minimum Viable Test
    minimum_viable_test TEXT,                        -- testable claim
    mvt_expected_outcome TEXT,                       -- what should happen
    mvt_falsification TEXT,                          -- what would disprove it
    mvt_status TEXT DEFAULT 'untested',              -- 'untested', 'passed', 'failed', 'blocked'
    mvt_tested_at DATETIME,
    mvt_tested_by TEXT,

    -- Keeper 4: Canon Status
    canon_status TEXT DEFAULT 'proposed',            -- 'proposed', 'validated', 'canonical', 'rejected', 'retired'
    promoted_at DATETIME,
    promoted_by TEXT,

    -- Keeper 5: Forensic Override Drift Detection
    drift_checked INTEGER DEFAULT 0,                -- has drift check been performed
    drift_score REAL,                                -- 0.0 (pure recovery) to 1.0 (pure speculation)
    drift_notes TEXT,                                -- explanation of drift assessment

    -- Content
    content_type TEXT DEFAULT 'text',                -- 'text', 'json', 'code', 'schema', 'protocol'
    content TEXT NOT NULL,
    summary TEXT,
    tags TEXT,                                       -- JSON array of tags

    -- Metadata
    session_id TEXT,
    priority INTEGER DEFAULT 0,
    version INTEGER DEFAULT 1,
    parent_artifact_id TEXT,                         -- for versioning/lineage
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    metadata TEXT                                    -- JSON blob
);

CREATE INDEX idx_art_origin ON artifacts(origin_class);
CREATE INDEX idx_art_canon ON artifacts(canon_status);
CREATE INDEX idx_art_name_status ON artifacts(name_status);
CREATE INDEX idx_art_mvt ON artifacts(mvt_status);
CREATE INDEX idx_art_agent ON artifacts(origin_agent);
CREATE INDEX idx_art_id ON artifacts(artifact_id);

-- Artifact validation log (audit trail for promotion/rejection)
CREATE TABLE IF NOT EXISTS artifact_validations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artifact_id TEXT NOT NULL,
    action TEXT NOT NULL,                             -- 'propose', 'validate', 'promote', 'reject', 'retire', 'drift_check', 'mvt_run'
    performed_by TEXT NOT NULL,
    reason TEXT,
    evidence TEXT,                                    -- JSON: supporting data for the action
    previous_status TEXT,
    new_status TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_val_artifact ON artifact_validations(artifact_id);
CREATE INDEX idx_val_action ON artifact_validations(action);

-- Source contamination tracker (keeper 5 support)
CREATE TABLE IF NOT EXISTS contamination_flags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    artifact_id TEXT NOT NULL,
    pattern TEXT NOT NULL,                            -- 'source_saturation', 'project_to_protocol', 'forensic_override', 'retroactive_canon'
    severity TEXT DEFAULT 'warning',                  -- 'info', 'warning', 'critical'
    description TEXT,
    flagged_by TEXT,
    resolved INTEGER DEFAULT 0,
    resolved_by TEXT,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_contam_artifact ON contamination_flags(artifact_id);
CREATE INDEX idx_contam_pattern ON contamination_flags(pattern);
