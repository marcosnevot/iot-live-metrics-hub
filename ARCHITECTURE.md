# Architecture

## Overview

IoT Live Metrics Hub is a monolithic NestJS backend designed to:

- Ingest IoT metrics over HTTP (and MQTT as an optional path).
- Store readings as time-series in PostgreSQL + TimescaleDB.
- Evaluate simple alert rules (MIN / MAX / RANGE) on each reading.
- Expose query APIs for devices, metrics and alerts.

The system is implemented as a modular monolith prepared for a
future split into services if needed.

## Logical components

- **Ingest module**: HTTP `/ingest` endpoint and MQTT adapter.
- **Storage module**: Relational metadata (devices, rules, alerts)
  and time-series tables for readings.
- **Rules module**: Rule evaluation and alert triggering.
- **Alerts module**: Alert lifecycle and query APIs.
- **Devices module**: Device registration and API key handling.
- **Auth module**: JWT-based user authentication and access control.

These map to the high-level components C1–C5 described in the
Master Design Document.

## Key technical decisions (DEC)

- **DEC-01** – Backend: Node.js (NestJS).
- **DEC-02** – Database: PostgreSQL + TimescaleDB.
- **DEC-03** – MQTT broker: Eclipse Mosquitto.
- **DEC-04** – Observability: JSON logs + Prometheus `/metrics`.
- **DEC-05** – Auth: API Key for devices + JWT HS256 for users.
- **DEC-06** – Monolithic modular architecture for v1.
- **DEC-07** – Docker Desktop as primary local environment.
- **DEC-08** – No local shell scripts; only standalone commands.
- **DEC-09** – Strict alignment with the corporate Git/GitHub guide.

## Implementation status (release 0.3.0 – F3 HTTP ingest)

At this stage:

- The backend is bootstrapped as a NestJS application:
  - `src/main.ts` with a basic HTTP server on port 3000.
  - Global `ValidationPipe` for DTO-based request validation.
  - Application logging wired through `nestjs-pino` as the main logger.
  - `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`.

- Logical components under `src/modules/`:
  - **Ingest module**
    - Real HTTP endpoint `POST /ingest` implemented according to the Master Design Document.
    - Request/response contracts modeled with DTOs (`IngestRequestDto`, `MetricDto`) and validated via `class-validator` / `class-transformer`.
    - Basic API key authentication for device ingest using `ApiKeyAuthGuard` + `ApiKeyService` and the `Authorization: Bearer <INGEST_API_KEY>` header.
    - Domain-level logging (`ingest_success`, `ingest_db_error`) emitted as structured JSON via `nestjs-pino`.
  - **Storage module**
    - Minimal time-series persistence pipeline implemented through `TimeseriesStorageService`.
    - PostgreSQL table `metric_readings(device_id, metric_name, ts, value)` created as the initial storage for metric readings, with basic indexes.
    - Broader relational metadata (devices, rules, alerts) remains to be implemented in later phases.
  - **Auth module**
    - Device-side API key validation service and guard used by the ingest pipeline.
    - User-side JWT authentication is defined at design level but not yet implemented in code.
  - **Rules, Alerts, Devices modules**
    - Present as NestJS modules and imported into `AppModule`, but still act as wiring-only placeholders without domain logic. They will be populated in later phases (rules evaluation, alert lifecycle, device registration and API key provisioning).

- HTTP endpoints:
  - `GET /` – simple banner to confirm the API is running.
  - `GET /health` – JSON healthcheck stub with status and timestamp.
  - `POST /ingest` – authenticated ingest endpoint that validates the payload, normalizes metric names / timestamps, and writes readings into PostgreSQL.

- Persistence and environment:
  - Local PostgreSQL 15 instance running in Docker (`iot_db` container).
  - Connection managed via a `pg` connection pool inside `TimeseriesStorageService`.
  - Database and ingest configuration driven by environment variables:
    - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
    - `INGEST_API_KEY`

- Tooling, tests and CI:
  - TypeScript, Jest + ts-jest, and ESLint 9 + Prettier are configured and passing.
  - Unit tests for `AppService` and `IngestService`.
  - End-to-end tests for `POST /ingest` (happy path, missing API key, invalid payload).
  - GitHub Actions CI runs on Node 20 with `npm ci`, lint, tests and build on pushes and PRs targeting `main`.

Future phases will extend this document with detailed data model diagrams,
request/response flows per use case, and scalability considerations
(particularly around MQTT ingest, alert fan-out, and time-series query patterns).
