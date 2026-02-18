# Speech Assets

Generated via `mcp-chirp` (Google Chirp 3 HD) or `mcp-gemini` (conversational TTS).

## Generation
- Templates: `templates/speech/standard-formats.yml`
- Chirp 3 HD: studio-quality narration (male: Fenrir, female: Leda)
- Gemini TTS: more natural/expressive for dialogue and conversational tone

## Naming
`{descriptive-name}-v{version}.mp3` (e.g., `narrator-intro-v1.mp3`)

## Sidecar
Every speech file must have a `.meta.yml` with voice_name, speaking_rate, and transcript text.
