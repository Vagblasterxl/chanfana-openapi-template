# Conventions

## Code
- TypeScript strict mode, ESNext target, bundler module resolution
- Zod for all data validation
- Chanfana D1 endpoints for CRUD (auto-validation, schema generation)
- Hono sub-routers for endpoint grouping

## Files
- YAML for metadata and configuration (not JSON, except Claude Desktop config)
- Metadata sidecars: `{filename}.meta.yml` alongside every generated asset
- Asset IDs: `{type_prefix}-{YYYYMMDD}-{sequence}` (e.g., `img-20260218-001`)
- Type prefixes: img, vid, mus, spch, comp

## Naming
- Directories: lowercase, hyphens (e.g., `by_status`, `standard-formats`)
- Files: lowercase, hyphens for multi-word (e.g., `hero-sunset-v2.png`)
- Endpoints: camelCase classes (e.g., `AssetCreate`), kebab-case URLs (e.g., `/assets/:id`)
- Templates: `standard-formats.yml` in each type directory

## Asset Lifecycle
- Status flow: `draft` → `review` → `approved` → `published` → `archived`
- Every status change recorded in `.meta.yml` and D1
- Symlink indexes rebuilt after status changes

## Metadata Requirements
Every generated asset MUST have:
1. A `.meta.yml` sidecar with full provenance
2. An entry in `media/.meta/lineage-index.yml`
3. A D1 record via POST `/assets`
4. Symlinks in `media/_index/` for the appropriate status, type, and tags
