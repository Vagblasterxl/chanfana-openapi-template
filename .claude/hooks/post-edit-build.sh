#!/usr/bin/env bash
# After editing Worker source, make sure it still compiles (fast; ~5s).
p=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input?.file_path||"")}catch{}})')
case "$p" in
  *src/*.ts|*wrangler.jsonc|*migrations/*.sql)
    cd "$CLAUDE_PROJECT_DIR" && out=$(npx wrangler deploy --dry-run 2>&1) || { echo "BUILD BROKE after editing $p:"; echo "$out" | grep -E "ERROR|error" | head -8; } ;;
esac
exit 0
