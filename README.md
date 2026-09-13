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
4. Integration tests are located in the `tests/` directory.
5. For more information read the [chanfana documentation](https://chanfana.com/), [Hono documentation](https://hono.dev/docs), and [Vitest documentation](https://vitest.dev/guide/).
