# OpenAPI Template

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/cloudflare/templates/tree/main/chanfana-openapi-template)

![OpenAPI Template Preview](https://imagedelivery.net/wSMYJvS3Xw-n339CbDyDIA/91076b39-1f5b-46f6-7f14-536a6f183000/public)

<!-- dash-content-start -->

This is a Cloudflare Worker with OpenAPI 3.1 Auto Generation and Validation using [chanfana](https://github.com/cloudflare/chanfana) and [Hono](https://github.com/honojs/hono).

This is an example project made to be used as a quick start into building OpenAPI compliant Workers that generates the
`openapi.json` schema automatically from code and validates the incoming request to the defined parameters or request body.

This template includes various endpoints, a D1 database, and integration tests using [Vitest](https://vitest.dev/) as examples. In endpoints, you will find [chanfana D1 AutoEndpoints](https://chanfana.com/endpoints/auto/d1) and a [normal endpoint](https://chanfana.com/endpoints/defining-endpoints) to serve as examples for your projects.

Besides being able to see the OpenAPI schema (openapi.json) in the browser, you can also extract the schema locally no hassle by running this command `npm run schema`.

<!-- dash-content-end -->

> [!IMPORTANT]
> When using C3 to create this project, select "no" when it asks if you want to deploy. You need to follow this project's [setup steps](https://github.com/cloudflare/templates/tree/main/openapi-template#setup-steps) before deploying.

## Getting Started

Outside of this repo, you can start a new project with this template using [C3](https://developers.cloudflare.com/pages/get-started/c3/) (the `create-cloudflare` CLI):

```bash
npm create cloudflare@latest -- --template=cloudflare/templates/openapi-template
```

A live public deployment of this template is available at [https://openapi-template.templates.workers.dev](https://openapi-template.templates.workers.dev)

## Setup Steps

1. Install the project dependencies with a package manager of your choice:
   ```bash
   npm install
   ```
2. Create a [D1 database](https://developers.cloudflare.com/d1/get-started/) with the name "openapi-template-db":
   ```bash
   npx wrangler d1 create openapi-template-db
   ```
   ...and update the `database_id` field in `wrangler.json` with the new database ID.
3. Run the following db migration to initialize the database (notice the `migrations` directory in this project):
   ```bash
   npx wrangler d1 migrations apply DB --remote
   ```
4. Deploy the project!
   ```bash
   npx wrangler deploy
   ```
5. Monitor your worker
   ```bash
   npx wrangler tail
   ```

## Polar webhooks and entitlements

`POST /polar/webhook` ingests [Polar](https://polar.sh) deliveries and turns
subscriptions into capability flags the rest of the system can authorize
against.

### Required configuration

The endpoint needs the webhook signing secret from Polar:

```bash
npx wrangler secret put POLAR_WEBHOOK_SECRET
```

For local development, copy `.dev.vars.example` to `.dev.vars` and fill it in.

**While `POLAR_WEBHOOK_SECRET` is unset, every delivery is rejected with `503`.**
There is no unverified fallback path: an endpoint that accepts unsigned webhooks
lets anyone who knows the URL mint entitlements, so an unconfigured secret is
treated as an outage rather than as permission to skip the check.

Verification follows the Standard Webhooks scheme — HMAC-SHA256 over
`{webhook-id}.{webhook-timestamp}.{rawBody}`, a five-minute timestamp tolerance,
and every `v1,` entry in `webhook-signature` accepted so secret rotation does not
drop deliveries. Both of Polar's key derivations are tried (the literal-secret
bytes used by secrets issued before 2026-09-08, and the spec's
base64-decoded `whsec_` remainder used after it), matching what Polar's own SDKs
do.

### How capabilities are resolved

For each `subscription.*` event, in order:

1. the product's `feature_flag` benefits, each carrying its flag name in
   `metadata.cap`. This is Polar's own entitlement mechanism, so granting a
   capability is attaching a benefit — nothing else has to be edited. Benefits
   of other types (licence keys, config payloads) are ignored.
2. the `polar_product_capabilities` table, for deliveries whose payload omits
   `product.benefits`, so a thin webhook body still resolves.
3. nothing. An unrecognised product is recorded as a seat with no capabilities;
   it is never elevated by default.

Only `active` and `trialing` subscriptions grant capabilities. `past_due`,
`unpaid`, `paused`, and `canceled` keep their row for audit but hold an empty
set, so a lapsed subscription cannot exercise a privileged flag.

Deliveries are de-duplicated on `webhook-id`, and an entitlement row refuses to
move backwards in time, so a Polar retry that arrives after a newer event cannot
resurrect stale state.

### Reading entitlements

| Route | Purpose |
| --- | --- |
| `GET /polar/entitlements` | List rows; filter by `customer`, `product_id`, `active`. |
| `GET /polar/entitlements/{customer}` | Union of capability flags across a customer's granting subscriptions — the answer an authorization check needs. Accepts a Polar customer id or an external customer id. |

## Discord slash commands

`POST /discord/interactions` is a Discord [interactions
endpoint](https://discord.com/developers/docs/interactions/receiving-and-responding).
It turns `/omega` slash commands into messages on the `comms_messages` bus the
agents already read, and authorizes each one against the Polar entitlements
above.

Interactions was the only workable ingress: a Discord *webhook* posts **into**
Discord and cannot receive anything, and a bot gateway needs a persistent
WebSocket a Worker cannot hold. Interactions is plain request/response.

### Required configuration

```bash
npx wrangler secret put DISCORD_PUBLIC_KEY     # application → General Information
npx wrangler secret put DISCORD_OPERATOR_IDS   # comma-separated Discord user ids
```

**While `DISCORD_PUBLIC_KEY` is unset, every interaction is rejected with
`503`.** Verification is Ed25519 over `{x-signature-timestamp}{rawBody}`, with a
five-minute timestamp tolerance. There is no unverified path — and Discord will
not accept an interactions URL at all until the endpoint answers a deliberately
mis-signed probe with a non-2xx.

Discord retries an interaction it got no response to within three seconds, so
each interaction id is claimed in `discord_interactions` before the command
runs. A lost reply therefore cannot turn one `/omega send` into two bus rows.

### Registering the commands

Discord learns the command tree from its API, not from this endpoint.
`GET /discord/commands` serves the definitions from the same module the
dispatcher implements, so the registered surface cannot drift from the handled
one (a test asserts it):

```bash
curl -s https://<worker>/discord/commands > commands.json
curl -X PUT \
  -H "Authorization: Bot $DISCORD_BOT_TOKEN" \
  -H "Content-Type: application/json" \
  -d @commands.json \
  "https://discord.com/api/v10/applications/$DISCORD_APPLICATION_ID/commands"
```

### Authorization

```
Discord user id  ->  discord_identities  ->  Polar customer  ->  capabilities
```

A Discord user id proves only who is typing. What they may *do* comes from the
Polar subscription their binding points at — the same source the rest of the
mesh authorizes against — so cancelling a subscription in Polar revokes their
Discord commands with nothing else to remember to turn off. An unbound account
holds no capabilities, which is the intended default for everyone who merely
happens to be in the guild.

| Command | Requires |
| --- | --- |
| `/omega status` | nothing |
| `/omega whoami` | nothing |
| `/omega send recipient message [type]` | `comms.send` |
| `/omega inbox [recipient] [limit]` | `comms.send` |
| `/omega ack id` | `comms.send`, and the message must be addressed to your agent |
| `/omega bind agent [customer] [user] [username]` | an id in `DISCORD_OPERATOR_IDS`, or `registry.admin` |

`DISCORD_OPERATOR_IDS` grants exactly one command. It exists because before any
binding exists nobody can hold `registry.admin`, so nobody could create the
first binding; it is a Worker secret, so the list is not forgeable from Discord.

`/omega ack` is scoped to the caller's own agent. Bus ids are guessable
integers, and the reply does not distinguish "no such message" from "addressed
to someone else", so the command cannot be used to silence or enumerate another
agent's queue.

### Bus payload

`/omega send` writes the shape the existing `discord-relay` consumers already
read — `text`, `from`, `channel_id`, `via: "discord-relay"` — and adds the
provenance a hand-rolled relay had no way to carry: `discord_user_id`,
`discord_username`, `guild_id`, `interaction_id`.

The `comms_messages` column list in migration `0003` mirrors the live
`polar-mcp` Worker byte for byte, so this implementation can be pointed at that
same D1 database without a schema divergence.

`classification` is left `NULL` here. The other Worker fills it from a Workers
AI call, which this path deliberately does not make: Discord's response deadline
is three seconds, and a model call inside it would risk the timeout — and a
timeout is a retry, which is a second bus row.

## Testing

This template includes integration tests using [Vitest](https://vitest.dev/). To run the tests locally:

```bash
npm run test
```

Test files are located in the `tests/` directory, with examples demonstrating how to test your endpoints and database interactions.

## Project structure

1. Your main router is defined in `src/index.ts`.
2. Each endpoint has its own file in `src/endpoints/`.
3. Polar webhook verification, capability resolution, and D1 access live in `src/polar/`.
4. Discord signature verification, command parsing, dispatch, and the command
   definitions live in `src/discord/`.
5. Integration tests are located in the `tests/` directory.
6. For more information read the [chanfana documentation](https://chanfana.com/), [Hono documentation](https://hono.dev/docs), and [Vitest documentation](https://vitest.dev/guide/).
