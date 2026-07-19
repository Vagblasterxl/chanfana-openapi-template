# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Cloudflare Worker template that auto-generates an OpenAPI 3.1 schema and validates requests using [chanfana](https://chanfana.com/) on top of [Hono](https://hono.dev/), backed by a D1 (SQLite) database. Interactive API docs are served at `/` and the schema at `/openapi.json`.

## Commands

```bash
npm install                # install dependencies
npm run dev                # apply D1 migrations locally, then start wrangler dev server
npm run test               # dry-run deploy + run all integration tests (Vitest)
npm run seedLocalDb        # apply D1 migrations to the local database only
npm run schema             # extract openapi.json schema locally (npx chanfana)
npm run cf-typegen         # regenerate worker-configuration.d.ts (Env types) from wrangler.jsonc
npm run deploy             # apply migrations to remote D1, then wrangler deploy
```

Run a single test file:

```bash
npx vitest run --config tests/vitest.config.mts tests/integration/tasks.test.ts
```

Note: `npm run test` first runs `wrangler deploy --dry-run`, which catches build/config errors before the Vitest suite runs.

## Architecture

- `src/index.ts` — entrypoint. Creates the Hono app, wraps it with chanfana's `fromHono()` to get the OpenAPI registry, registers routes, and defines the global error handler (chanfana `ApiException`s become structured JSON error responses; everything else becomes a generic 500).
- `src/types.ts` — shared types: `AppContext` (Hono context with `Env` bindings) and `HandleArgs` (the generic parameter chanfana endpoint classes take).
- `src/endpoints/` — one file per endpoint, each exporting a class:
  - `tasks/` — a full CRUD example built on chanfana's **D1 AutoEndpoints** (`D1CreateEndpoint`, `D1ReadEndpoint`, `D1UpdateEndpoint`, `D1DeleteEndpoint`, `D1ListEndpoint`). These generate the SQL, validation, and OpenAPI schema from a shared model.
  - `tasks/base.ts` — the `TaskModel`: Zod schema, `tableName`, `primaryKeys`, and a `serializer` that converts D1's integer `completed` column to a boolean.
  - `tasks/router.ts` — a sub-router (its own `fromHono(new Hono())`) mounted in `src/index.ts` via `openapi.route("/tasks", tasksRouter)`.
  - `dummyEndpoint.ts` — a manually defined endpoint extending `OpenAPIRoute`, showing the `schema` (request params/body + responses) and `handle()` pattern with `getValidatedData()`.
- `migrations/` — sequential D1 SQL migrations (`0001_...sql`, etc.). Applied via `wrangler d1 migrations apply DB` (`--local` or `--remote`).
- `wrangler.jsonc` — Worker config; defines the `DB` D1 binding. The `Env` type used throughout comes from the generated `worker-configuration.d.ts` (regenerate with `npm run cf-typegen` after changing bindings).

### Adding an endpoint

For CRUD over a D1 table: add a migration, define a model like `tasks/base.ts`, create endpoint classes extending the D1 auto-endpoint base classes with `_meta = { model }`, and register them on a router. For custom logic: extend `OpenAPIRoute`, declare `schema`, implement `handle(c)`, and register it in `src/index.ts` (e.g. `openapi.post("/path/:param", MyEndpoint)`). The OpenAPI schema updates automatically from these definitions.

## Testing

Integration tests live in `tests/integration/` and run inside the Workers runtime via `@cloudflare/vitest-pool-workers` (config: `tests/vitest.config.mts`, with its own `tests/tsconfig.json`).

- Tests make real HTTP requests against the Worker with `SELF.fetch(...)` from `cloudflare:test`.
- D1 migrations are read by the Vitest config, exposed as a `MIGRATIONS` binding, and applied in the `tests/apply-migrations.ts` setup file, so tests run against a real, migrated D1 database.
- Isolated storage resets D1 state between tests, so each test starts from an empty database.

## Conventions

- Response envelope: `{ success: boolean, result: ... }` on success, `{ success: false, errors: [{ code, message }] }` on error.
- Exact dependency versions are pinned in `package.json` (no `^` ranges).
- `strict` TypeScript; no linter or formatter is configured in this template.
