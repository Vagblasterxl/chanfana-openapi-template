# Setup Directory

Windows automation and configuration for the full Symphony + Media pipeline.

## Master Installer
`scripts/setup-windows.ps1` — run as Administrator. Prompts for 5 values, then automates:
1. NotebookLM MCP (claude mcp add)
2. Google Drive MCP (clone + build)
3. Claude Desktop config (8 MCP servers)
4. open-notebook (Docker)
5. Ollama + mistral:7b
6. AHK scripts (multi-clipboard + Symphony)
7. Vertex AI Creative Studio (Go build, 6 MCP binaries)
8. FFmpeg
9. Google Cloud CLI + ADC auth

## Submodules (6)
- `repos/notebooklm-mcp-secure` — Claude-NotebookLM bridge
- `repos/googleDriveMCP` — Claude-Drive bridge
- `repos/open-notebook` — self-hosted NotebookLM (Docker)
- `repos/AHK_Multi_Clipboard` — 5-slot clipboard
- `repos/nblm-rs` — NotebookLM Enterprise CLI
- `repos/vertex-ai-creative-studio` — Vertex AI media MCPs (Go)

## Config Templates
`config-templates/` contains `.env.example` files and `claude_desktop_config.json` template.
These are committed to git as reference. The installer writes the real configs with user credentials.
