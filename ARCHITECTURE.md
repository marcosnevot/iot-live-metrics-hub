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
- **Metrics module**: Read-only time-series query APIs built on top
  of the `metric_readings` hypertable (per-device, per-metric and
  by time range).
- **Rules module**: Rule evaluation and alert triggering.
- **Alerts module**: Alert lifecycle and query APIs.
- **Devices module**: Device registration and API key handling.
- **Auth module**: JWT-based user authentication and access control.

These map to the high-level components C1–C5 described in the
Master Design Document (plus the time-series query surface).

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

## Implementation status (release 0.5.0 – F3 HTTP ingest + F4 MQTT ingest + F5 Time-Series Storage)

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
    - MQTT ingest adapter implemented as `MqttIngestListener`, connecting to Mosquitto and subscribing to the `devices/{deviceId}/metrics` topic pattern.
    - MQTT messages are transformed into `IngestRequestDto` instances and delegated to `IngestService`, so HTTP and MQTT share the same ingest pipeline.
    - Per-channel ingest logging is supported via an optional context on `IngestService.ingest(...)` (`channel = "http" | "mqtt"`).
  - **Storage module**
    - Time-series persistence pipeline implemented through `TimeseriesStorageService`.
    - PostgreSQL 15 instance extended with TimescaleDB and a `metric_readings(device_id, metric_name, ts, value)` hypertable used as the primary storage for metric readings.
    - Dedicated indexes on `(device_id, metric_name, ts DESC)` and on `(ts DESC)` to support device/metric range queries and global time-based queries.
    - Batch insert path `insertReadings(...)` used by the ingest pipeline to write multiple readings efficiently in a single multi-row `INSERT`.
    - Broader relational metadata (devices, rules, alerts) remains to be implemented in later phases.
  - **Metrics module**
    - `MetricsModule` wired into `AppModule` and importing `StorageModule`.
    - `MetricsController` exposing a read-only endpoint:
      - `GET /metrics/:deviceId/:metricName?from=&to=` which:
        - Validates `deviceId` as a UUID v4.
        - Expects `from` and `to` as ISO-8601 timestamps.
        - Validates that `from <= to`.
        - Delegates to `TimeseriesStorageService.getReadingsForDeviceMetric(...)`.
      - Returns a payload of the form:
        ```json
        {
          "device_id": "<uuid>",
          "metric_name": "<metric>",
          "points": [
            { "ts": "<ISO-8601>", "value": 27.5 }
          ]
        }
        ```
    - `TimeseriesStorageService` extended with a range-read method:
      - `getReadingsForDeviceMetric(deviceId, metricName, from, to)` which
        performs a parameterized `SELECT` on the `metric_readings` hypertable
        and returns ordered time-series points.
  - **Auth module**
    - Device-side API key validation service and guard used by the ingest pipeline.
    - User-side JWT authentication is defined at design level but not yet implemented in code.
  - **Rules, Alerts, Devices modules**
    - Present as NestJS modules and imported into `AppModule`, but still act as wiring-only placeholders without domain logic. They will be populated in later phases (rules evaluation, alert lifecycle, device registration and API key provisioning).

- HTTP endpoints:
  - `GET /` – simple banner to confirm the API is running.
  - `GET /health` – JSON healthcheck stub with status and timestamp.
  - `POST /ingest` – authenticated ingest endpoint that validates the payload, normalizes metric names / timestamps, and writes readings into PostgreSQL / TimescaleDB.
  - `GET /metrics/:deviceId/:metricName` – read-only metrics endpoint that
    accepts `from` and `to` as query parameters (ISO-8601 timestamps) and
    returns ordered time-series points for the requested device and metric.

- MQTT ingest:
  - MQTT client implemented as `MqttIngestListener`, started as a NestJS provider inside `IngestModule`.
  - Connects by default to `mqtt://127.0.0.1:1883` (overridable via `MQTT_BROKER_URL`).
  - Subscribes to the topic pattern `devices/{deviceId}/metrics` with QoS 1.
  - For each incoming message:
    - Extracts `deviceId` from the topic.
    - Parses the JSON payload and expects a `metrics` array.
    - Performs basic shape validation on each metric (`name: string`, `value: number`, optional `ts: string`).
    - Builds an `IngestRequestDto` and calls `IngestService.ingest(..., { channel: "mqtt" })`.
  - MQTT-specific logs include:
    - `mqtt_message_received`
    - `mqtt_invalid_json`
    - `mqtt_unexpected_topic`
    - `mqtt_invalid_payload`
    - `mqtt_invalid_metric`
    - `mqtt_ingest_success`
    - `mqtt_ingest_error`
  - Invalid MQTT messages are dropped safely with warning logs and do not impact the main process.

- Persistence and environment:
  - Local PostgreSQL 15 instance running in Docker (`iot_db` container) with the TimescaleDB extension enabled.
  - Primary time-series table modeled as the `metric_readings` hypertable (partitioned on `ts`), with indexes tuned for device/metric lookups and chronological queries.
  - Connection managed via a `pg` connection pool inside `TimeseriesStorageService`.
  - Database and ingest configuration driven by environment variables:
    - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
    - `INGEST_API_KEY`
    - `MQTT_BROKER_URL` (optional; defaults to `mqtt://127.0.0.1:1883` in local dev).
  - Local MQTT broker (Mosquitto 2.x) running in Docker (`iot_mqtt` container), with config mounted from the project:
    - `mosquitto/config/mosquitto.conf`
    - `mosquitto/data/`
    - `mosquitto/log/`

- Tooling, tests and CI:
  - TypeScript, Jest + ts-jest, and ESLint 9 + Prettier are configured and passing.
  - Unit tests for `AppService` and `IngestService`.
  - Unit tests for `MqttIngestListener` covering:
    - Valid MQTT message path (happy path).
    - Invalid JSON payload.
    - Invalid topic.
    - Invalid metrics payload.
  - End-to-end tests for `POST /ingest` (happy path, missing API key, invalid payload).
  - End-to-end tests for `GET /metrics/:deviceId/:metricName` covering:
    - Happy path with data in the requested time range.
    - Empty result set when the range does not contain data.
    - Validation errors for missing or inconsistent `from` / `to` parameters.
  - GitHub Actions CI runs on Node 20 with `npm ci`, lint, tests and build on pushes and PRs targeting `main`.

Future phases will extend this document with detailed data model diagrams,
request/response flows per use case, and scalability considerations
(particularly around MQTT ingest, alert fan-out, and time-series query patterns).
