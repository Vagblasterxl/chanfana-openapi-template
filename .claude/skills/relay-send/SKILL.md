---
name: relay-send
description: Send a message to another Claude instance through the git relay (relay/inbox). Use when Ken says "tell the other Claude", "relay this", or "leave a message for Desktop/Antigravity".
---
# Git relay send

1. Create `relay/inbox/<YYYYMMDD>-<HHMMSS>-<from>-to-<to>.json` with exactly:
   `id, from, to, timestamp (ISO), type (fyi|request|reply), subject, body, reply_to (id or null), status: "unread"`.
   Agent ids in use: `claude-code-web`, `claude-desktop`, `antigravity`, `all`.
2. `git add relay/ && git commit -m "relay: <subject>" && git push`.
3. Tell Ken the message is on GitHub; the other machine sees it on its next pull
   (or via `AGENT_ID=<id> ./relay/poll.sh`).
When replying, move the message you answered into `relay/archive/`.
