# Video Assets

Generated via `mcp-veo` (Google Veo 2).

## Generation
- Templates: `templates/video/standard-formats.yml`
- Formats: hero-landscape (16:9), social-square (1:1), social-vertical (9:16)
- Image-to-video: provide an image from `media/images/` as input

## Naming
`{descriptive-name}-v{version}.mp4` (e.g., `sunset-hero-clip-v1.mp4`)

## Sidecar
Every `.mp4` file must have a `.mp4.meta.yml` with duration_seconds in the output block.
