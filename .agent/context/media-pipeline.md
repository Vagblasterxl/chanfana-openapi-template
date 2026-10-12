# Media Generation Pipeline

## Overview
Cloud-based generation via Google Vertex AI MCPs, with local Ollama for text tasks.

## Generation Flow
1. Claude receives creative brief (from Symphony capture or direct request)
2. Reads template specs from `templates/{type}/standard-formats.yml`
3. Reads brand standards from `templates/brand/default-brand.yml`
4. Ollama refines prompt locally (prompt expansion, brand alignment)
5. Calls appropriate Vertex AI MCP:
   - `mcp-imagen` → images saved to `media/images/`
   - `mcp-veo` → videos saved to `media/video/`
   - `mcp-lyria` → music saved to `media/music/`
   - `mcp-chirp` → speech saved to `media/speech/`
6. Creates `.meta.yml` sidecar with full provenance
7. Registers asset in D1 via POST `/assets`
8. Updates `media/.meta/lineage-index.yml`

## Assembly Flow
1. Claude identifies component assets for a composition
2. Calls `mcp-avtool` (FFmpeg wrapper) to combine:
   - Video track + background music + voiceover
   - Volume adjustment, concatenation, format conversion
3. Output saved to `media/compositions/`
4. Composition `.meta.yml` records all component asset IDs

## Ollama Tasks (local, GTX 1080)
- Prompt refinement: expand vague descriptions into detailed generation prompts
- Metadata extraction: generate tags, descriptions, alt text from prompts
- Content summarization: condense long captures into creative briefs
- Model: mistral:7b at localhost:11434

## Cost Tracking
Each `.meta.yml` includes `generation.cost_estimate` with API call count and USD estimate.
Aggregate costs queryable via the D1 assets table.
