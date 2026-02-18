# Symphony Capture Pipeline

## Flow
```
Win+Shift+V → PowerToys Advanced Paste (AI transform via Ollama/Gemini)
  → Ctrl+Win+S → AHK category picker (Inbox/Architecture/Strategy/Context/Archive)
    → HTTP POST → Apps Script Web App
      → Creates Drive Doc: Sym_Log_{category}_{timestamp}
        → Claude detects via googleDrive MCP
```

## Hotkeys
| Shortcut | Action |
|----------|--------|
| Win+Shift+V | Advanced Paste (PowerToys) |
| Ctrl+Win+S | Symphony capture with category picker |
| Ctrl+Win+1-5 | Direct capture to category |
| Ctrl+Win+A | Advanced Paste → auto-capture chain |

## Categories
1. Inbox — unsorted captures
2. Architecture — system design, technical decisions
3. Strategy — planning, goals, roadmaps
4. Context — reference material, background info
5. Archive — completed/historical items

## Configuration
- AHK script: `setup/scripts/symphony-advanced-paste.ahk`
- Apps Script URL: configured on line 21 of AHK script
- PowerToys Advanced Paste: Settings → AI provider → Ollama at localhost:11434
