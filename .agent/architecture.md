# Architecture

## System Overview

```
CAPTURE LAYER          INTELLIGENCE LAYER         OUTPUT LAYER
--------------         ------------------         ------------
PowerToys              Claude Desktop             Google Drive
Advanced Paste  --->   + 8 MCP Servers    --->    NotebookLM
  |                      |                        media/ assets
  v                      v                          |
AHK Symphony           Vertex AI                    v
  |                    (Veo, Imagen,              Compositions
  v                     Lyria, Chirp)             (video+music
Apps Script              |                         +speech)
  |                      v
  v                    Ollama (local)
Google Drive           (metadata, prompts)
```

## Component Map

### Backend (Cloudflare Worker)
- `src/index.ts` — Hono app with OpenAPI via Chanfana
- `src/endpoints/tasks/` — CRUD template (D1 + Zod)
- `src/endpoints/assets/` — Asset catalog API (D1 + Zod)
- Database: Cloudflare D1 (SQLite)

### Capture Pipeline (Windows local)
- PowerToys Advanced Paste — AI clipboard transform (Ollama/Gemini)
- `setup/scripts/symphony-advanced-paste.ahk` — hotkey chaining
- Apps Script receiver — Drive Doc creation
- Google Drive MCP — Claude reads captured docs

### Media Generation (Cloud + Local hybrid)
- Vertex AI MCPs — Veo (video), Imagen (images), Lyria (music), Chirp (speech)
- mcp-avtool — FFmpeg-based composition/assembly
- mcp-gemini — multimodal tasks, creative image editing
- Ollama (localhost:11434) — prompt refinement, metadata extraction, summarization

### Knowledge Management
- NotebookLM MCP — source management, Q&A
- open-notebook — self-hosted fallback (Docker)
- nblm CLI — enterprise API client

### Asset Management
- `media/` — generated assets with `.meta.yml` sidecars
- `media/.meta/lineage-index.yml` — cross-asset relationship graph
- `media/_index/` — symlink-based discovery (by_status, by_type, by_tag)
- `templates/` — machine-readable generation specs
- D1 `assets` table — queryable catalog via `/assets` API

## Data Flow

1. **Capture**: User clips content → Advanced Paste → AHK → Apps Script → Drive
2. **Ingest**: Claude detects new Drive doc via googleDrive MCP
3. **Generate**: Claude reads templates, calls Vertex AI MCPs, saves to `media/`
4. **Enrich**: Ollama generates tags, descriptions, alt text → writes `.meta.yml`
5. **Assemble**: mcp-avtool combines video + music + speech → `media/compositions/`
6. **Catalog**: Asset registered in D1 via POST `/assets`, lineage index updated
7. **Publish**: Approved assets uploaded to Drive, added to NotebookLM
