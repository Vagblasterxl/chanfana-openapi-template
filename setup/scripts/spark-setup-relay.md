# SYMPHONY RELAY — Gemini Spark Automated Setup

## FOR: Claude Desktop instance with Desktop Commander + Playwright

You are setting up Gemini Spark, CC, and Contacts integration for Ken's
Symphony coordination system. Ken is on Google AI Ultra and is already
logged into Google in Chrome.

Do everything below in order. Ken should not have to touch anything.

---

## STEP 1: Enable Gemini Contacts Integration

1. Open Chrome to: https://gemini.google.com/app/settings/connected-apps
2. Find "Google Contacts" in the list
3. If not already enabled, click to enable it
4. Confirm any permission prompts

## STEP 2: Create Spark Skills

Navigate to: https://gemini.google.com/app/spark/skills

### Skill 1: Symphony Status Reporter

Click "Create Skill" (or "+" button), set:
- **Name**: Symphony Status Reporter
- **Instructions**:

```
You are a Symphony coordination assistant. Your job is to check
the Symphony coordination API and report status.

When asked to check Symphony status:
1. The Symphony API health endpoint is: GET /health (no auth needed)
2. For authenticated endpoints, use header: Authorization: Bearer symphony-ken-2026

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

If the API is unreachable, say so and suggest checking the Cloudflare dashboard.

NOTE: The Worker URL will be provided once deployed. Until then, skip the API
check and report "Worker not yet deployed — Google-side automation active."
```

Save the skill.

### Skill 2: Symphony Email Relay

Click "Create Skill", set:
- **Name**: Symphony Email Relay
- **Instructions**:

```
You are a Symphony email relay. You bridge email communication with the
Symphony multi-agent coordination system.

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

Save the skill.

### Skill 3: Knowledge Logger

Click "Create Skill", set:
- **Name**: Symphony Knowledge Logger
- **Instructions**:

```
You track knowledge and relationships for the Symphony creative studio.

When you learn something new from an email, calendar event, or Drive document,
extract it as Subject-Verb-Object triples.

Controlled verbs (use ONLY these):
  generated, derived, composed, transcribed, narrated,
  created, updated, approved, published, archived,
  requested, delegated, received, acknowledged,
  references, cites, contradicts, supersedes, extends

Examples:
  "Ken created audiobook-pipeline"
  "claude-opus generated img-20260218-001"
  "discord-bot-1 received command from Ken"

Log triples to a Google Sheet called "Symphony Knowledge Graph" with columns:
  timestamp | subject | verb | object | context | source

