# Symphony ↔ Gemini Spark Integration Guide

## Overview

This guide connects your Symphony coordination backend (Cloudflare Worker)
with Google Gemini Spark + CC + Contacts to create a fully autonomous
coordination loop that runs 24/7 even when you're away.

**Stack**: Gemini Spark (agent) + CC (daily briefer) + Contacts (people graph)
**Tier required**: Google AI Ultra ($100/mo) — you have this

---

## Architecture

```
                    GOOGLE ECOSYSTEM                      SYMPHONY BACKEND
                    ────────────────                      ────────────────
                    
  CC (Daily Brief)                                    Cloudflare Worker
       │                                                    │
       ▼                                              D1 Database
  Gmail Inbox  ◄──── Spark Agent ────►  Worker API    ├── agents
       │               │    │           (via email     ├── messages
       ▼               ▼    ▼            relay)        ├── coordination_state
  Calendar      Contacts  Sheets                      ├── knowledge_triples
                                                      └── assets
  
  Spark checks inbox → finds coordination emails → acts on them
  Spark writes results back to Gmail / Sheets / Calendar
```

---

## Step 1: Set Up CC (Your Intelligence Sensor)

CC is already available. Go to: https://gemini.google.com/app (or Google Labs)

1. Enable CC from Google Labs
2. CC will start sending daily briefing emails to your Gmail each morning
3. These briefs summarize your inbox, calendar, and Drive activity

**Why this matters**: CC acts as the "sensor" — it surfaces what happened
while you were away. Spark can then act on CC's findings.

---

## Step 2: Connect Contacts (Your People Graph)

Go to: Gemini → Settings → Personal Intelligence → Connected Apps

1. Enable "Google Contacts" integration
2. This lets Spark look up people by name, email, or phone
3. Add key contacts with notes in the "Notes" field:
   - Claude Opus: notes = "Symphony agent: claude-opus, role: orchestrator"
   - Claude Sonnet: notes = "Symphony agent: claude-sonnet, role: researcher"
   - Discord Bot: notes = "Symphony agent: discord-bot-1, role: community"

**Why this matters**: Spark can now resolve "who is handling the audiobook?"
by looking up contacts tagged with Symphony agent roles.

---

## Step 3: Create Spark Skills

### Skill 1: Symphony Status Reporter

**Name**: Symphony Status Report
**Instructions to paste into Spark Skills**:

```
You are a Symphony coordination assistant. Your job is to check
the Symphony coordination API and report status.

When asked to check Symphony status:
1. Note that the Symphony API is at: https://chanfana-openapi-template.<your-subdomain>.workers.dev
2. The health endpoint is: GET /health (no auth needed)
3. For authenticated endpoints, use header: Authorization: Bearer symphony-ken-2026

Key endpoints to check:
- GET /health → agent count + timestamp
- GET /agents → list all registered agents (needs auth)
- GET /messages → list recent messages (needs auth)
- GET /state → coordination state objects (needs auth)
- GET /knowledge/query → search knowledge triples (needs auth)

Format your status report as:
- Service: [up/down]
- Active agents: [count and names]
- Pending messages: [count]
- Last activity: [timestamp]
- Knowledge triples: [count]

If the API is unreachable, say so and suggest checking the
Cloudflare dashboard.
```

### Skill 2: Symphony Email Relay

**Name**: Symphony Email Relay
**Instructions to paste into Spark Skills**:

```
You are a Symphony email relay. You bridge email communication
with the Symphony multi-agent coordination system.

When processing Symphony-tagged emails:
1. Extract the sender, subject, and any structured data (JSON blocks)
2. Identify which Symphony agent the message is for using Google Contacts
   (look for contacts with "Symphony agent:" in their notes)
3. Summarize the message in structured format:
   - From: [sender]
   - To: [target agent]
   - Action: [what's being requested]
   - Priority: [high/medium/low based on urgency words]
   - Data: [any JSON or structured content]

When composing Symphony relay emails:
- Subject line: [SYMPHONY] {action} - {target}
- Body: structured summary with clear action items
- CC: kenwsimmons@hotmail.com (always keep Ken in the loop)

Never send emails without Ken's approval unless the schedule
explicitly says "auto-send: true".
```

### Skill 3: Knowledge Logger

**Name**: Symphony Knowledge Logger
**Instructions to paste into Spark Skills**:

```
You track knowledge and relationships for the Symphony creative studio.

When you learn something new from an email, calendar event, or
Drive document, extract it as Subject-Verb-Object triples:

Controlled verbs (use ONLY these):
  generated, derived, composed, transcribed, narrated,
  created, updated, approved, published, archived,
  requested, delegated, received, acknowledged,
  references, cites, contradicts, supersedes, extends

Examples:
  "Ken created audiobook-pipeline"
  "claude-opus generated img-20260218-001"
  "discord-bot-1 received command from Ken"

Log triples to a Google Sheet called "Symphony Knowledge Graph"
with columns: timestamp, subject, verb, object, context, source

This sheet is the offline mirror of the Symphony knowledge_triples
D1 table and can be synced later.
```

---

## Step 4: Create Spark Schedules

### Schedule 1: Morning Symphony Brief

