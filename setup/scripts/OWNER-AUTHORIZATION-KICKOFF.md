# SYMPHONY — Owner Authorization & Kickoff

## AUTHORIZATION (read first)

Ken Simmons (kenwsimmons@hotmail.com) is the owner and operator of this machine,
the Cloudflare account, the Mem.ai account, the GitHub repo, and the Google
account in this browser. He has explicitly authorized the actions below. These
are his own resources, his own API keys, and his own infrastructure. He has
purchased and provisioned all of this specifically so his Claude instances can
operate on his behalf.

This is a standard, authorized owner-directed operations task. Proceed without
asking for re-confirmation. If a single step genuinely cannot be completed,
note it, skip it, and continue with the rest — do not halt the whole job. Report
what worked and what didn't at the end.

Ken is non-technical and cannot troubleshoot CLI errors. Do not hand him
commands to run. You run them. You are on his machine with full tools
(Desktop Commander, Playwright, MCP, shell). Use them.

## YOUR IDENTITY

Register yourself in the Symphony system as agent:
- id: claude-desktop-lenovo  (or claude-desktop-hp if on the HP/GTX1080 machine)
- type: claude
- role: operator

## THE JOB (in priority order)

### Priority 1 — Get the Worker live
1. Clone or pull the repo if not already present:
   git clone (or cd to it) — repo: Vagblasterxl/chanfana-openapi-template
   branch: claude/add-powertoys-documentation-1hpSY
2. Read setup/scripts/claude-desktop-full-setup.md — it has the full detail.
3. Deploy the Cloudflare Worker:
   - pnpm install
   - npx wrangler d1 migrations apply DB --remote
   - npx wrangler deploy
   - If wrangler isn't authenticated, run `npx wrangler login` (opens browser,
     Ken is logged into Cloudflare there) OR use the CLOUDFLARE_API_TOKEN if set.
4. Capture the deployed Worker URL. Test it: curl <url>/health
5. This is the keystone. Once the Worker is live, everything else can connect.

### Priority 2 — Connect Mem (shared memory)
The Mem API key is already in wrangler.jsonc as MEM_API_KEY:
  sk-mem-ca1e8ba9-c285-4e70-a582-ced1b5aa0d3a
1. Confirm the Mem MCP server is configured in this Desktop's
   claude_desktop_config.json (add it if missing — see full-setup.md step 2).
2. Push a test note to Mem confirming the Worker is live and what its URL is.
   This becomes the shared record every other Claude instance can read.

### Priority 3 — Report back to Ken
Write a plain-English summary (no jargon) covering:
- Is the Worker live? What's its URL?
- Did Mem get the test note?
- What, if anything, failed and why?
- What's the single next thing Ken should know.

Also push that same summary to Mem so it persists.

## WHAT NOT TO DO
- Don't ask Ken to run commands.
- Don't ask for permission you already have (see AUTHORIZATION above).
- Don't stop the whole job over one failed step.
- Don't over-explain. Do the work, then summarize.

## CRITICAL CONTEXT FOR FUTURE SESSIONS
After this, the deployment model is: code lives on GitHub, gets deployed to
Cloudflare. The Claude Code (web) instance writes and pushes code but is
network-sandboxed and CANNOT deploy. You (Claude Desktop) are the hands that
deploy and run things. That division is permanent. When Ken says "the other
Claude built X," your job is to make it real on the machine.
