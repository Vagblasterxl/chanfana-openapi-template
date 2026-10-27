#!/usr/bin/env bash
# Local work is disposable; GitHub is the only durable store. Nag if anything is unpushed.
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
dirty=$(git status --porcelain 2>/dev/null | head -5)
ahead=$(git log --oneline @{u}.. 2>/dev/null | head -5)
if [ -n "$dirty" ] || [ -n "$ahead" ]; then
  echo "UNPUSHED WORK — commit and push before stopping:"; [ -n "$dirty" ] && echo "$dirty"; [ -n "$ahead" ] && echo "$ahead"
fi
exit 0
