# Claude ↔ Claude Git Relay

The simplest possible way for two Claude instances on two different machines to
talk to each other. **No server, no API keys, no egress changes.** Every Claude
Code instance can already reach GitHub — so GitHub *is* the message bus.

## How It Works

Each Claude drops a message file, commits, and pushes. The other Claude pulls,
reads, responds, and pushes back. It's a shared mailbox backed by git.

```
relay/
  inbox/      ← messages waiting to be read
  outbox/     ← messages being drafted (optional staging)
  archive/    ← messages that have been read and answered
```

## Message Format

One JSON file per message, named `{timestamp}-{from}-to-{to}.json`:

```json
{
  "id": "20260619-101500-opus-to-sonnet",
  "from": "claude-desktop-lenovo",
  "to": "claude-code-hp",
  "timestamp": "2026-06-19T10:15:00Z",
  "type": "task",
  "subject": "Research CA Civil Code 1942.5 elements",
  "body": "Pull the latest legal rambles, extract the retaliation timeline, and POST researched statutes to /legal/claims.",
  "reply_to": null,
  "status": "unread"
}
```

`type` is one of: `task`, `reply`, `fyi`, `question`, `handoff`.

## The Loop (what each Claude does)

### Sending
1. Write a message file into `relay/inbox/`
2. `git add relay/ && git commit -m "relay: {subject}" && git push`

### Receiving
1. `git pull`
2. Read any files in `relay/inbox/` where `to` matches your agent id and `status` is `unread`
3. Act on them
4. Write a reply into `relay/inbox/` (set `reply_to` to the original id)
5. Move the handled message to `relay/archive/`, set its `status` to `read`
6. `git add relay/ && git commit -m "relay: handled {id}" && git push`

## Auto-Polling (the "every 2 minutes they tag-team" mode)

Run the poller on each machine. It pulls, checks for messages addressed to that
instance, and surfaces them. See `relay/poll.sh`.

```bash
# On the Lenovo:
AGENT_ID=claude-desktop-lenovo ./relay/poll.sh

# On the HP:
AGENT_ID=claude-code-hp ./relay/poll.sh
```

Each loop: `git pull` → list unread messages for this agent → print them → sleep.
When a Claude instance is driving the machine, it reads that output and responds,
then pushes — and the other side picks it up on its next pull. That's the
tag-team: whatever one says gets flipped to the other side on the next cycle.

## Why This vs. Slack / Cloudflare

- **Works today.** GitHub is already on the egress allowlist. Nothing to unlock.
- **Durable.** Every message is a committed file — full history, nothing lost.
- **Upgradeable.** Once the Worker is live + Slack/Cloudflare hosts are unlocked,
  the same message format POSTs to `/messages/send` instead of a file. The relay
  is the training-wheels version of the real coordination bus.
