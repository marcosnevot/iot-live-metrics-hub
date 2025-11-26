# IoT Live Metrics Hub

Backend for real-time IoT sensor metrics, with alert rules, device management and observability.  
Built as a modular NestJS monolith using PostgreSQL (TimescaleDB) as time-series store.

---

## Table of contents

- [Overview](#overview)
- [Key features](#key-features)
- [Architecture at a glance](#architecture-at-a-glance)
- [Tech stack](#tech-stack)
- [Getting started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Clone and install](#clone-and-install)
  - [Configure environment](#configure-environment)
  - [Set up the infrastructure](#set-up-the-infrastructure-db--mqtt-with-docker-compose)
  - [Run tests](#run-tests)
  - [Run the app](#run-the-app)
- [Typical workflow](#typical-workflow)
- [HTTP API overview](#http-api-overview)
- [Observability](#observability)
- [Security model](#security-model)
- [Project structure](#project-structure)
- [Development notes](#development-notes)
- [Ideas for future work](#ideas-for-future-work)
- [Portfolio notes](#portfolio-notes)

---

## Overview

**IoT Live Metrics Hub** is a backend service that:

- Ingests IoT metrics over **HTTP** and **MQTT**.
- Stores readings as **time-series** in PostgreSQL/TimescaleDB.
- Evaluates **threshold rules** (MIN / MAX / RANGE) on each reading.
- Generates and manages **alerts** with an ACTIVE/RESOLVED lifecycle.
- Exposes **business APIs** for metrics, rules, alerts and devices.
- Uses **per-device API keys** for ingest and **JWT roles** for business APIs.
- Ships with **structured JSON logging** and **Prometheus metrics**.

The goal is to showcase a realistic backend for IoT monitoring and real-time alerting, with emphasis on:

- Clean modular architecture.
- Robust validation, auth and rate limiting.
- Good observability and test coverage.
- A developer experience that is easy to spin up locally.

---

## Key features

- **HTTP + MQTT ingest**
  - `POST /ingest` for device-authenticated HTTP ingest.
  - MQTT listener subscribed to `devices/{deviceId}/metrics`.

- **Time-series storage**
  - `metric_readings` hypertable for sensor data.
  - Indexed for device/metric/time-range queries.

- **Rules engine & alerts**
  - Rules: `MAX`, `MIN`, `RANGE` per device and metric.
  - Automatic evaluation on every reading.
  - Alerts persisted with `ACTIVE` / `RESOLVED` status.

- **Device catalog & API keys**
  - Devices stored in PostgreSQL.
  - Strong random API keys per device.
  - API keys stored as **SHA-256 hashes** (never raw).

- **JWT roles for business APIs**
  - `admin` and `analyst` roles.
  - Fine-grained access rules per controller.

- **Observability**
  - JSON logs via `nestjs-pino`.
  - `/metrics` endpoint for Prometheus scraping.
  - Domain-specific metrics (ingest counts, alerts, latencies).

- **Hardening & QA**
  - Global and endpoint-specific **rate limiting**.
  - ESLint + Prettier.
  - Unit tests and end-to-end tests covering main flows.
  - CI pipeline (GitHub Actions) running lint, tests and build.

---

## Architecture at a glance

- **Application**
  - **NestJS** modular monolith.
  - Core modules:
    - `ingest` – HTTP & MQTT ingest pipeline.
    - `storage` – time-series persistence and DB access.
    - `metrics` – time-series query APIs.
    - `rules` – rules engine and rule APIs.
    - `alerts` – alert lifecycle and APIs.
    - `devices` – device catalog and API key provisioning.
    - `auth` – API key + JWT auth, roles and guards.
    - `observability` – logging and Prometheus metrics.

- **Data layer**
  - PostgreSQL with a TimescaleDB hypertable:
    - `metric_readings(device_id, metric_name, ts, value)`.
  - Relational tables:
    - `devices`, `rules`, `alerts`.

- **Messaging**
  - Eclipse Mosquitto as MQTT broker (local dev).

- **Observability**
  - `nestjs-pino` JSON logs.
  - `prom-client` metrics exposed at `/metrics`.

---

## Tech stack

- **Language / runtime**
  - Node.js (tested in CI with **Node 20.x**).
  - TypeScript.

- **Frameworks / libraries**
  - NestJS
  - `pg` (PostgreSQL client)
  - `@nestjs/swagger` + `swagger-ui-express`
  - `@nestjs/throttler` (rate limiting)
  - `nestjs-pino` + `pino-http`
  - `prom-client`
  - `class-validator`, `class-transformer`

- **Database**
  - PostgreSQL + TimescaleDB (for the `metric_readings` hypertable).

- **Testing & tooling**
  - Jest + ts-jest
  - ESLint 9 (flat config) + Prettier
  - GitHub Actions CI

---

## Getting started

### Prerequisites

You will need:

- **Node.js 20.x**
- **npm** (comes with Node)
- **Docker Desktop** (to run PostgreSQL/TimescaleDB and Mosquitto via Docker Compose)

---

### Clone and install

```bash
git clone <your-fork-or-clone-url> iot-live-metrics-hub
cd iot-live-metrics-hub

npm install
```

---

### Configure environment

Start from the example:

```bash
cp .env.example .env
```

Then edit `.env` with your local values:

| Variable              | Description                                                                 |
|-----------------------|-----------------------------------------------------------------------------|
| `DB_HOST`             | PostgreSQL host (for Docker Compose, typically `localhost`)                 |
| `DB_PORT`             | PostgreSQL port (for Docker Compose, default `5432`)                        |
| `DB_USER`             | PostgreSQL user (e.g. `postgres`)                                          |
| `DB_PASSWORD`         | PostgreSQL password for `DB_USER`                                          |
| `DB_NAME`             | Database name (e.g. `postgres` or another DB name you prefer)              |
| `MQTT_BROKER_URL`     | MQTT broker URL for MQTT ingest (for Docker Compose, `mqtt://127.0.0.1:1883`) |
| `JWT_SECRET`          | Secret key for signing JWTs (HS256)                                        |
| `JWT_EXPIRES_IN`      | JWT expiry (e.g. `1h`)                                                      |
| `ADMIN_USERNAME`      | Username for the admin user (e.g. `admin@local.test`)                      |
| `ADMIN_PASSWORD`      | Password for the admin user                                                 |
| `ANALYST_USERNAME`    | Username for the analyst user (e.g. `analyst@local.test`)                  |
| `ANALYST_PASSWORD`    | Password for the analyst user                                               |
| `LOG_LEVEL`           | Application log level (e.g. `info`)                                        |
| `RATE_LIMIT_TTL_MS`   | *(Optional)* Rate limit window in ms (default ~60 000 if omitted)          |
| `RATE_LIMIT_LIMIT`    | *(Optional)* Max requests per IP per window (default ~300 if omitted)      |

> The example values in `.env.example` are for **local development only**.  
> Never commit real credentials.

---

### Set up the infrastructure (DB + MQTT with Docker Compose)

1. Make sure Docker Desktop is running.

2. From the project root, start the infrastructure services:

   ```bash
   docker compose up -d db mqtt
   ```

   This starts:

   - A TimescaleDB-compatible PostgreSQL instance (`db`) configured from your `.env` (`DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`).
   - An Eclipse Mosquitto broker (`mqtt`) bound to `mqtt://127.0.0.1:1883`.

3. On first startup, the `db` service automatically runs `infra/sql/init-test-db.sql` inside the container.  
   This script creates the `metric_readings` hypertable and the tables used by rules, alerts and devices.

If you ever need to reset the database, you can run:

```bash
docker compose down -v
docker compose up -d db mqtt
```

---

### Run tests

#### Unit tests

```bash
npm test
```

#### End-to-end tests

Make sure the Docker services are up and the database has been initialized by `docker compose up` as described above, then:

```bash
npm run test:e2e
```

End-to-end tests exercise the main flows:

- Ingest via `POST /ingest`
- Time-series queries via `GET /metrics/...`
- Full rules + alerts pipeline
- Auth and device creation

---

### Run the app

#### Development mode

```bash
npm run start:dev
```

This starts the NestJS HTTP server (default **port 3000**) with file watching.

#### Production-like mode (local)

Build and run from the compiled output:

```bash
npm run build
npm start
```

---

## Typical workflow

A common end-to-end flow looks like this:

1. **Authenticate as admin**

   - `POST /auth/login` with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
   - Receive `{ "accessToken": "<jwt>" }`.

2. **Register a device**

   - `POST /devices` with admin JWT.
   - The response includes:
     - The new `device_id`.
     - A **raw device API key**, returned **once**.

3. **Create a rule for that device**

   - `POST /rules` with admin JWT.
   - Example: a `MAX` rule for `temperature` on that device.

4. **Ingest metrics from the device**

   - `POST /ingest` with:
     - Header: `Authorization: Bearer <device_api_key>`
     - Body: `device_id` + `metrics` array
   - The service:
     - Normalizes metric names and timestamps.
     - Writes readings into `metric_readings`.
     - Evaluates rules and generates alerts if thresholds are violated.
   - Successful requests return:

     ```json
     {
       "status": "ok",
       "stored": <number_of_points>
     }
     ```

5. **Inspect metrics**

   - `GET /metrics/:deviceId/:metricName?from=&to=` with JWT (admin/analyst).
   - Returns ordered time-series points for that metric and device.

6. **Inspect and resolve alerts**

   - `GET /alerts?status=ACTIVE&device_id=<deviceId>` with JWT (admin/analyst).
   - `PATCH /alerts/:id/resolve` with admin JWT to mark an alert as `RESOLVED`.

All these endpoints are documented in the Swagger UI (see below).

---

## HTTP API overview

The main HTTP endpoints exposed by the service include:

- **Health and root**
  - `GET /` – simple banner.
  - `GET /health` – basic healthcheck.

- **Auth**
  - `POST /auth/login` – admin/analyst login, returns JWT.

- **Ingest**
  - `POST /ingest` – device-authenticated ingest using per-device API key.  
    Returns `201 Created` on success.

- **Metrics**
  - `GET /metrics/:deviceId/:metricName?from=&to=` – time-series queries (JWT-protected).

- **Rules**
  - `POST /rules` – create rule (JWT, admin only).
  - `GET /rules/:deviceId` – list device rules (JWT, admin only).

- **Alerts**
  - `GET /alerts` – list alerts, with filters by status/device/metric/time (JWT, admin or analyst).
  - `PATCH /alerts/:id/resolve` – resolve alert (JWT, admin only).

- **Devices**
  - `GET /devices` – list devices (JWT, admin or analyst).
  - `POST /devices` – create device and return raw API key (JWT, admin only).

- **Observability**
  - `GET /metrics` – Prometheus metrics endpoint (not included in Swagger).

### API documentation (Swagger / OpenAPI)

Once the app is running, the HTTP API is documented at:

```text
GET http://localhost:3000/docs
```

The Swagger UI includes:

- Tags for `App`, `Ingest`, `Metrics`, `Rules`, `Alerts` and `Devices`.
- DTOs and response schemas.
- Security schemes:
  - Bearer JWT for business APIs.
  - Per-device API key for ingest.

---

## Observability

- **Structured logging**
  - All logs are JSON via `nestjs-pino`.
  - Common fields: `module`, `operation`, `status`, plus domain identifiers.
  - Sensitive data is redacted:
    - Authorization headers and API keys.
    - Cookies.
    - Passwords and token-like fields in bodies.

- **Prometheus metrics**
  - Exposed at `GET /metrics` (plain text).
  - Examples:
    - `http_requests_total{method, path, status_code}`
    - `iot_ingest_total{channel, result}`
    - `iot_alerts_triggered_total{device_id, metric_name, rule_type}`
    - `iot_processing_latency_ms{stage="ingest_pipeline"}`
    - `iot_db_write_latency_ms{operation="insert_readings"}`

- **Cardinality control**
  - Paths use route patterns (e.g. `/metrics/:deviceId/:metricName`).
  - Label values such as `device_id`, `metric_name` and `rule_type` are normalized and constrained.

---

## Security model

- **Device authentication**
  - Each device has a high-entropy API key.
  - Only the **hash** (SHA-256) is stored in the `devices` table.
  - `POST /ingest` requires:
    - `Authorization: Bearer <device_api_key>` header.
    - A valid `device_id` in the JSON body.
  - The API key is validated against the stored hash, with backwards-compatible handling for legacy rows.

- **User authentication**
  - `POST /auth/login` validates credentials against environment-configured `admin` and `analyst` users.
  - Issues a signed JWT (HS256) with `sub` and `role` claims.

- **Role-based authorization**
  - `JwtAuthGuard` + `RolesGuard`.
  - Typical rules:
    - `admin`: full management, including device creation and alert resolution.
    - `analyst`: read-only access to devices, metrics, rules and alerts.

- **Rate limiting**
  - Global `ThrottlerGuard` limits requests per IP.
  - Stricter limit for `POST /auth/login` to mitigate brute force.
  - More permissive but bounded limit for `POST /ingest` to handle device traffic while protecting against abuse.
  - Parameters can be tuned via `RATE_LIMIT_TTL_MS` and `RATE_LIMIT_LIMIT`.

---

## Project structure

High-level layout:

```text
iot-live-metrics-hub/
├── .env
├── .env.example
├── .gitignore
├── ARCHITECTURE.md
├── CHANGELOG.md
├── CONTRIBUTING.md
├── docker-compose.yml
├── eslint.config.cjs
├── jest.config.cjs
├── nest-cli.json
├── package.json
├── package-lock.json
├── README.md
├── tsconfig.build.json
├── tsconfig.json
├── .github/
│   └── workflows/
│       └── ci.yml
├── docs/
├── infra/
│   └── sql/
│       └── init-test-db.sql
├── mosquitto/
│   ├── config/
│   │   └── mosquitto.conf
│   ├── data/
│   │   └── mosquitto.db
│   └── log/
│       └── mosquitto.log
├── src/
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── app.service.spec.ts
│   ├── app.service.ts
│   ├── app-health.dto.ts
│   ├── main.ts
│   └── modules/
│       ├── alerts/
│       │   ├── alert.entity.ts
│       │   ├── alerts.controller.spec.ts
│       │   ├── alerts.controller.ts
│       │   ├── alerts.module.ts
│       │   ├── alerts.repository.spec.ts
│       │   ├── alerts.repository.ts
│       │   └── dto/
│       │       ├── alert-response.dto.ts
│       │       └── get-alerts-query.dto.ts
│       ├── auth/
│       │   ├── api-key.service.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.module.ts
│       │   ├── auth.service.spec.ts
│       │   ├── auth.service.ts
│       │   ├── jwt.strategy.ts
│       │   ├── roles.decorator.ts
│       │   ├── dto/
│       │   │   ├── login-request.dto.ts
│       │   │   └── login-response.dto.ts
│       │   └── guards/
│       │       ├── api-key-auth.guard.ts
│       │       ├── jwt-auth.guard.ts
│       │       └── roles.guard.ts
│       ├── devices/
│       │   ├── device.entity.ts
│       │   ├── device-api-key.util.ts
│       │   ├── devices.controller.spec.ts
│       │   ├── devices.controller.ts
│       │   ├── devices.module.ts
│       │   ├── devices.repository.ts
│       │   └── dto/
│       │       ├── create-device.dto.ts
│       │       └── device-response.dto.ts
│       ├── ingest/
│       │   ├── ingest.controller.ts
│       │   ├── ingest.module.ts
│       │   ├── ingest.service.spec.ts
│       │   ├── ingest.service.ts
│       │   ├── mqtt-ingest.listener.spec.ts
│       │   ├── mqtt-ingest.listener.ts
│       │   └── dto/
│       │       ├── ingest-request.dto.ts
│       │       ├── ingest-response.dto.ts
│       │       └── metric.dto.ts
│       ├── metrics/
│       │   ├── metrics.controller.ts
│       │   ├── metrics.module.ts
│       │   └── dto/
│       │       └── metric-series-response.dto.ts
│       ├── observability/
│       │   ├── http-metrics.interceptor.ts
│       │   ├── metrics.controller.ts
│       │   ├── metrics.service.spec.ts
│       │   ├── metrics.service.ts
│       │   └── observability.module.ts
│       ├── rules/
│       │   ├── rule.entity.ts
│       │   ├── rules.controller.ts
│       │   ├── rules.module.ts
│       │   ├── rules.repository.ts
│       │   ├── rules-engine.service.spec.ts
│       │   ├── rules-engine.service.ts
│       │   └── dto/
│       │       ├── create-rule.dto.ts
│       │       └── rule-response.dto.ts
│       └── storage/
│           ├── storage.module.ts
│           └── timeseries-storage.service.ts
└── test/
    ├── alerts.e2e-spec.ts
    ├── auth.e2e-spec.ts
    ├── devices.e2e-spec.ts
    ├── ingest.e2e-spec.ts
    ├── jest-e2e.json
    └── metrics.e2e-spec.ts
```

- `ARCHITECTURE.md` – in-depth architecture and design decisions.
- `CHANGELOG.md` – version history for all released versions.
- `CONTRIBUTING.md` – contribution guidelines (branching, commits, PRs).

---

## Development notes

- **Scripts**

  ```bash
  # build
  npm run build

  # dev server with watch
  npm run start:dev

  # production-like run (after build)
  npm start

  # lint
  npm run lint

  # unit tests
  npm test

  # e2e tests
  npm run test:e2e
  ```

- **CI**

  The GitHub Actions workflow runs on Node 20 and executes:

  - `npm ci`
  - `npm run lint`
  - `npm test`
  - `npm run test:e2e`
  - `npm run build`

  on pushes and pull requests to the main and standard feature/bugfix branches.

---

## Ideas for future work

Some possible extensions beyond the current `1.0.0` release:

- More advanced alert semantics:
  - Rate-based rules, sliding windows, aggregations.
- Multi-tenant support and stronger auth models.
- Richer dashboards built on top of the metrics and alerts APIs.
- Additional hardening and production runbooks (backup/restore, retention, SLOs and alerting policies).

This project is intentionally focused on the **backend** and the **developer experience** of running and extending a real-time IoT metrics pipeline.

## Portfolio notes

If you plan to use this project as part of your portfolio, there is a short guide with suggested talking points for interviews:

- [docs/portfolio-notes.md](docs/portfolio-notes.md)

It summarises key technical selling points and provides example stories you can use when explaining the architecture, ingest pipeline, rules engine, observability and QA practices.
