# Symphony Creative Studio

## What This Is
Cloudflare Worker backend (Hono + Chanfana + D1 + R2) with a Symphony capture
pipeline, multi-agent coordination layer, and generative AI media creation
studio. The single unified coordination endpoint for any Claude instance.

## Architecture
- **Backend**: `src/` — Hono + Chanfana OpenAPI Worker with D1 database + R2 bucket
- **Setup**: `setup/` — Windows installer, AHK scripts, 6 git submodules, Go services
- **Media**: `media/` — AI-generated assets with `.meta.yml` sidecars and lineage tracking
- **Templates**: `templates/` — machine-readable specs for generation parameters and automation schemas
- **Agent context**: `.agent/` — manifest, architecture, conventions, system protocols

## Key Patterns
- Every generated asset gets a `.meta.yml` sidecar file alongside it
- Assets tracked in `media/.meta/lineage-index.yml` for cross-reference
- Symlink indexes in `media/_index/` enable discovery by status, type, or tag
- The `.agent/manifest.yml` is the machine-readable project index — read it first
- All multi-agent traffic flows through D1 tables (`agents`, `messages`, `coordination_state`)

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
**Public**:
- `GET /health` — service health, agent count, timestamp
- `GET/POST /tasks` — task CRUD (template example)
- `GET/POST /assets` — asset catalog with filtering by type/status
- `GET/PUT/DELETE /assets/:id` — single asset operations
- `POST /assets/:id/review` — IOSM Governance + TDD Red Team gate review

**Authenticated** (Bearer token via `API_KEY` env var):
- `POST /agents/register` — register/upsert agent
- `POST /agents/:id/heartbeat` — update status, get pending message count
- `GET/DELETE /agents/:id` — read/remove agent
- `GET /agents` — list agents
- `POST /messages/send` — agent → agent message
- `GET /messages/receive/:agent_id` — pull pending messages (optional `?mark_read=true`)
- `GET /messages` — list all messages
- `POST /state/update` — upsert coordination state
- `GET /state/:id` — read state by ID
- `GET /state` — list state objects

## System Protocols (mandatory)
See `.agent/protocols/system-protocols.md` for full spec.
- **IOSM** — Improve, Optimize, Shrink, Modularize. Four gates that govern
  every asset's transition from `draft` → `approved`. Run via `POST /assets/:id/review`.
- **SVO** — Subject·Verb·Object knowledge extraction. All ingested content
  becomes structured triples in `coordination_state` (state_type=knowledge).
- **TDD Red Team** — Define failure cases before generating. Asset only
  passes if zero failure cases trigger.

## Automation Engine
Agents acting as Automation Engines MUST output JSON matching
`templates/automation/engine-template.json`. Conversational responses are
rejected. Schema enforces: protocol_version, agent_id, task, status, result
(with iosm_gates, red_team, svo_triples), and next_actions.

## Conventions
- TypeScript strict, Zod validation, Chanfana D1 endpoints
- YAML for metadata/config, `.meta.yml` sidecars for assets
- Asset IDs: `{type}-{YYYYMMDD}-{seq}` (e.g., `img-20260218-001`)
- Auth: `Authorization: Bearer ${API_KEY}` on `/agents/*`, `/messages/*`, `/state/*`
- See `.agent/conventions.md` for full list

## Building Locally
```bash
pnpm install
npx wrangler deploy --dry-run    # verify build
npm run test                     # vitest integration tests
npm run dev                      # local server with seeded D1
```

## Deploying
```bash
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```
