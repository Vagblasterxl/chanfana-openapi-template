# Governance Framework - Artifact Truth Hygiene

## Five Core Keepers

### 1. Recovered / Synthesised / Hybrid Classification
Every artifact must be tagged by origin:
- `recovered` - Directly observed in source material
- `synthesised` - Created during analysis
- `hybrid` - Combination of recovered + synthesised
- `imported` - Brought from external source

### 2. Evidence-Backed Attribution
Required fields before canon promotion:
```
origin_class: recovered | synthesised | hybrid | imported
direct_evidence: [list of source references]
inferred_extension: [what was extrapolated]
minimum_viable_test: [testable claim]
name_status: temporary | canonical
canon_status: proposed | validated | canonical
promotion_risk: low | medium | high
```

### 3. Minimum Viable Test (MVT) Requirement
No untestable claims enter canon. Every artifact needs:
- A concrete test that can be applied
- Expected outcome
- Falsification criteria

### 4. Temporary Label vs. Canonical Name
- Mark provisional names with `[TEMP]` or similar
- Only promote to canonical after MVT passes
- Prevents "retroactive canonisation" of speculation

### 5. Forensic Override Drift
Failure mode where AI:
- Asked to analyze existing system
- Silently replaces forensic task with cleaner architecture
- Presents speculation as recovered truth

**Detection:** Compare output claims against actual source material.

---

## Validation Gates

### Recovered Artifact Validation Gate
Before promoting to canon, verify:
- [ ] Directly observed in thread/source
- [ ] Recurred or materially affected behavior
- [ ] Can be immediately tested
- [ ] Uses native name (not AI-invented)

### Source Contamination Patterns
Watch for:
- **Source Saturation** - Repeated exposure creates false consensus
- **Project-to-Protocol Inflation** - Single project docs treated as standard
- **Forensic Override Drift** - Analysis replaced with speculation

---

## Case File Hierarchy (Lawyer-First)

1. Control Center
2. Executive Summary
3. Roster of Parties
4. Master Timeline
5. Current Status / Hold-Ups
6. Incident Library
7. Evidence Vault
8. Damages & Impact
9. Background / Personal Context
10. Legal Theory / Questions
11. Raw Drafts