This sheet is the offline mirror of the Symphony knowledge_triples D1 table
and can be synced later via the POST /knowledge/extract API endpoint.
```

Save the skill.

## STEP 3: Create Spark Schedules

Navigate to: https://gemini.google.com/app/spark/tasks
(or use the Spark Tasks interface)

### Schedule 1: Morning Symphony Brief

Create a new task:
- **Description**: "Every day at 8:00 AM, scan my Gmail for any emails with [SYMPHONY] in the subject from the last 24 hours. Also check CC's daily brief for anything related to creative projects, media production, or AI coordination. Compile a brief with: (1) New Symphony emails received, (2) Any action items from CC's daily brief that relate to the creative studio, (3) Suggested priorities for today. Save the brief as a Gmail draft with subject '[SYMPHONY] Daily Brief - {today's date}'."
- **Schedule**: Every day at 8:00 AM
- **Skills**: Symphony Status Reporter, Symphony Email Relay

### Schedule 2: Heartbeat Monitor

Create a new task:
- **Description**: "Every 4 hours, check my Gmail for any new [SYMPHONY] tagged emails. If there are any unread ones, process them using the Symphony Email Relay skill and log any knowledge triples using the Knowledge Logger skill. If no new emails, do nothing."
- **Schedule**: Every 4 hours
- **Skills**: Symphony Email Relay, Symphony Knowledge Logger

### Schedule 3: Weekly Knowledge Sync

Create a new task:
- **Description**: "Every Sunday at 10:00 PM, review the 'Symphony Knowledge Graph' Google Sheet. Summarize: (1) Total triples logged this week, (2) Most active subjects (which entities appear most), (3) Most common verbs (what actions are happening most), (4) Any contradictions found. Add the summary as a new row in a 'Weekly Digest' tab of the same sheet."
- **Schedule**: Every Sunday at 10:00 PM
- **Skills**: Symphony Knowledge Logger

### Schedule 4: Email-Triggered Relay

Create a new task:
- **Description**: "When I receive an email with [SYMPHONY] in the subject, process it immediately: (1) Extract structured content using the Symphony Email Relay skill, (2) Log any knowledge triples to the Symphony Knowledge Graph sheet, (3) If the email contains a task assignment, create a Google Calendar event for it, (4) Draft a confirmation reply but do not send — save as draft for Ken to review."
- **Schedule**: When an email arrives with "[SYMPHONY]" in the subject
- **Skills**: Symphony Email Relay, Symphony Knowledge Logger

## STEP 4: Create Google Contacts for Agents

Navigate to: https://contacts.google.com

Create these contacts (or update existing ones):

### Contact 1
- **Name**: Claude Opus (Kindlewright)
- **Email**: (leave blank or use a placeholder)
- **Notes**: Symphony agent: claude-opus, role: orchestrator, type: claude, clan: Opus - The Kindlewright

### Contact 2
- **Name**: Claude Sonnet
- **Email**: (leave blank or use a placeholder)
- **Notes**: Symphony agent: claude-sonnet, role: researcher, type: claude

### Contact 3
- **Name**: Symphony Discord Bot
- **Email**: (leave blank or use a placeholder)
- **Notes**: Symphony agent: discord-bot-1, role: community, type: discord-bot

### Contact 4
- **Name**: Symphony Worker
- **Email**: (leave blank or use a placeholder)
- **Notes**: Symphony agent: worker-1, role: backend, type: worker, url: pending-deployment

## STEP 5: Create Gmail Filters

Navigate to: https://mail.google.com/mail/u/0/#settings/filters

Create these filters:

### Filter 1
- **Has the words**: subject:([SYMPHONY])
- **Action**: Apply label "Symphony", Never send to spam

### Filter 2
- **Has the words**: subject:(Daily Brief) from:(spark OR gemini OR cc)
- **Action**: Apply label "Symphony/Briefs"

## STEP 6: Create Google Sheets Dashboard

Navigate to: https://sheets.google.com

### Sheet 1: "Symphony Knowledge Graph"

Create a new spreadsheet named "Symphony Knowledge Graph"

**Tab 1: "Triples"** — Add headers in row 1:
| timestamp | subject | verb | object | context | source |

**Tab 2: "Weekly Digest"** — Add headers in row 1:
| week_ending | triple_count | top_subjects | top_verbs | contradictions | notes |

### Sheet 2: "Symphony Dashboard"

Create a new spreadsheet named "Symphony Dashboard"

**Tab 1: "Agent Status"** — Add headers and seed data:
| agent_id | name | type | status | last_seen | role | notes |
| claude-opus | Opus (Kindlewright) | claude | online | | orchestrator | |
| claude-sonnet | Sonnet | claude | online | | researcher | |
| discord-bot-1 | Discord Bot | discord-bot | offline | | community | |
| worker-1 | Symphony Worker | worker | pending | | backend | needs deployment |

**Tab 2: "Message Log"** — Add headers:
| timestamp | from | to | type | summary | status |

**Tab 3: "Action Items"** — Add headers:
| timestamp | source | action | assigned_to | priority | status |

## STEP 7: Verify Setup

1. Go back to https://gemini.google.com/app/spark
2. Verify all 3 skills appear in the Skills list
3. Verify all 4 schedules appear and are active
4. Ask Spark: "What Symphony skills do you have?"
5. Ask Spark: "Look up Claude Opus in my contacts"
6. Both should return correct results

## DONE

Report back to Ken:
- Number of Skills created
- Number of Schedules created
- Number of Contacts added
- Sheets created
- Gmail filters created
- Any errors encountered

The Symphony Spark integration is now running 24/7.
Ken can email himself with [SYMPHONY] in the subject to trigger
the relay, or just let the schedules run automatically.