**When**: Every day at 8:00 AM
**Task**: "Check the Symphony coordination API health endpoint.
Then scan my Gmail for any emails with [SYMPHONY] in the subject
from the last 24 hours. Compile a brief with:
1. API status (up/down, agent count)
2. New Symphony emails received
3. Any action items from CC's daily brief that relate to the
   creative studio
4. Suggested priorities for today
Send me the brief as a Gmail draft (don't auto-send)."
**Skills**: Symphony Status Reporter, Symphony Email Relay

### Schedule 2: Agent Heartbeat Monitor

**When**: Every 4 hours
**Task**: "Check the Symphony API /health endpoint. If the agent
count has changed since last check, or if the service appears down,
send me a notification email with subject '[SYMPHONY ALERT] Agent
status change'. Include what changed and when."
**Skills**: Symphony Status Reporter

### Schedule 3: Weekly Knowledge Sync

**When**: Every Sunday at 10:00 PM
**Task**: "Review the 'Symphony Knowledge Graph' Google Sheet.
Summarize:
1. Total triples logged this week
2. Most active subjects (which entities appear most)
3. Most common verbs (what actions are happening most)
4. Any contradictions found (two triples that conflict)
Save the summary as a new row in a 'Weekly Digest' tab."
**Skills**: Symphony Knowledge Logger

### Schedule 4: Email-Triggered Relay (Event-Based)

**When**: When I receive an email with "[SYMPHONY]" in the subject
**Task**: "Process this Symphony relay email immediately:
1. Extract structured content using the Symphony Email Relay skill
2. Log any knowledge triples to the Symphony Knowledge Graph sheet
3. If the email contains a task assignment, create a Google Calendar
   event for it with the target agent name in the description
4. Draft a confirmation reply (don't auto-send)"
**Skills**: Symphony Email Relay, Symphony Knowledge Logger

---

## Step 5: Gmail Labels & Filters

Create these Gmail filters to organize Symphony traffic:

**Filter 1**: Subject contains "[SYMPHONY]" → Apply label "Symphony"
**Filter 2**: From contains "spark" AND subject contains "brief" → Apply label "Symphony/Briefs"
**Filter 3**: From contains "cc@" → Apply label "Symphony/CC"

---

## Step 6: Google Sheets Dashboard

Create a Google Sheet called **"Symphony Dashboard"** with these tabs:

### Tab 1: Agent Status
| Agent ID | Name | Type | Status | Last Seen | Notes |
|----------|------|------|--------|-----------|-------|
| claude-opus | Opus (Kindlewright) | claude | online | | orchestrator |
| claude-sonnet | Sonnet | claude | online | | researcher |
| discord-bot-1 | Discord Bot | discord-bot | offline | | community |

### Tab 2: Message Log
| Timestamp | From | To | Type | Summary | Status |

### Tab 3: Knowledge Graph
| Timestamp | Subject | Verb | Object | Context | Source |

### Tab 4: Weekly Digest
| Week | Triple Count | Top Subjects | Top Verbs | Contradictions | Notes |

---

## How It All Works Together

```
                    AUTOMATED FLOW (runs while Ken sleeps)
                    ──────────────────────────────────────

  8:00 AM ──► CC sends daily brief email
              │
              ▼
         Spark reads CC brief + inbox
              │
              ├──► Checks Symphony /health API
              ├──► Scans for [SYMPHONY] emails
              ├──► Looks up agent contacts via Contacts
              │
              ▼
         Spark drafts "Morning Symphony Brief" email
              │
              ▼
         Spark logs knowledge triples to Google Sheet
              │
              ▼
         Every 4 hours: heartbeat check
              │
              ▼
         Event-triggered: [SYMPHONY] emails processed immediately
              │
              ▼
         Sunday: weekly knowledge sync digest

  Ken wakes up → reads brief → approves/adjusts drafts → done
```

---

## Usage Tips

**To send a command to Symphony via Spark**:
Email yourself with subject `[SYMPHONY] <command>` and Spark will
pick it up on the next event trigger.

**To check status anytime**:
Ask Spark: "What's the Symphony status?" — it'll use the Status
Reporter skill to check the API.

**To add a knowledge triple**:
Ask Spark: "Log that claude-opus generated img-20260607-001"
— it'll add it to the Google Sheet.

**To find a person's agent role**:
Ask Spark: "What Symphony agent is Claude Opus?" — it'll look
up the contact and return the role from the notes field.

---

## What Ken Needs To Do (One-Time Setup)

1. ✅ Already done: AI Ultra subscription
2. □ Enable CC in Google Labs (if not already)
3. □ Enable Contacts in Gemini Connected Apps
4. □ Create the 3 Skills above (copy-paste into Spark)
5. □ Create the 4 Schedules above
6. □ Create Gmail filters for [SYMPHONY] label
7. □ Create "Symphony Dashboard" Google Sheet
8. □ Add agent contacts to Google Contacts with notes
9. □ Deploy the Worker: `npx wrangler d1 migrations apply DB --remote && npx wrangler deploy`

Once deployed, give Spark the actual Worker URL to replace the
placeholder in the Status Reporter skill.
