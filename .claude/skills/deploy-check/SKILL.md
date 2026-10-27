---
name: deploy-check
description: Full pre-deploy gate for the Worker — strict install, tests, dry-run build, secret scan, and PR state. Run before any deploy or when Ken asks "are we good".
disable-model-invocation: true
---
# Deploy gate

Run in order; stop at the first failure and report it plainly.

1. `npm ci` — strict install from the lockfile.
2. `npm test` — must end with `Tests  N passed (N)` and `--dry-run: exiting now.`
3. Secret scan: `git ls-files | xargs grep -lE "sk-mem-[0-9a-f]{8}|sk-ant-|ghp_[A-Za-z0-9]{20}" ; test $? -ne 0`
   (a match = a leaked key; stop).
4. Config sanity: `grep -n database_id wrangler.jsonc` must show
   `d7b93547-6fba-4766-afb3-7e39e6e36219` (or the ID Ken has since chosen) and
   `r2_buckets` must be commented out.
5. `gh pr view 3 --json mergeable,mergeStateStatus` (or the current PR).
6. Report: three lines — build, tests, what (if anything) blocks deploy.
Deploying itself needs a wrangler-authenticated machine or the Cloudflare
dashboard; see `setup/runbooks/CLOUDFLARE-ATTACH.md`.
