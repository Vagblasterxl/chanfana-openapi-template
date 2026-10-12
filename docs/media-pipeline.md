# Media Generation Pipeline

Full generative AI media creation via Google Vertex AI, orchestrated by Claude Desktop.

## Architecture

```
Symphony Capture          Claude Desktop (8 MCPs)        Output
-----------------         ----------------------         ------
Advanced Paste    --->    mcp-imagen (images)     --->   media/images/
AHK hotkeys       --->    mcp-veo (video)         --->   media/video/
Apps Script        --->    mcp-lyria (music)       --->   media/music/
Google Drive       --->    mcp-chirp (speech)      --->   media/speech/
                          mcp-avtool (compose)     --->   media/compositions/
                          mcp-gemini (multimodal)
                          Ollama (local metadata)
```

## MCP Servers

| Server | Binary | Model | Use Case |
|--------|--------|-------|----------|
| mcp-imagen | mcp-imagen-go | Imagen 3 | Image generation |
| mcp-veo | mcp-veo-go | Veo 2 | Video generation |
| mcp-lyria | mcp-lyria-go | Lyria | Music generation |
| mcp-chirp | mcp-chirp3-go | Chirp 3 HD | Text-to-speech |
| mcp-gemini | mcp-gemini-go | Gemini 2.5 | Creative editing, conversational TTS |
| mcp-avtool | mcp-avtool-go | FFmpeg | Media composition/assembly |

All Vertex AI servers share: `PROJECT_ID`, `LOCATION`, `GENMEDIA_BUCKET` env vars.
Auth: Google Cloud Application Default Credentials (`gcloud auth application-default login`).

## Templates

Machine-readable YAML specs in `templates/`:

```
templates/
├── video/standard-formats.yml    ← hero-landscape, social-square, social-vertical
├── images/standard-formats.yml   ← hero-banner, social-post, og-image, portrait
├── music/standard-formats.yml    ← background-loop, intro-jingle, full-track, score
├── speech/standard-formats.yml   ← narration-male, narration-female, conversational
└── brand/default-brand.yml       ← colors, style keywords, negative prompts, defaults
```

Before generating, read the relevant template for parameters and apply brand standards.

## End-to-End Flow

### 1. Capture Phase (existing Symphony pipeline)
```
Win+Shift+V → Advanced Paste → AI transform (Ollama)
Ctrl+Win+S → AHK category picker → Apps Script POST
→ Drive Doc created: Sym_Log_{category}_{timestamp}
→ Claude detects via googleDrive MCP
```

### 2. Generation Phase (Vertex AI MCPs)
```
Claude reads brief from Drive doc
→ Reads templates/brand/default-brand.yml for style standards
→ Reads templates/{type}/standard-formats.yml for format specs
→ Ollama refines prompt locally (prompt expansion, brand alignment)
→ Calls mcp-imagen → media/images/{name}.png + .meta.yml
→ Calls mcp-veo → media/video/{name}.mp4 + .meta.yml
→ Calls mcp-lyria → media/music/{name}.wav + .meta.yml
→ Calls mcp-chirp → media/speech/{name}.mp3 + .meta.yml
→ POST /assets for each generated asset
→ Updates media/.meta/lineage-index.yml
```

### 3. Assembly Phase (mcp-avtool)
```
Claude identifies components for composition
→ Calls mcp-avtool: overlay video + music + speech
→ Output → media/compositions/{name}.mp4 + .meta.yml
→ Composition .meta.yml records all component asset IDs
→ POST /assets for composition
→ Updates lineage-index.yml with parent/child edges
```

### 4. Review Phase
```
All assets start as "draft"
→ User reviews in Claude Desktop
→ PUT /assets/:id {status: "approved"}
→ .meta.yml updated
→ Symlink indexes rebuilt (run rebuild-indexes script)
```

### 5. Publish Phase
```
Approved compositions → googleDrive MCP → upload to Drive
→ notebooklm MCP → add as NotebookLM source
→ PUT /assets/:id {status: "published"}
→ Loop closed: knowledge base updated with new content
```

## Ollama Local Tasks

Ollama (localhost:11434, mistral:7b on GTX 1080) handles text tasks locally:

| Task | What It Does |
|------|-------------|
| Prompt refinement | Expands vague descriptions into detailed generation prompts |
| Metadata extraction | Generates tags, descriptions, alt text from prompts |
| Content summarization | Condenses long captures into creative briefs |

## Cost Tracking

Each `.meta.yml` includes:
```yaml
generation:
  cost_estimate:
    api_calls: 1
    estimated_usd: 0.04
```

Query aggregate costs via the D1 API: `GET /assets?search=vertex-ai`

## Setup

Run the master installer:
```powershell
.\setup\scripts\setup-windows.ps1 `
  -GeminiApiKey "key" `
  -GoogleClientId "id" `
  -GoogleClientSecret "secret" `
  -GcpProjectId "project-id" `
  -GcsBucketName "bucket-name"
```

Steps 8-9 handle Go toolchain, Vertex AI MCP binary compilation, FFmpeg, and `gcloud auth`.
