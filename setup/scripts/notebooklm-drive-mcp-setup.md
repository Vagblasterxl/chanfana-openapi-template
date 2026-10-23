# NotebookLM + Google Drive MCP — Claude Desktop Setup

Paste this entire block into Claude Desktop. It installs both MCP servers
and wires them to Symphony.

---

## STEP 1: NotebookLM MCP (Pantheon Security)

Repo: https://github.com/Pantheon-Security/notebooklm-mcp-secure

Run this one command:

```bash
claude mcp add notebooklm \
  --env NLMCP_AUTH_ENABLED=true \
  --env NLMCP_AUTH_TOKEN=$(openssl rand -base64 32) \
  --env GEMINI_API_KEY=YOUR_GEMINI_API_KEY \
  -- npx @pan-sec/notebooklm-mcp@latest
```

Replace `YOUR_GEMINI_API_KEY` with Ken's Gemini API key.

Then tell Claude: **"Log me in to NotebookLM"** — Chrome opens, sign in
with Google account (Ken is already logged in).

Test: **"List my NotebookLM notebooks"**

---

## STEP 2: Google Drive MCP

Repo: https://github.com/michaelpine25/googleDriveMCP

### 2a. Google Cloud OAuth Setup

1. Go to https://console.cloud.google.com
2. New Project (or use existing) > Enable **Google Drive API**
3. Credentials > Create **OAuth 2.0 Client ID**
4. Application type: **Desktop app**
5. Note the `CLIENT_ID` and `CLIENT_SECRET`
6. Redirect URI: `http://localhost:3000`

### 2b. Clone, Build, Authenticate

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
npm run tokenGenerator
```

Browser opens — sign in with Ken's Google account. Token saves locally.

```bash
npm run build
```

### 2c. Add to Claude Desktop Config

Open: `%APPDATA%\Claude\claude_desktop_config.json`

Add to the `mcpServers` section (merge with existing servers):

```json
{
  "googleDrive": {
    "command": "node",
    "args": ["C:/Users/Ken/googleDriveMCP/build/index.js"],
    "env": {
      "CLIENT_ID": "your-client-id",
      "CLIENT_SECRET": "your-client-secret",
      "REDIRECT_URI": "http://localhost:3000"
    }
  }
}
```

Adjust the path in `args` to wherever you cloned the repo.

Restart Claude Desktop.

Test: **"List files in my Google Drive"**

---

## STEP 3: Mem MCP (Shared Memory)

Add to `mcpServers` in `claude_desktop_config.json`:

```json
{
  "mem": {
    "command": "npx",
    "args": ["-y", "@mem-ai/mcp-server"],
    "env": {
      "MEM_API_KEY": "<paste the MEM_API_KEY Ken provides — never commit it>"
    }
  }
}
```

Restart Claude Desktop.

Test: Create a note — **"Save a note to Mem: Symphony MCP setup complete"**

---

## STEP 4: Wire Symphony Capture to NotebookLM

After Drive + NotebookLM MCPs are live, tell Claude Desktop:

> Monitor the Drive folders: Inbox, Architecture, Strategy, Context, Archive.
> When new Sym_Log_* Docs appear, add them as sources to the matching
> NotebookLM notebook using manage_sources.

Claude Desktop uses both MCPs together to close the loop automatically:
Drive captures go in > NotebookLM indexes them > Claude can query them.

---

## STEP 5: Verify Everything

Run these checks:

1. **NotebookLM:** "List my NotebookLM notebooks"
2. **Drive:** "List files in my Google Drive Symphony/Strategy folder"
3. **Mem:** "Search my Mem notes for #symphony"
4. **Chain test:** "Read the latest file in Drive's Inbox folder, summarize
   it, save the summary to Mem with tag #symphony #inbox, and add the
   original as a source to my Symphony NotebookLM notebook"

If all four pass, the full loop is wired.

---

## Repo Links (Slim)

| Repo | URL |
|---|---|
| NotebookLM MCP (Pantheon Security) | https://github.com/Pantheon-Security/notebooklm-mcp-secure |
| Google Drive MCP | https://github.com/michaelpine25/googleDriveMCP |
| open-notebook (local fallback) | https://github.com/lfnovo/open-notebook |
| nblm Rust CLI | https://github.com/K-dash/nblm-rs |
| AHK Multi-Clipboard | https://github.com/GroggyOtter/AHK_Multi_Clipboard |
| NotebookLM Claude Integration (LobeHub) | https://github.com/ray-manaloto/notebooklm-claude-integration |
