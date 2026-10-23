# Symphony Pipeline — Setup

Full automation for: PowerToys Advanced Paste + NotebookLM MCP + Google Drive MCP + Ollama + AHK Symphony capture.

## Quickstart (One Command)

On your Windows machine, open PowerShell as Administrator:

```powershell
.\setup\scripts\setup-windows.ps1
```

You'll be asked for **3 values**:
1. **Gemini API key** — get from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. **Google OAuth Client ID** — get from [console.cloud.google.com](https://console.cloud.google.com) (Drive API, Desktop app)
3. **Google OAuth Client Secret** — same page as above

Everything else is automated.

Or pass them directly:

```powershell
.\setup\scripts\setup-windows.ps1 `
  -GeminiApiKey "your-key" `
  -GoogleClientId "your-id" `
  -GoogleClientSecret "your-secret"
```

## What Gets Installed

| # | Component | Method | What It Does |
|---|-----------|--------|--------------|
| 1 | NotebookLM MCP | `claude mcp add` | Claude ↔ NotebookLM bridge |
| 2 | Google Drive MCP | git clone + npm build | Claude ↔ Drive bridge |
| 3 | Claude Desktop config | JSON write | Registers both MCPs |
| 4 | open-notebook | Docker Compose | Local NotebookLM fallback |
| 5 | Ollama + mistral:7b | winget + pull | Local AI for Advanced Paste |
| 6 | AHK Multi-Clipboard | git clone | 5-slot clipboard for 5 categories |
| 7 | Symphony AHK script | file copy + startup shortcut | Advanced Paste → Drive chain |

## Directory Structure

```
setup/
├── README.md                          ← you are here
├── config-templates/
│   ├── .env.googledrivemcp            ← Google Drive MCP env template
│   ├── .env.notebooklm-mcp           ← NotebookLM MCP env template
│   ├── .env.open-notebook             ← open-notebook env template
│   ├── .env.nblm                      ← nblm CLI env template
│   └── claude_desktop_config.json     ← Claude Desktop MCP config template
├── scripts/
│   ├── setup-windows.ps1             ← master setup (run this)
│   └── symphony-advanced-paste.ahk    ← AHK Symphony + Advanced Paste chain
└── repos/
    ├── notebooklm-mcp-secure/         ← cloned, npm installed, built
    ├── googleDriveMCP/                ← cloned, npm installed, built
    ├── open-notebook/                 ← cloned (run via Docker)
    ├── AHK_Multi_Clipboard/           ← cloned (copy .ahk to machine)
    └── nblm-rs/                       ← cloned (install via cargo/pip)
```

## Hotkeys After Setup

| Shortcut | Action |
|----------|--------|
| `Win+Shift+V` | PowerToys Advanced Paste (AI transform) |
| `Ctrl+Win+S` | Symphony capture with category picker |
| `Ctrl+Win+1-5` | Direct capture to Inbox/Architecture/Strategy/Context/Archive |
| `Ctrl+Win+A` | Advanced Paste → auto-capture chain (full pipeline) |
| `Ctrl+Numpad1-9` | Multi-Clipboard slots |

## Full Pipeline

```
Win+Shift+V (Advanced Paste)
  → AI compress/format clipboard (Ollama local or Gemini cloud)
    → Ctrl+Win+S (AHK Symphony)
      → category picker (or Ctrl+Win+1-5 direct)
        → Apps Script POST
          → Drive Doc
            → Claude MCP detects new doc
              → Adds as NotebookLM source
```

## After Setup

1. Restart Claude Desktop
2. Say: **"Log me in to NotebookLM"** (Chrome opens, sign in)
3. Say: **"List files in my Google Drive"** (verify Drive MCP works)
4. Open PowerToys → Advanced Paste → Add Ollama provider → `http://localhost:11434` → `mistral:7b`
5. Edit the Apps Script URL in `symphony-advanced-paste.ahk` line 21
6. Open `http://localhost:8502` for open-notebook web UI
