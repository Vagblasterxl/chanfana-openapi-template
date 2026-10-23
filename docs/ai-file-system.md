# AI-Native File System

How this project organizes files so AI agents can efficiently navigate, generate, and manage assets.

## Core Concepts

### AgentFS Pattern
Inspired by [tursodatabase/agentfs](https://github.com/tursodatabase/agentfs) — everything an agent does lives in a queryable structure with full audit trails. The key insight: agents work best when data is organized as files with predictable paths, not behind custom APIs.

### .agent/ Directory
Machine-readable project index. Any agent (Claude, Cursor, Windsurf) reads `.agent/manifest.yml` first to understand the project structure, capabilities, and conventions.

```
.agent/
├── manifest.yml          # Project identity, entry points, MCP servers
├── architecture.md       # System diagram and component map
├── conventions.md        # Naming, file formats, metadata rules
└── context/
    ├── symphony-pipeline.md   # How capture works
    ├── media-pipeline.md      # How generation works
    └── mcp-servers.md         # All 8 MCP servers
```

### Hierarchical CLAUDE.md
Context files at each directory level, loaded by proximity:

```
/CLAUDE.md              ← project overview (always loaded)
/media/CLAUDE.md        ← media domain rules
/media/video/CLAUDE.md  ← video-specific guidelines
/templates/CLAUDE.md    ← how to use templates
/setup/CLAUDE.md        ← installer and submodules
```

## Metadata Sidecar Convention

Every generated asset gets a `.meta.yml` file alongside it:

```
media/images/hero-sunset-v2.png           ← the asset
media/images/hero-sunset-v2.png.meta.yml  ← full provenance
```

### Sidecar Schema

```yaml
asset:
  id: "img-20260218-001"
  filename: "hero-sunset-v2.png"
  type: "image"
  status: "approved"
  version: 2

generation:
  model: "imagen-3"
  provider: "vertex-ai"
  mcp_server: "mcp-imagen"
  prompt: "A dramatic sunset over mountain peaks..."
  parameters:
    aspect_ratio: "16:9"
  cost_estimate:
    api_calls: 1
    estimated_usd: 0.04

provenance:
  created_at: "2026-02-18T14:30:00Z"
  created_by: "claude-desktop"
  source_pipeline: "symphony-capture"

lineage:
  parent_assets: []
  child_assets: ["vid-20260218-003"]
  composition_memberships: ["comp-20260218-001"]

tags: ["sunset", "mountains", "hero-image"]
```

### Asset ID Format
`{type_prefix}-{YYYYMMDD}-{sequence}`

| Type | Prefix | Example |
|------|--------|---------|
| Image | img | img-20260218-001 |
| Video | vid | vid-20260218-003 |
| Music | mus | mus-20260218-002 |
| Speech | spch | spch-20260218-004 |
| Composition | comp | comp-20260218-001 |

## Lineage Index

`media/.meta/lineage-index.yml` tracks cross-asset relationships as an adjacency graph:

```yaml
assets:
  img-20260218-001:
    type: image
    path: "media/images/hero-sunset-v2.png"
    status: approved
    parents: []
    children: ["vid-20260218-003"]

  comp-20260218-001:
    type: composition
    path: "media/compositions/brand-hero-final.mp4"
    parents: ["vid-20260218-003", "mus-20260218-002", "spch-20260218-004"]
```

## Symlink Indexes

`media/_index/` provides queryable views via filesystem symlinks:

```
media/_index/
├── by_status/
│   ├── draft/          ← symlinks to all draft assets
│   ├── review/
│   ├── approved/
│   └── published/
├── by_type/
│   ├── video/          ← symlinks to all videos
│   ├── image/
│   ├── music/
│   ├── speech/
│   └── composition/
└── by_tag/
    ├── sunset/         ← symlinks to all "sunset" tagged assets
    └── brand-campaign/
```

Agents can discover assets with standard commands:
```bash
ls media/_index/by_status/approved/
ls media/_index/by_tag/sunset/
```

Rebuild indexes after changes:
- Windows: `setup/scripts/rebuild-indexes.ps1`
- Linux: `setup/scripts/rebuild-indexes.sh`

## Asset Lifecycle

```
draft → review → approved → published → archived
```

Each status transition:
1. Updates the `.meta.yml` sidecar
2. Updates the D1 database via PUT `/assets/:id`
3. Rebuilds symlink indexes

## D1 Database

The `assets` table mirrors sidecar metadata for API-based queries:

```
GET /assets                      ← list all, filter by type/status
GET /assets?search=sunset        ← full-text search
POST /assets                     ← register new asset
PUT /assets/:id                  ← update status, tags, lineage
DELETE /assets/:id               ← remove asset record
```

## Git Strategy

Media binaries are **gitignored** (too large). Only these are tracked:
- `.meta.yml` sidecars (provenance)
- `CLAUDE.md` files (context)
- `media/.meta/` contents (lineage + generation log)
- Template YAML specs

The actual media files live locally + in GCS (`GENMEDIA_BUCKET`).
