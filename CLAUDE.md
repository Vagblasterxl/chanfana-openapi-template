# Symphony Creative Studio

## What This Is
Cloudflare Worker backend (Hono + Chanfana + D1) with a Symphony capture pipeline
and generative AI media creation studio.

## Architecture
- **Backend**: `src/` — Hono + Chanfana OpenAPI Worker with D1 database
- **Setup**: `setup/` — Windows installer, AHK scripts, 6 git submodules, env templates
- **Media**: `media/` — AI-generated assets with `.meta.yml` sidecars and lineage tracking
- **Templates**: `templates/` — machine-readable specs for generation parameters
- **Agent context**: `.agent/` — manifest, architecture, conventions for AI navigation

## Key Patterns
- Every generated asset gets a `.meta.yml` sidecar file alongside it
- Assets tracked in `media/.meta/lineage-index.yml` for cross-reference
- Symlink indexes in `media/_index/` enable discovery by status, type, or tag
- The `.agent/manifest.yml` is the machine-readable project index — read it first

## MCP Servers (8)
- `notebooklm` — NotebookLM knowledge management
- `googleDrive` — Google Drive file access
- `mcp-imagen` — Vertex AI image generation (Imagen 3)
- `mcp-veo` — Vertex AI video generation (Veo 2)
- `mcp-lyria` — Vertex AI music generation
- `mcp-chirp` — Vertex AI speech synthesis (Chirp 3 HD)
- `mcp-gemini` — Vertex AI multimodal (Gemini 2.5)
- `mcp-avtool` — FFmpeg-based media composition

## API Endpoints
- `GET/POST /tasks` — task CRUD (template example)
- `GET/POST /assets` — asset catalog with filtering by type/status
- `GET/PUT/DELETE /assets/:id` — single asset operations

## Conventions
- TypeScript strict, Zod validation, Chanfana D1 endpoints
- YAML for metadata/config, `.meta.yml` sidecars for assets
- Asset IDs: `{type}-{YYYYMMDD}-{seq}` (e.g., `img-20260218-001`)
- See `.agent/conventions.md` for full list
