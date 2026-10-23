# NotebookLM + Claude MCP Integration Guide

Connect Claude Desktop and Claude Code to Google NotebookLM and Google Drive for the Symphony capture pipeline.

---

## Table of Contents

1. [GitHub Repos — Quick Links](#github-repos--quick-links)
2. [Step 1: NotebookLM MCP (Pantheon Security)](#step-1-notebooklm-mcp-pantheon-security)
3. [Step 2: Google Drive MCP](#step-2-google-drive-mcp)
4. [Step 3: Wire Symphony Capture → NotebookLM](#step-3-wire-symphony-capture--notebooklm)
5. [Supporting Repos](#supporting-repos)
6. [Recommended Install Order](#recommended-install-order)

---

## GitHub Repos — Quick Links

| Repo | URL |
|---|---|
| NotebookLM MCP (Pantheon Security) | https://github.com/Pantheon-Security/notebooklm-mcp-secure |
| Google Drive MCP | https://github.com/michaelpine25/googleDriveMCP |
| open-notebook (local fallback) | https://github.com/lfnovo/open-notebook |
| nblm Python SDK | https://github.com/K-dash/nblm-rs |
| AHK Multi-Clipboard | https://github.com/GroggyOtter/AHK_Multi_Clipboard |

---

## Step 1: NotebookLM MCP (Pantheon Security)

Secure MCP server connecting Claude Desktop to NotebookLM with Gemini API integration and enterprise-grade security.

### Install (one command)

```bash
claude mcp add notebooklm \
  --env NLMCP_AUTH_ENABLED=true \
  --env NLMCP_AUTH_TOKEN=$(openssl rand -base64 32) \
  --env GEMINI_API_KEY=YOUR_GEMINI_API_KEY \
  -- npx @pan-sec/notebooklm-mcp@latest
```

### Authenticate

In Claude, say: **"Log me in to NotebookLM"** → Chrome opens → Sign in with your Google account.

### Test

Say: **"List my NotebookLM notebooks"**

---

## Step 2: Google Drive MCP

MCP server connecting Claude Desktop directly to your Google Drive. Claude reads/interacts with your Drive files including Symphony capture Docs.

### 2.1 Google Cloud Setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. New Project → Enable **Google Drive API**
3. Credentials → Create **OAuth 2.0 Client ID**
4. Application type: **Desktop app**
5. Note your `CLIENT_ID` and `CLIENT_SECRET`
6. Redirect URI: `http://localhost:3000`

### 2.2 Clone and Build

```bash
git clone https://github.com/michaelpine25/googleDriveMCP
cd googleDriveMCP
```

Create `.env` file:

```
CLIENT_ID=your-client-id
CLIENT_SECRET=your-client-secret
REDIRECT_URI=http://localhost:3000
```

```bash
npm install
npm run tokenGenerator    # browser opens, sign in with Google
npm run build
```

### 2.3 Configure Claude Desktop

Open: `%APPDATA%\Claude\claude_desktop_config.json`

Add the following MCP server block:

```json
{
  "mcpServers": {
    "googleDrive": {
      "command": "node",
      "args": ["C:/path/to/googleDriveMCP/build/index.js"],
      "env": {
        "CLIENT_ID": "your-client-id",
        "CLIENT_SECRET": "your-client-secret",
        "REDIRECT_URI": "http://localhost:3000"
      }
    }
  }
}
```

Replace `C:/path/to/googleDriveMCP/build/index.js` with the actual path on your machine.

### 2.4 Test

Restart Claude Desktop. Say: **"List files in my Google Drive Symphony/Strategy folder"**

---

## Step 3: Wire Symphony Capture → NotebookLM

After both MCPs are live, tell Claude:

> "Monitor the Drive folders: Inbox, Architecture, Strategy, Context, Archive. When new `Sym_Log_*` Docs appear, add them as sources to the matching NotebookLM notebook using `manage_sources`."

Claude will use both MCPs together to close the loop automatically.

### Full Pipeline

```
Win+Shift+V (Advanced Paste)
  → AI compress/format clipboard
    → Ctrl+Win+S (AHK Symphony)
      → Apps Script POST
        → Drive Doc
          → Claude MCP detects new doc
            → Adds as source to NotebookLM notebook
```

---

## Supporting Repos

| Repo | What It Does | Why It Fits |
|---|---|---|
| [lfnovo/open-notebook](https://github.com/lfnovo/open-notebook) | Self-hosted NotebookLM alternative, full REST API, 16+ AI providers including Ollama + Claude | Run locally on your laptops, no Enterprise API needed |
| [K-dash/nblm-rs](https://github.com/K-dash/nblm-rs) + Python nblm SDK | CLI/Python SDK for NotebookLM Enterprise API — `pip install nblm`, add sources programmatically | Apps Script receiver → `nblm sources add` pipeline |
| [osen77/NotebookLM-API](https://github.com/osen77/NotebookLM-API) | FastAPI + Playwright auto-adds sources to NotebookLM (URLs, YouTube, raw text) | No Enterprise needed — browser automation fallback |
| [teng-lin/notebooklm-py](https://github.com/teng-lin/notebooklm-py) | Unofficial async Python API + Claude Code skills | Claude drives NotebookLM without Enterprise |
| [GroggyOtter/AHK_Multi_Clipboard](https://github.com/GroggyOtter/AHK_Multi_Clipboard) | AHK multi-clipboard class — 5 slots mapped to keyboard | Maps directly to Symphony's 5 categories |

---

## Recommended Install Order

1. **notebooklm-mcp-secure** → Claude Desktop gets NotebookLM control
2. **googleDriveMCP** → Claude Desktop reads Symphony Drive Docs
3. **nblm Python SDK** → Apps Script POST → Python script → `nblm sources add` auto-push
4. **open-notebook** → Fallback if no NotebookLM Enterprise; full REST API, runs on your hardware
5. **AHK_Multi_Clipboard** → Extend Symphony AHK with 5-slot clipboard matching 5 Drive categories
