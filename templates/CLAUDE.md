# Templates

Machine-readable YAML specs defining standard generation parameters.

## Structure
- `video/standard-formats.yml` — video resolution, fps, aspect ratio presets
- `images/standard-formats.yml` — image dimension and format presets
- `music/standard-formats.yml` — duration, sample rate, format presets
- `speech/standard-formats.yml` — voice, encoding, speaking rate presets
- `brand/default-brand.yml` — color palette, style keywords, negative prompts

## Usage
Before generating any asset, read the relevant template to pick format parameters.
Always apply `brand/default-brand.yml` style keywords and negative prompts.

## Customization
Create new `.yml` files alongside the standards for project-specific presets.
Example: `templates/video/campaign-q1.yml` for a specific campaign's video specs.
