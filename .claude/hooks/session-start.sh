#!/usr/bin/env bash
# Container resets wipe node_modules; restore silently so builds/tests work.
cd "$CLAUDE_PROJECT_DIR" 2>/dev/null || exit 0
if [ ! -d node_modules ]; then
  echo "node_modules missing — running npm ci" >&2
  npm ci --no-audit --no-fund >/dev/null 2>&1 || echo "npm ci failed; run it manually" >&2
fi
exit 0
