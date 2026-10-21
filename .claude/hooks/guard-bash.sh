#!/usr/bin/env bash
# Block destructive git on Bash tool calls. Exit 2 = deny with message.
cmd=$(node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{process.stdout.write(JSON.parse(d).tool_input?.command||"")}catch{}})')
case "$cmd" in
  *"git push"*"--force"*|*"git push -f"*)
    echo "BLOCKED: force-push is not allowed in this repo (rewrites shared history)." >&2; exit 2;;
  *"git reset --hard"*)
    echo "BLOCKED: git reset --hard discards work. Use git stash or ask Ken." >&2; exit 2;;
  *"wrangler r2 bucket create"*|*"r2 bucket create"*)
    echo "BLOCKED: enabling R2 triggers Cloudflare billing prompts. Ask Ken first." >&2; exit 2;;
esac
exit 0
