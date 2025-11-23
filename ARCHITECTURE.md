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

## Implementation status (release 0.2.0 – F2 Backend Skeleton)

At this stage:

- The backend is bootstrapped as a NestJS application:
  - `src/main.ts` with a basic HTTP server on port 3000.
  - `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`.
- The main logical components are present as empty NestJS modules under `src/modules/`:
  - `ingest`, `storage`, `rules`, `alerts`, `devices`, `auth`.
  - Currently they are wiring-only (`@Module` definitions without domain logic).
- Basic HTTP endpoints are available:
  - `GET /` – simple banner to confirm the API is running.
  - `GET /health` – JSON healthcheck stub with status and timestamp.
- Tooling and CI:
  - TypeScript, Jest + ts-jest, and ESLint 9 + Prettier are configured.
  - `npm run lint`, `npm test` and `npm run build` are wired and passing.
  - GitHub Actions CI runs on Node 20 with `npm ci`, lint, tests and build on pushes and PRs targeting `main`.

Future phases will extend this document with data model diagrams,
request/response flows and scalability considerations.
