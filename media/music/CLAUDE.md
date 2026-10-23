# Music Assets

Generated via `mcp-lyria` (Google Lyria).

## Generation
- Templates: `templates/music/standard-formats.yml`
- Formats: background-loop (30s), intro-jingle (8s), full-track (120s)
- Prompts should include: genre, mood, tempo (BPM), instruments, key

## Naming
`{descriptive-name}-v{version}.wav` (e.g., `epic-theme-v1.wav`)

## Sidecar
Every music file must have a `.meta.yml` with duration_seconds and sample_rate in the output block.
