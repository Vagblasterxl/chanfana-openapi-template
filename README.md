# Symphony Creative Studio

**Cloudflare Worker backend + AI media creation pipeline + multi-agent orchestration**

Built on [Hono](https://hono.dev) + [Chanfana](https://chanfana.com) + [D1](https://developers.cloudflare.com/d1/) with 8 MCP servers for generative AI media production.

---

## What This Does

Symphony is a full-stack creative production system:

1. **Capture** — PowerToys Advanced Paste + AHK hotkeys grab content from anywhere on Windows
2. **Intelligence** — Claude Desktop with 8 MCP servers processes, generates, and orchestrates
3. **Generation** — Vertex AI creates images (Imagen 3), video (Veo 2), music (Lyria), speech (Chirp 3 HD)
4. **Assembly** — FFmpeg composes final media from generated components
5. **Catalog** — D1 database tracks every asset with full lineage and metadata sidecars
6. **Knowledge** — NotebookLM + Google Drive close the loop, feeding outputs back into the knowledge base

```
CAPTURE                INTELLIGENCE              OUTPUT
───────                ────────────              ──────
PowerToys    ──►  Claude Desktop          ──►  Google Drive
  Advanced         + 8 MCP Servers              NotebookLM
  Paste              │                          media/ assets
    │                ▼                            │
AHK Symphony     Vertex AI                       ▼
    │            (Veo, Imagen,               Compositions
    ▼             Lyria, Chirp)              (video+music
Apps Script          │                        +speech)
    │                ▼
    ▼            Ollama (local)
Google Drive     (metadata, prompts)
```

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm i -g wrangler`)

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create the D1 database
npx wrangler d1 create openapi-template-db
# Copy the database_id into wrangler.jsonc

# 3. Run migrations (creates tasks, assets, agents, messages, state tables)
npx wrangler d1 migrations apply DB --remote

# 4. Deploy
npx wrangler deploy
```

### Local Development

```bash
npm run dev          # Starts local dev server with seeded D1
npm run test         # Runs integration tests via Vitest
npm run schema       # Generates openapi.json from code
```

---

## API Reference

Base URL: `https://your-worker.workers.dev`

OpenAPI docs auto-generated at `/` (Swagger UI) and `/openapi.json`.

### Public Endpoints

#### Health

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/health` | Service health, agent count, timestamp |

#### Tasks (CRUD Template)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/tasks` | List tasks (searchable by name, slug, description) |
| `POST` | `/tasks` | Create task |
| `GET` | `/tasks/:id` | Get single task |
| `PUT` | `/tasks/:id` | Update task |
| `DELETE` | `/tasks/:id` | Delete task |

**Task fields**: `id`, `name`, `slug`, `description`, `completed`, `due_date`

#### Assets (AI Media Catalog)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/assets` | List assets (filter by type, status, model, tags) |
| `POST` | `/assets` | Register new asset |
| `GET` | `/assets/:id` | Get single asset |
| `PUT` | `/assets/:id` | Update asset (status, tags, lineage) |
| `DELETE` | `/assets/:id` | Remove asset |
| `POST` | `/assets/:id/review` | IOSM Governance + TDD Red Team gate review |

**Asset fields**: `id`, `filename`, `asset_type`, `status`, `version`, `model`, `provider`, `mcp_server`, `prompt`, `local_path`, `tags`, `parent_assets`, `child_assets`, `created_at`, `updated_at`

**Asset types**: `image`, `video`, `music`, `speech`, `composition`

**Asset statuses**: `draft` → `review` → `approved` → `published` → `archived`

**Asset ID format**: `{type}-{YYYYMMDD}-{seq}` (e.g., `img-20260218-001`)

### Authenticated Endpoints

All require `Authorization: Bearer <API_KEY>` header.

#### Agents (Symphony Coordination)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/agents` | List all registered agents |
| `POST` | `/agents/register` | Register or update an agent |
| `GET` | `/agents/:id` | Get agent details |
| `POST` | `/agents/:id/heartbeat` | Update status, get pending message count |
| `DELETE` | `/agents/:id` | Unregister agent |

**Agent fields**: `id`, `name`, `type` (claude/discord-bot/worker), `status` (online/offline/busy), `last_heartbeat`

#### Messages (Inter-Agent Communication)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/messages` | List all messages |
| `POST` | `/messages/send` | Send message between agents |
| `GET` | `/messages/receive/:agent_id` | Get pending messages (optionally mark as delivered) |

**Message fields**: `id`, `sender`, `recipient`, `message_type` (text/command/event), `payload` (JSON), `created_at`, `status` (pending/delivered/read)

#### State (Coordination State)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/state` | List all state objects |
| `GET` | `/state/:id` | Get state by ID |
| `POST` | `/state/update` | Create or update state (upsert) |

**State fields**: `id`, `state_type` (session/pipeline/global), `active_agents` (JSON array), `pending_tasks` (JSON array), `shared_context` (JSON object)

---

## Database Schema

Three migrations create six tables:

```sql
-- 0001: Tasks (template CRUD example)
tasks (id INTEGER PK, name, slug, description, completed, due_date)

-- 0002: Assets (AI media catalog)
assets (id TEXT PK, filename, asset_type, status, version, model,
        provider, mcp_server, prompt, local_path, tags,
        parent_assets, child_assets, created_at, updated_at)
  + indexes on asset_type, status, created_at

-- 0003: Coordination
agents (id TEXT PK, name, type, status, last_heartbeat)
messages (id TEXT PK, sender, recipient, message_type, payload, created_at, status)
coordination_state (id TEXT PK, state_type, active_agents, pending_tasks, shared_context)
```

---

## MCP Servers

Eight MCP servers connect Claude Desktop to the full creative pipeline:

### Knowledge & Storage

| Server | What It Does | Auth |
|--------|-------------|------|
| `notebooklm` | NotebookLM notebook management, source ingestion, Q&A | Gemini API key + browser login |
| `googleDrive` | Google Drive file read/write, Symphony capture detection | OAuth 2.0 (Client ID + Secret) |

### Media Generation (Vertex AI)

| Server | Model | Output | Auth |
|--------|-------|--------|------|
| `mcp-imagen` | Imagen 3 | `media/images/*.png` | GCP ADC |
| `mcp-veo` | Veo 2 | `media/video/*.mp4` | GCP ADC |
| `mcp-lyria` | Lyria | `media/music/*.wav` | GCP ADC |
| `mcp-chirp` | Chirp 3 HD | `media/speech/*.mp3` | GCP ADC |
| `mcp-gemini` | Gemini 2.5 Flash | Multimodal (editing, reasoning, conversational TTS) | GCP ADC |
| `mcp-avtool` | FFmpeg | `media/compositions/*.mp4` | — |

### Shared MCP Environment Variables

```
PROJECT_ID=your-gcp-project-id
LOCATION=us-central1
GENMEDIA_BUCKET=your-gcs-bucket-name
```

---

## Media Pipeline

### Asset Lifecycle

```
draft → review → approved → published → archived
```

### Metadata Sidecars

Every generated asset gets a `.meta.yml` file alongside it:

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

lineage:
  parent_assets: []
  child_assets: ["vid-20260218-003"]
  composition_memberships: ["comp-20260218-001"]

tags: ["sunset", "mountains", "hero-image"]
```

### Lineage Tracking

`media/.meta/lineage-index.yml` tracks the full relationship graph between assets — which images became videos, which speech and music tracks composed into final outputs.

### Generation Templates

Pre-configured specs live in `templates/`:

| Category | File | Formats |
|----------|------|---------|
| Brand | `brand/default-brand.yml` | Colors, style keywords, negative prompts, tone |
| Images | `images/standard-formats.yml` | hero-banner (16:9), social-post (1:1), og-image, portrait |
| Video | `video/standard-formats.yml` | hero-landscape (1080p), social-square, social-vertical (9:16) |
| Music | `music/standard-formats.yml` | background-loop (30s), intro-jingle (8s), full-track (120s) |
| Speech | `speech/standard-formats.yml` | narration-male (Fenrir), narration-female (Leda), conversational |

---

## Symphony Capture Pipeline

The capture pipeline routes content from the Windows desktop into the AI system:

1. **PowerToys Advanced Paste** (`Win+Shift+V`) — AI-transforms clipboard content via Ollama or Gemini
2. **AHK Symphony Hotkey** (`Ctrl+Win+S`) — Categorizes and sends to Google Drive via Apps Script
3. **Claude detects** new Drive docs via `googleDrive` MCP
4. **Generation pipeline** kicks off using appropriate MCP servers
5. **Assets cataloged** in D1 with `.meta.yml` sidecars
6. **Published outputs** feed back into NotebookLM as knowledge sources

### Discord Bot (Optional)

A Go-based Discord bot (`setup/discord-bot/`) provides a chat interface:

| Command | What It Does |
|---------|-------------|
| `/audiobook <prompt>` | Full pipeline: story → storyboard → narrate → score → assemble |
| `/storyboard <outline>` | Generate visual panels from story outline |
| `/veo <prompt>` | Generate video with Veo 3.1 |
| `/agents` | Show all 8 AI agent statuses |
| `/assign <slot> <role>` | Reassign an AI agent's role |
| `/whisper <audio>` | Transcribe audio with local Whisper |

**Agent Slots**: 8 AI (narrator, artist, composer, editor, researcher, coder, reviewer, general) + 1 human (always active)

---

## Project Structure

```
chanfana-openapi-template/
│
├── src/                            ← Hono + Chanfana backend
│   ├── index.ts                    ← Main app, router setup
│   ├── types.ts                    ← AppContext, HandleArgs types
│   ├── middleware/
│   │   └── auth.ts                 ← Bearer token auth
│   └── endpoints/
│       ├── health.ts               ← GET /health
│       ├── tasks/                  ← CRUD template (5 endpoints)
│       ├── assets/                 ← Asset catalog (5 endpoints)
│       ├── agents/                 ← Agent coordination (5 endpoints)
│       ├── messages/               ← Inter-agent messaging (3 endpoints)
│       └── state/                  ← Coordination state (3 endpoints)
│
├── migrations/                     ← D1 schema migrations (3)
├── tests/                          ← Vitest integration tests
│
├── media/                          ← Generated assets + metadata
│   ├── images/                     ← Imagen 3 output
│   ├── video/                      ← Veo 2 output
│   ├── music/                      ← Lyria output
│   ├── speech/                     ← Chirp 3 HD output
│   ├── compositions/               ← FFmpeg-assembled finals
│   ├── avatars/                    ← Generated avatar images
│   └── .meta/                      ← Lineage index + generation log
│
├── templates/                      ← Generation parameter specs
│   ├── brand/                      ← Color palette, style, tone
│   ├── images/                     ← Image format specs
│   ├── video/                      ← Video format specs
│   ├── music/                      ← Music format specs
│   └── speech/                     ← Speech format specs
│
├── setup/                          ← Windows installer + submodules
│   ├── config-templates/           ← MCP + env config examples
│   ├── discord-bot/                ← Go Discord bot (8 AI agents)
│   ├── audiobook-pipeline/         ← Full audiobook creator (Go)
│   ├── veo-flow/                   ← Veo 3.1 video pipeline
│   └── repos/                      ← 6 git submodules
│
├── docs/                           ← Detailed guides
│   ├── ai-file-system.md           ← AgentFS pattern + metadata
│   ├── media-pipeline.md           ← Generation architecture
│   ├── powertoys-advanced-paste.md ← Capture pipeline setup
│   └── notebooklm-claude-mcp-integration.md
│
├── .agent/                         ← Machine-readable project index
│   ├── manifest.yml                ← Project identity + MCP servers
│   ├── architecture.md             ← System diagram
│   ├── conventions.md              ← Naming, formats, metadata rules
│   └── context/                    ← Pipeline + MCP context docs
│
├── wrangler.jsonc                  ← Cloudflare Worker config
├── package.json                    ← Dependencies + scripts
├── tsconfig.json                   ← TypeScript strict config
├── CLAUDE.md                       ← AI agent project overview
└── FILESYSTEM.md                   ← Detailed filesystem map
```

---

## System Protocols

Three governance protocols enforce quality and structure across all agent operations.
Full spec: [`.agent/protocols/system-protocols.md`](./.agent/protocols/system-protocols.md)

### IOSM Governance Protocol
**Improve · Optimize · Shrink · Modularize** — four gates every asset must
pass before being promoted from `draft` → `approved`. Submit via
`POST /assets/:id/review`.

### SVO Knowledge Extraction
**Subject · Verb · Object** — captured content gets parsed into structured
triples instead of stored as freeform prose. Stored in `coordination_state`
with `state_type: 'knowledge'`. Verbs come from a controlled vocabulary
(generated, derived, references, supersedes, etc.).

### TDD Red Team Protocol
Define failure cases **before** generating. Asset only passes review if
zero failure cases trigger. Standard cases per asset type encoded in
`.meta.yml` review block.

### Automation Engine Schema
Agents acting as Automation Engines must output strict JSON matching
[`templates/automation/engine-template.json`](./templates/automation/engine-template.json).
Forces programmatic responses with iosm_gates, red_team, svo_triples,
and next_actions fields.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Hono + Chanfana | OpenAPI auto-generation, Cloudflare-native |
| Validation | Zod | Strict TypeScript, composable schemas |
| Database | Cloudflare D1 (SQLite) | Serverless, free tier, fast migrations |
| Storage | Cloudflare R2 | Coordination sync bucket |
| Auth | Bearer token | Stateless, simple, no external deps |
| Local AI | Ollama (mistral:7b) | Free, private, runs on GTX 1080 |
| Cloud AI | Google Vertex AI | Imagen, Veo, Lyria, Chirp, Gemini — unified GCP auth |
| Composition | FFmpeg (mcp-avtool) | Local, free, professional quality |
| Metadata | YAML sidecars | Human-readable, version-controllable |
| Knowledge | NotebookLM | AI-native source management via MCP |
| Testing | Vitest | Cloudflare Workers pool integration |

---

## Authentication

### Worker API

Protected routes (`/agents/*`, `/messages/*`, `/state/*`) require:

```
Authorization: Bearer symphony-ken-2026
```

Public routes (`/health`, `/tasks/*`, `/assets/*`) require no auth.

The API key is set in `wrangler.jsonc` under `vars.API_KEY`. If unset, auth is bypassed (dev mode).

### MCP Servers

- **Vertex AI servers**: `gcloud auth application-default login`
- **NotebookLM**: Gemini API key + browser OAuth
- **Google Drive**: OAuth 2.0 Desktop app credentials

---

## Testing

```bash
npm run test          # Full test suite (dry-run deploy + vitest)
```

Tests live in `tests/integration/` and cover:
- Full CRUD lifecycle for tasks (create, read, list, update, delete)
- Input validation and error handling
- 404 responses for missing resources
- Search functionality

Test setup auto-applies all migrations to a local D1 instance.

---

## Scripts

| Command | What It Does |
|---------|-------------|
| `npm run dev` | Local dev server with seeded D1 |
| `npm run test` | Run integration tests |
| `npm run deploy` | Deploy to Cloudflare (auto-migrates) |
| `npm run schema` | Generate `openapi.json` |
| `npm run cf-typegen` | Regenerate Cloudflare type bindings |
| `npm run seedLocalDb` | Apply migrations to local D1 |

---

## Deployment

```bash
# First time
npx wrangler d1 create openapi-template-db
# Update database_id in wrangler.jsonc

# Every deploy (migrations run automatically via predeploy)
npm run deploy

# Monitor
npx wrangler tail
```

---

## License

MIT
