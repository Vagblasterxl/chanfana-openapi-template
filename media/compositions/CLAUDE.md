# Compositions

Assembled final outputs combining video + music + speech via `mcp-avtool` (FFmpeg).

## Assembly
- mcp-avtool handles: overlay, concatenate, volume adjustment, format conversion
- All component assets must exist in their respective directories first
- The composition `.meta.yml` records every component asset ID in the lineage block

## Naming
`{project-name}-{variant}-v{version}.mp4` (e.g., `brand-hero-final-v1.mp4`)

## Sidecar
Composition `.meta.yml` must include:
- `lineage.parent_assets`: array of all component asset IDs
- `generation.parameters`: FFmpeg operations used (overlay, concat, etc.)
- `output.duration_seconds`: total runtime
