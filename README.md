# CLI Payments — API

Centralized payments API for CLI Software House. Built on NestJS 11 + TypeORM + PostgreSQL.

Covers:
- One-shot payments (custom development, audits, maintenance) via landing checkout tokens.
- Subscriptions for internal SaaS products (Vitriona, future SaaS) via REST API + outgoing webhooks.
- FX rates (EUR/USD → VES) sourced from [DolarApi](https://dolarapi.com/docs/venezuela/) with Yadio + ExchangeDyn fallbacks.
- Sitef gateway integration (C2P, transfer, Credicard Web Button, Zelle stub).
- Transactional email via [Resend](https://resend.com).

> See [../PLAN.md](../PLAN.md) and [../ROADMAP.md](../ROADMAP.md) for the full architectural plan.

## Quick start

All services are **cloud-hosted**:

1. **Neon** (Postgres) — [neon.tech](https://neon.tech). Crear un proyecto `cli-payments`. Usar la `Pooled connection` como `DATABASE_URL`. Para dev local crear un branch `dev` desde la rama principal.
2. **Upstash** (Redis) — [upstash.com](https://upstash.com). Crear una BD `cli-payments-dev` y otra `cli-payments-prod`. Copiar la connection string (`rediss://...`) a `WORKER_HOST`.
3. **Resend** (email) — [resend.com](https://resend.com). Generar API key y ponerla en `RESEND_API_KEY`.

```bash
cp env-example-relational .env
# Editar .env con las URLs de Neon, Upstash, Resend, y los secrets (AUTH_JWT_SECRET, APP_ENCRYPTION_KEY, APP_CHECKOUT_TOKEN_SECRET).

npm install
npm run migration:run
npm run seed:run:relational
npm run start:dev
```

API runs at `http://localhost:3000/api/v1`. Swagger at `http://localhost:3000/docs`.

> No hace falta Postgres ni Redis instalados localmente. Si necesitas trabajar offline puedes levantar el `docker-compose.yaml` del template — queda como fallback opcional.

## Deployment (Render)

CI/CD: push a `main` → Render rebuild + redeploy automático.

1. **Web service** — `npm install && npm run build && npm run start:prod`. Health: `GET /`. Las env vars se copian desde tu `.env` al dashboard de Render (los secrets quedan como secrets, no en git).
2. **Postgres** — externo: **Neon**. Render NO maneja la BD. La connection string apunta al pooler de Neon.
3. **Redis** — externo: **Upstash**. Render NO maneja Redis. La connection string apunta a Upstash.

> El `Dockerfile` del template **no se usa en producción**. Render hace build directo del repo Node.

## Key commands

| Command | Purpose |
|---|---|
| `npm run start:dev` | Hot-reload dev server |
| `npm run migration:generate -- src/database/migrations/<name>` | Generate migration from entity diff |
| `npm run migration:run` | Apply pending migrations |
| `npm run migration:revert` | Rollback last migration |
| `npm run seed:run:relational` | Run all seeders |
| `npm run generate:resource:relational` | Hygen: scaffold a new hexagonal module |
| `npm run add:property:to-relational` | Hygen: add a column to an existing entity + DTOs |
| `npm run test` | Unit tests |
| `npm run test:e2e` | End-to-end tests |
| `npm run lint` | ESLint |

## Environment variables of note

| Variable | Purpose |
|---|---|
| `CORS_ORIGINS` | Comma-separated allowed origins (landing + admin frontend). |
| `DATABASE_URL` | Neon Postgres pooled connection (`postgresql://...?sslmode=require`). |
| `WORKER_HOST` | Upstash Redis URL (`rediss://default:<pwd>@<endpoint>.upstash.io:6379`). |
| `RESEND_API_KEY` | API key from [resend.com](https://resend.com). |
| `MAIL_DEFAULT_EMAIL` / `MAIL_DEFAULT_NAME` | Default `From:` for transactional email. |
| `FX_PRIMARY_SOURCE` | `DOLARAPI` (default) — fetches official BCV rate from dolarapi.com. |
| `FX_DOLARAPI_URL` | `https://ve.dolarapi.com/v1` (default). |
| `SITEF_BASE_URL` | `https://api.sitefdevenezuela.com/prod`. |
| `SITEF_TOKEN_STRATEGY` | `per_request` (default, complies with Sitef policy) or `cached` (re-uses token up to TTL). |
| `APP_CHECKOUT_TOKEN_SECRET` | HMAC secret for public checkout links. |
| `APP_ENCRYPTION_KEY` | AES-256-GCM key for encrypting Sitef merchant credentials at rest. |
| `WEBHOOK_RETRY_BACKOFF_SECONDS` | Comma-separated backoff schedule for outgoing webhook retries. |
| `PAYMENTS_ZELLE_ENABLED` | Feature flag — keep `false` until Zelle account is provisioned. |

## Module layout

Each feature module follows hexagonal architecture (template convention):

```
src/modules/<feature>/
├── domain/                     ← Domain entities (DB-agnostic)
├── dto/                        ← class-validator DTOs
├── infrastructure/
│   └── persistence/
│       └── relational/
│           ├── entities/       ← @Entity (TypeORM)
│           ├── mappers/        ← domain ↔ entity
│           └── repositories/   ← adapter (concrete)
├── <feature>.repository.ts     ← port (abstract)
├── <feature>.controller.ts
├── <feature>.service.ts
└── <feature>.module.ts
```

Use `npm run generate:resource:relational` to scaffold a new module with the correct shape.
