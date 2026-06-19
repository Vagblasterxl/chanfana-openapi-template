#!/usr/bin/env bash
# Claude <-> Claude git relay poller.
# Pulls the repo on an interval and surfaces unread messages for this agent.
#
# Usage:
#   AGENT_ID=claude-code-hp ./relay/poll.sh [interval_seconds]
#
# Default interval: 120s (the "every two minutes they tag-team" cadence).

set -euo pipefail

AGENT_ID="${AGENT_ID:-unknown-agent}"
INTERVAL="${1:-120}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
INBOX="$REPO_ROOT/relay/inbox"

echo "[relay] polling as agent: $AGENT_ID every ${INTERVAL}s"
echo "[relay] inbox: $INBOX"
echo "[relay] Ctrl+C to stop."

mkdir -p "$INBOX"

while true; do
  # Pull latest (quiet, tolerate no-op)
  git -C "$REPO_ROOT" pull --quiet origin "$(git -C "$REPO_ROOT" rev-parse --abbrev-ref HEAD)" 2>/dev/null || true

  found=0
  for f in "$INBOX"/*.json; do
    [ -e "$f" ] || continue
    # Match messages addressed to this agent and still unread
    to=$(grep -o '"to"[[:space:]]*:[[:space:]]*"[^"]*"' "$f" | head -1 | sed 's/.*"to"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    status=$(grep -o '"status"[[:space:]]*:[[:space:]]*"[^"]*"' "$f" | head -1 | sed 's/.*"status"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    if { [ "$to" = "$AGENT_ID" ] || [ "$to" = "all" ]; } && [ "$status" = "unread" ]; then
      echo ""
      echo "=== [relay] NEW MESSAGE for $AGENT_ID: $(basename "$f") ==="
      cat "$f"
      echo ""
      echo "=== respond by writing a reply into relay/inbox/ and pushing ==="
      found=1
    fi
  done

  if [ "$found" -eq 0 ]; then
    echo "[relay] $(date '+%H:%M:%S') — no new messages for $AGENT_ID"
  fi

  sleep "$INTERVAL"
done
