# MCP Servers

## Active Servers (8 total)

### Knowledge & Storage
| Server | Binary/Command | Purpose | Auth |
|--------|---------------|---------|------|
| notebooklm | `npx @pan-sec/notebooklm-mcp@latest` | NotebookLM knowledge management | Gemini API key + browser login |
| googleDrive | `node build/index.js` | Google Drive file access | OAuth Client ID + Secret |

### Media Generation (Vertex AI Creative Studio)
| Server | Binary | Purpose | Auth |
|--------|--------|---------|------|
| mcp-imagen | `mcp-imagen-go` | Image generation (Imagen 3) | GCP ADC |
| mcp-veo | `mcp-veo-go` | Video generation (Veo 2) | GCP ADC |
| mcp-lyria | `mcp-lyria-go` | Music generation (Lyria) | GCP ADC |
| mcp-chirp | `mcp-chirp3-go` | Text-to-speech (Chirp 3 HD) | GCP ADC |
| mcp-gemini | `mcp-gemini-go` | Multimodal AI (Gemini 2.5) | GCP ADC |
| mcp-avtool | `mcp-avtool-go` | Media composition (FFmpeg) | GCP ADC |

## Shared Environment Variables (Vertex AI servers)
```
PROJECT_ID=your-gcp-project-id
LOCATION=us-central1
GENMEDIA_BUCKET=your-gcs-bucket-name
MCP_SERVER_REQUEST_TIMEOUT=55000
```

## Authentication
- **NotebookLM**: Gemini API key from aistudio.google.com/apikey
- **Google Drive**: OAuth 2.0 Desktop app credentials from console.cloud.google.com
- **Vertex AI (all 6)**: Google Cloud Application Default Credentials via `gcloud auth application-default login`

## Config Location
- Claude Desktop: `%APPDATA%\Claude\claude_desktop_config.json`
- Template: `setup/config-templates/claude_desktop_config.json`
