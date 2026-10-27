# Symphony AI System Protocols

Three governance protocols that any agent operating in this system must respect.
These are the rules of engagement — not suggestions.

---

## 1. IOSM Governance Protocol

**Improve · Optimize · Shrink · Modularize**

Every artifact (asset, code, message, pipeline output) must pass all four gates
before advancing from `draft` → `review` → `approved` → `published`.

### Gate 1 — IMPROVE
Did this iteration produce a measurable improvement over the previous version
or baseline brief?

- **Pass criteria**: Concrete improvement on at least one tracked dimension
  (clarity, accuracy, fidelity to brief, sensory detail, structural coherence)
- **Fail signal**: Output is a rewrite of the same content with surface-level
  changes only. Reject and re-prompt with explicit improvement vector.

### Gate 2 — OPTIMIZE
Is the output efficient relative to its purpose?

- **Pass criteria**: File size, render time, token count, or runtime is at or
  below the format spec in `templates/{type}/standard-formats.yml`
- **Fail signal**: Bloated output (oversize image, over-long video, verbose
  text). Compress, transcode, or trim before approval.

### Gate 3 — SHRINK
What can be removed without loss?

- **Pass criteria**: No redundant elements (duplicate metadata, repeated
  phrasing, unused assets in compositions, dead code in agent responses)
- **Fail signal**: Bloat. Apply minimal-form discipline: every element must
  justify its presence.

### Gate 4 — MODULARIZE
Can this output be reused or composed?

- **Pass criteria**: Output is referenceable as a discrete unit with a stable
  ID, tagged appropriately, with parent/child lineage recorded in `.meta.yml`
  and `media/.meta/lineage-index.yml`
- **Fail signal**: Monolithic output that can't be split, retagged, or
  remixed. Break into components and re-register.

### IOSM Implementation
The `/assets/:id/review` endpoint runs all four gates and returns:
```json
{
  "asset_id": "img-20260218-001",
  "gates": {
    "improve":  { "pass": true,  "notes": "..." },
    "optimize": { "pass": true,  "notes": "..." },
    "shrink":   { "pass": false, "notes": "..." },
    "modularize": { "pass": true,  "notes": "..." }
  },
  "decision": "reject",
  "next_status": "draft"
}
```
All four must pass for `next_status: "approved"`.

---

## 2. SVO Knowledge Extraction Protocol

**Subject · Verb · Object**

When ingesting captured content (Symphony capture docs, chat logs, transcripts),
extract structured triples instead of storing freeform prose.

### Triple Format
```yaml
- subject: "claude-opus"
  verb: "generated"
  object: "img-20260218-001"
  context:
    source_doc: "drive://Symphony/Strategy/Sym_Log_20260218"
    timestamp: "2026-02-18T14:30:00Z"
    confidence: 0.95
```

### Extraction Rules
1. **Subject** must be a known entity ID (agent, asset, user, or document)
2. **Verb** must come from a controlled vocabulary (see below)
3. **Object** must be a known entity ID OR a string literal in quotes
4. **Context** is optional but preferred — provides provenance

### Controlled Verb Vocabulary
- **Generation**: `generated`, `derived`, `composed`, `transcribed`, `narrated`
- **Lifecycle**: `created`, `updated`, `approved`, `published`, `archived`
- **Coordination**: `requested`, `delegated`, `received`, `acknowledged`
- **Knowledge**: `references`, `cites`, `contradicts`, `supersedes`, `extends`

### Storage
SVO triples are stored in the D1 `coordination_state` table under
`state_type: 'knowledge'` with the `shared_context` field holding the JSON
array of triples for that knowledge domain.

### Querying
Agents query knowledge via:
```
GET /state/knowledge-{domain}
```
And receive the full triple set for that domain, ready for composition.

---

## 3. TDD Red Team Protocol

**Failure first. Validation gates before generation passes.**

Before any agent is permitted to mark an asset as `approved`, it must run
the TDD Red Team protocol against it.

### The Protocol
1. **Define failure**: Before generating, the agent declares N concrete
   failure cases that would invalidate the output
2. **Generate**: Produce the asset normally
3. **Test**: Run each failure case against the output
4. **Score**: Output is `approved` only if zero failure cases trigger

### Standard Failure Cases by Asset Type

#### Image (failure cases must include)
- Watermark or unintended text overlay present
- Wrong aspect ratio for declared format
- Brand color palette violated
- Subject of brief missing or wrong

#### Video (failure cases must include)
- Duration outside spec (±10% of target)
- Frame rate mismatch
- Audio drift > 100ms
- Missing intro/outro per brand spec

#### Music (failure cases must include)
- BPM outside requested range
- Genre/mood mismatch
- Loop point discontinuity (for looping tracks)
- Sample rate not 44100 Hz

#### Speech (failure cases must include)
- Pronunciation errors on key terms
- Wrong voice gender per spec
- Pacing deviation > 15% from target
- Background noise or artifacts

#### Composition (failure cases must include)
- Component asset missing from final
- Audio levels not normalized (-18 LUFS target)
- Cuts on wrong beat
- Final length not within ±5% of target

### Implementation
The Red Team check is encoded in `.meta.yml` under the `review` block:
```yaml
review:
  red_team:
    failure_cases:
      - id: "rt-001"
        description: "Watermark present in output"
        check: "visual-inspection-required"
        triggered: false
      - id: "rt-002"
        description: "Aspect ratio mismatch"
        check: "automated-dimension-check"
        triggered: false
    approved_by_red_team: true
    reviewed_at: "2026-02-18T14:45:00Z"
```

---

## Protocol Interaction

```
Asset Generated
   │
   ▼
SVO Extraction ──► Triples stored in coordination_state
   │
   ▼
TDD Red Team ────► Failure cases run, results in .meta.yml
   │              (fails any case → status stays draft)
   ▼
IOSM Governance ─► Four gates run, results in .meta.yml
   │              (any gate fails → status stays draft)
   ▼
Status: approved
```

All three protocols are **mandatory**. An asset is only `approved` if it
passes Red Team checks AND all four IOSM gates. SVO extraction runs on every
asset for knowledge graph maintenance regardless of approval.
