# Media Directory

All AI-generated assets live here, organized by type.

## Structure
- `video/` — generated video clips (Veo)
- `images/` — generated images (Imagen)
- `music/` — generated music tracks (Lyria)
- `speech/` — generated voiceovers (Chirp)
- `compositions/` — assembled final outputs (mcp-avtool/FFmpeg)
- `.meta/` — global metadata (lineage index, generation log)
- `_index/` — symlink-based discovery indexes

## Sidecar Convention
Every asset MUST have a `{filename}.meta.yml` sidecar alongside it.
Example: `hero-sunset.mp4` has `hero-sunset.mp4.meta.yml`.

## Required Sidecar Fields
- `asset`: id, filename, type, status, version
- `generation`: model, provider, mcp_server, prompt, parameters
- `provenance`: created_at, created_by, source_pipeline
- `lineage`: parent_assets, child_assets, composition_memberships
- `tags`: searchable keyword array

## Status Flow
`draft` → `review` → `approved` → `published` → `archived`

## Symlink Indexes
`_index/by_status/`, `_index/by_type/`, `_index/by_tag/` contain symlinks for discovery.
Run `setup/scripts/rebuild-indexes.ps1` (Windows) or `rebuild-indexes.sh` (Linux) to regenerate.

## Binary Files
Media binaries are gitignored. Only `.meta.yml` sidecars, `CLAUDE.md` files, and `.meta/` contents are tracked in git.
