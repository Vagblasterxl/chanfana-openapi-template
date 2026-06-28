# FULL SETUP — Paste this entire block into Claude Desktop

You are setting up the complete Symphony system for Ken. Execute every step
in order. Do not ask questions. Do not stop. Report results at the end.

---

## 1. DEPLOY THE CLOUDFLARE WORKER

```bash
cd ~/chanfana-openapi-template
git pull origin claude/add-powertoys-documentation-1hpSY
git checkout claude/add-powertoys-documentation-1hpSY
pnpm install
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

After deploy, note the Worker URL (looks like: https://chanfana-openapi-template.YOUR_SUBDOMAIN.workers.dev).

Test it:
```bash
curl https://chanfana-openapi-template.YOUR_SUBDOMAIN.workers.dev/health
```

Should return JSON with `"success": true`.

---

## 2. CONFIGURE MEM MCP SERVER

Add this to Claude Desktop's MCP config (claude_desktop_config.json):

```json
{
  "mcpServers": {
    "mem": {
      "command": "npx",
      "args": ["-y", "@mem-ai/mcp-server"],
      "env": {
        "MEM_API_KEY": "<paste the MEM_API_KEY Ken provides — never commit it>"
      }
    }
  }
}
```

If there's already an mcpServers section, merge the "mem" entry into it.
The config file is at:
- Windows: %APPDATA%\Claude\claude_desktop_config.json
- Mac: ~/Library/Application Support/Claude/claude_desktop_config.json

After adding, restart Claude Desktop.

---

## 3. SET UP GEMINI SPARK (via Playwright)

Open Chrome (where Ken is logged into Google) and execute these steps:

### 3a. Navigate to Spark Skills
Go to: https://gemini.google.com/app

Find the Spark section. Create three Skills:

**Skill 1 — "Symphony Status Reporter":**
```
You are a Symphony coordination assistant. Check the Symphony API and my Gmail for [SYMPHONY] emails and summarize them. Log any knowledge as Subject-Verb-Object triples to a Google Sheet called "Symphony Knowledge Graph" with columns: timestamp, subject, verb, object, context, source. Controlled verbs: generated, derived, composed, created, updated, approved, published, archived, requested, delegated, received, references, supersedes, extends.
```

**Skill 2 — "Symphony Email Relay":**
```
You bridge email communication with the Symphony multi-agent system. When processing [SYMPHONY] emails: extract sender, subject, structured data. Summarize as: From, To (target agent), Action, Priority, Data. When composing relay emails use subject line: [SYMPHONY] {action} - {target}. Always CC kenwsimmons@hotmail.com. Never auto-send unless schedule says so.
```

**Skill 3 — "Knowledge Logger":**
```
You track knowledge for Symphony. Extract Subject-Verb-Object triples from emails, events, and docs. Use ONLY these verbs: generated, derived, composed, transcribed, narrated, created, updated, approved, published, archived, requested, delegated, received, acknowledged, references, cites, contradicts, supersedes, extends. Log to Google Sheet "Symphony Knowledge Graph" with columns: timestamp, subject, verb, object, context, source. Tag with #symphony #svo.
```

### 3b. Create Scheduled Tasks
Still in Spark, create these scheduled tasks:

**Task 1 — Daily Brief (8 AM daily):**
```
Scan my Gmail for emails with [SYMPHONY] in the subject from the last 24 hours. Summarize them and save as a draft email with subject "[SYMPHONY] Daily Brief - today's date". Log any knowledge triples to the Symphony Knowledge Graph sheet.
```

**Task 2 — Email Trigger (when [SYMPHONY] email arrives):**
```
Process this email immediately. Extract who it's from, what they want, and draft a reply. Log knowledge triples to Symphony Knowledge Graph sheet. Don't send — save as draft.
```

### 3c. Create Google Contacts
Go to: https://contacts.google.com

Create these contacts:
- Name: "Claude Opus" — Notes: "Symphony agent: claude-opus, role: orchestrator"
- Name: "Claude Sonnet" — Notes: "Symphony agent: claude-sonnet, role: researcher"  
- Name: "Symphony Bot" — Notes: "Symphony agent: discord-bot-1, role: community"

### 3d. Create Gmail Filter
Go to: https://mail.google.com/mail/u/0/#settings/filters

Create filter:
- Has the words: subject:([SYMPHONY])
- Action: Apply label "Symphony", Never send to spam

### 3e. Create Google Sheet
Go to: https://sheets.google.com

Create new spreadsheet named: "Symphony Knowledge Graph"
- Tab 1 "Triples": headers = timestamp | subject | verb | object | context | source
- Tab 2 "Weekly Digest": headers = week_ending | triple_count | top_subjects | top_verbs | notes

---

## 4. VERIFY EVERYTHING WORKS

### Test the Worker API:
```bash
# Health check
curl https://chanfana-openapi-template.YOUR_SUBDOMAIN.workers.dev/health

# Register yourself as an agent
curl -X POST https://chanfana-openapi-template.YOUR_SUBDOMAIN.workers.dev/agents/register \
  -H "Authorization: Bearer symphony-ken-2026" \
  -H "Content-Type: application/json" \
  -d '{"id": "claude-desktop-1", "name": "Claude Desktop (Lenovo)", "type": "claude"}'

# Push a test note to Mem
curl -X POST https://chanfana-openapi-template.YOUR_SUBDOMAIN.workers.dev/mem/note \
  -H "Authorization: Bearer symphony-ken-2026" \
  -H "Content-Type: application/json" \
  -d '{"content": "# Symphony Setup Complete\n\nWorker deployed, Mem connected, Spark configured.\n\n#symphony #setup", "agent_id": "claude-desktop-1"}'
```

### Test Mem directly:
Use the Mem MCP to create a note:
"Symphony system fully operational. Worker deployed, Spark running, Mem connected. All Claudes share memory now."

### Test Spark:
Ask Spark: "What Symphony skills do you have?"

---

## 5. REPORT BACK TO KEN

Summarize:
- Worker URL: [the deployed URL]
- Worker status: [healthy/error]
- Mem MCP: [configured/error]
- Spark Skills: [3 created / any errors]
- Spark Schedules: [2 created / any errors]
- Contacts: [3 created / any errors]
- Gmail filter: [created / error]
- Google Sheet: [created / error]
- Test Mem note: [sent / error]

If anything failed, explain what and why.
