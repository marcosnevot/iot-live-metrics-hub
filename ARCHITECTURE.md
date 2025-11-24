# Architecture

## Overview

IoT Live Metrics Hub is a monolithic NestJS backend designed to:

- Ingest IoT metrics over HTTP and MQTT.
- Store readings as time-series in PostgreSQL + TimescaleDB.
- Evaluate simple alert rules (MIN / MAX / RANGE) on each reading.
- Persist alerts with status and lifecycle.
- Expose business APIs for querying metrics, rules, alerts and devices.
- Register devices and provision per-device API keys (for now only generated and returned on creation; ingest still uses a single global API key).

The system is implemented as a modular monolith prepared for a
future split into services if needed.

## Logical components

- **Ingest module**
  - HTTP `/ingest` endpoint.
  - MQTT adapter subscribed to `devices/{deviceId}/metrics`.
  - Shared ingest pipeline (`IngestService`) used by both channels.

- **Storage module**
  - Time-series storage for metric readings (`metric_readings` hypertable).
  - Relational storage for rules, alerts and devices (PostgreSQL tables `rules`, `alerts` and `devices`).
  - `TimeseriesStorageService` as the main abstraction for writing/reading metrics, and the integration point with the rules engine.

- **Metrics module**
  - Read-only time-series query APIs built on top of the `metric_readings` hypertable.
  - Per-device, per-metric and by time range queries.

- **Rules module**
  - Persistence and querying of rule definitions.
  - Rules evaluation for each new reading (MAX / MIN / RANGE).
  - HTTP APIs for creating and listing rules per device.

- **Alerts module**
  - Alert lifecycle (ACTIVE / RESOLVED).
  - Persistence of triggered alerts.
  - HTTP APIs for listing and resolving alerts, with filters by status, device, metric name and time range.

- **Devices module**
  - Device registration and catalog, backed by the `devices` table.
  - HTTP APIs for listing and creating devices (`GET /devices`, `POST /devices`), including per-device API key provisioning (API keys are generated and stored, and only returned once at creation time). The ingest pipeline still uses a single global API key from environment variables.

- **Auth module**
  - API Key–based authentication for ingest requests.
  - JWT-based user authentication is specified at design level but not yet implemented in code.

  - **API documentation**
  - OpenAPI/Swagger documentation exposed at `/docs`, covering App, Ingest, Metrics, Rules, Alerts and Devices APIs, including the `api-key` security scheme for ingest endpoints.


## Key technical decisions (DEC)

- **DEC-01** – Backend: Node.js (NestJS).
- **DEC-02** – Database: PostgreSQL + TimescaleDB.
- **DEC-03** – MQTT broker: Eclipse Mosquitto.
- **DEC-04** – Observability: JSON logs + Prometheus `/metrics` (planned).
- **DEC-05** – Auth: API Key for devices + JWT HS256 for users.
- **DEC-06** – Monolithic modular architecture for v1.
- **DEC-07** – Docker Desktop as primary local environment.
- **DEC-08** – No local shell scripts; only standalone commands.
- **DEC-09** – Strict alignment with the corporate Git/GitHub guide.

## Implementation status (release 0.7.0 – F3 HTTP ingest + F4 MQTT ingest + F5 Time-Series Storage + F6 Rules Engine & Alerts + F7 Business APIs & Swagger)

At this stage, the backend implements the following:

### Core application and infrastructure

- NestJS application bootstrap:
  - `src/main.ts` with an HTTP server on port 3000.
  - Global `ValidationPipe` for DTO-based request validation (`whitelist`, `forbidNonWhitelisted`, implicit conversion).
  - Application logging wired through `nestjs-pino` as the main logger, emitting structured JSON logs.
  - Core Nest module wiring in `src/app.module.ts`.

- API documentation:
  - `@nestjs/swagger` + `swagger-ui-express` configured in `src/main.ts`.
  - OpenAPI document exposed at `GET /docs` with tags for App, Ingest, Metrics, Rules, Alerts and Devices.
  - API key security scheme (`api-key`) configured for ingest endpoints.

- Environment and configuration:
  - Ingest and database configuration driven by environment variables:
    - `INGEST_API_KEY`
    - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
    - `MQTT_BROKER_URL` (optional; defaults to `mqtt://127.0.0.1:1883` in local dev).
  - Local PostgreSQL 15 + TimescaleDB in Docker (`iot_db` container).
  - Local Mosquitto broker in Docker (`iot_mqtt` container) with project-local config and data.

### Ingest module

- **HTTP ingest** (`IngestModule` + `IngestController` + `IngestService`):
  - Real HTTP endpoint `POST /ingest` implemented according to the Master Design Document.
  - Request/response contracts modeled with DTOs (`IngestRequestDto`, `MetricDto`) and validated via `class-validator` / `class-transformer`.
  - Device-side API key authentication for ingest using `ApiKeyAuthGuard` + `ApiKeyService`, expecting header:
    - `Authorization: Bearer <INGEST_API_KEY>`.
  - `IngestService.ingest(...)`:
    - Normalizes metric names to lowercase.
    - Normalizes timestamps (uses metric timestamp if provided, otherwise “now”).
    - Builds a batch of `TimeseriesReading` objects.
    - Delegates persistence to `TimeseriesStorageService.insertReadings(...)`.
    - Emits structured logs:
      - `ingest_success` with channel, device and metrics count.
      - `ingest_db_error` when persistence fails (including device and metrics count).

- **Per-channel context**:
  - `IngestService.ingest(request, { channel: "http" | "mqtt" })` propagates a logical channel for logging and troubleshooting.

- **MQTT ingest** (`MqttIngestListener`):
  - Implemented as a NestJS injectable in `IngestModule`.
  - Connects by default to `mqtt://127.0.0.1:1883` (overridable via `MQTT_BROKER_URL`).
  - Subscribes to topic pattern `devices/{deviceId}/metrics` with QoS 1.
  - For each incoming message:
    - Extracts `deviceId` from the topic.
    - Parses the JSON payload and expects a non-empty `metrics` array.
    - Validates each metric:
      - `name: string`
      - `value: number` (non-NaN)
      - optional `ts: string`
    - Builds an `IngestRequestDto` and calls `IngestService.ingest(..., { channel: "mqtt" })`.
  - Logs:
    - `mqtt_message_received`
    - `mqtt_invalid_json`
    - `mqtt_unexpected_topic`
    - `mqtt_invalid_payload`
    - `mqtt_invalid_metric`
    - `mqtt_ingest_success`
    - `mqtt_ingest_error`
  - Invalid MQTT messages are dropped safely with warning logs and do not impact the main process.

### Storage module (time-series + rules engine integration)

- **Time-series persistence** (`TimeseriesStorageService`):
  - Connects to PostgreSQL using a dedicated `pg` `Pool`, configured via `DB_*` environment variables.
  - Uses a TimescaleDB hypertable `metric_readings(device_id, metric_name, ts, value)` as the primary store for metric readings.
  - Indexes:
    - `(device_id, metric_name, ts DESC)` for device/metric range queries.
    - `(ts DESC)` for global recent queries.
  - Batch insert path:
    - `insertReadings(readings: TimeseriesReading[])` performs a single multi-row parameterized `INSERT` for efficiency.

- **Time-series queries**:
  - `getReadingsForDeviceMetric(deviceId, metricName, from, to)`:
    - Performs a parameterized `SELECT` on `metric_readings` filtered by device, metric and time range.
    - Returns ordered time-series points (`ts ASC`).

- **Rules engine integration point**:
  - After a successful `INSERT` in `insertReadings(...)`, `TimeseriesStorageService`:
    - Iterates over each persisted reading.
    - Builds a `MetricEvaluationContext` `{ deviceId, metricName, value }`.
    - Calls `RulesEngineService.evaluateForMetric(context)` for each reading.
  - Errors from the rules engine do **not** break ingest:
    - Failures are logged (`rules_engine_evaluation_error`) with device, metric and value.
    - The original ingest path remains successful as long as the DB write succeeds.
  - This guarantees that **both HTTP and MQTT ingest paths** automatically trigger rule evaluation without duplicating logic.

### Metrics module

- **`MetricsModule`**:
  - Imports `StorageModule`.
  - Exposes a read-only controller `MetricsController`.

- **`MetricsController`**:
  - Endpoint: `GET /metrics/:deviceId/:metricName?from=&to=`.
  - Validates:
    - `deviceId` as UUID v4.
    - `metricName` as a non-empty string.
    - `from` and `to` as ISO-8601 timestamps, with `from <= to`.
  - Delegates to `TimeseriesStorageService.getReadingsForDeviceMetric(...)`.
  - Response shape:
    ```json
    {
      "device_id": "<uuid>",
      "metric_name": "<metric>",
      "points": [
        { "ts": "<ISO-8601>", "value": 27.5 }
      ]
    }
    ```
- The metrics API is fully documented in Swagger under the `Metrics` tag, including path parameters and required `from` / `to` query parameters.

This module satisfies the initial metrics query requirements and is used as a debugging and analysis tool for the rules engine.

### Rules module (rules storage, engine and API)

The Rules module implements the data model and runtime behavior specified for RF-11 (rule definition) and RF-12 (automatic evaluation).

- **Domain model & persistence** (`Rule` entity + `RulesRepository`):
  - Table `rules` with fields:
    - `id UUID PRIMARY KEY`
    - `device_id UUID`
    - `metric_name TEXT`
    - `rule_type ENUM('MAX','MIN','RANGE')`
    - `min_value DOUBLE PRECISION NULL`
    - `max_value DOUBLE PRECISION NULL`
    - `enabled BOOLEAN`
    - `created_at TIMESTAMP`
  - `RulesRepository` uses a dedicated `pg` `Pool` injected via `RULES_PG_POOL`.
  - Main methods:
    - `findActiveByDeviceAndMetric(deviceId, metricName)`:
      - Returns enabled rules for a given device + metric ordered by creation time.
    - `findByDevice(deviceId)`:
      - Returns all rules for a given device.
    - `createRule({ deviceId, metricName, ruleType, minValue, maxValue, enabled })`:
      - Generates a UUID `id` in the application layer.
      - Inserts the rule row and returns the created `Rule` domain object.

- **Pure rule evaluation function**:
  - `shouldTriggerRule(rule: Rule, value: number): boolean`:
    - `MAX`: triggers if `value > max_value`.
    - `MIN`: triggers if `value < min_value`.
    - `RANGE`: triggers if `value < min_value || value > max_value`.
    - Safely handles null/undefined thresholds by returning `false`.

- **Rules engine service** (`RulesEngineService`):
  - Entry point: `evaluateForMetric(context: MetricEvaluationContext)`, where:
    - `context = { deviceId: string, metricName: string, value: number }`.
  - Behavior:
    1. Looks up active rules via `RulesRepository.findActiveByDeviceAndMetric(...)`.
    2. For each rule, calls `shouldTriggerRule(rule, value)`.
    3. For every triggered rule:
       - Calls `AlertsRepository.createAlert(...)` with `{ deviceId, metricName, ruleId, value }`.
       - Logs a `warn` event:
         - `msg: "Rule triggered, alert created"`
         - Includes device, metric, ruleId, alertId, value, ruleType.
    4. If alert creation fails:
       - Logs an `error` event with the context and stack trace.
  - This service is **stateless** in terms of rules evaluation (all state is in the DB), simplifying reasoning and testing.

- **Rules HTTP API** (`RulesController`):
  - DTO: `CreateRuleDto` with `class-validator` decorators:
    - `device_id: string` (non-empty, UUID expected at usage sites).
    - `metric_name: string` (non-empty).
    - `rule_type: RuleType` (`MAX | MIN | RANGE`).
    - `min_value?: number`
    - `max_value?: number`
    - `enabled?: boolean` (defaults to `true`).
  - Endpoints:
    - `POST /rules`
      - Accepts a JSON body matching the `CreateRuleDto`.
      - Normalizes `metric_name` to lowercase.
      - Calls `RulesRepository.createRule(...)`.
      - Returns the created `Rule` domain object.
    - `GET /rules/:deviceId`
      - Returns all rules for the given `deviceId` using `RulesRepository.findByDevice(...)`.

This module provides the minimum viable surface to define and inspect rules per device, as required by the design.

### Alerts module (alert lifecycle and API)

The Alerts module implements RF-13 (alert generation), RF-14 (alert status) and RF-15 (alert query surface).

- **Domain model & persistence** (`Alert` entity + `AlertsRepository`):
  - Table `alerts` with fields:
    - `id UUID PRIMARY KEY`
    - `device_id UUID`
    - `metric_name TEXT`
    - `rule_id UUID`
    - `value DOUBLE PRECISION`
    - `status ENUM('ACTIVE','RESOLVED')`
    - `triggered_at TIMESTAMP`
    - `resolved_at TIMESTAMP NULL`
  - `AlertsRepository` uses `pg` `Pool` injected via `ALERTS_PG_POOL`.
  - Main methods:
    - `createAlert({ deviceId, metricName, ruleId, value })`:
      - Generates a UUID `id` in the application layer.
      - Inserts a row with `status = 'ACTIVE'` and `triggered_at = now()`.
      - Returns the created `Alert` domain object.
    - `findByCriteria(criteria)`:
      - Accepts an object with optional filters `{ status, deviceId, metricName, from, to }`.
      - Builds a parameterized `SELECT` with `WHERE` clauses composed from the provided filters.
      - Orders results by `triggered_at DESC`.
    - `findByStatus(status?: AlertStatus)`:
      - Backwards-compatible wrapper that delegates to `findByCriteria({ status })`.
    - `resolveAlert(id: string, resolvedAt: Date = new Date())`:
      - Sets `status = 'RESOLVED'` and `resolved_at = resolvedAt`.
      - Returns the updated alert, or `null` if no alert was found.

- **Alerts HTTP API** (`AlertsController`):
  - Endpoints:
    - `GET /alerts`:
      - Supports the following optional query parameters:
        - `status`: `ACTIVE` | `RESOLVED`.
        - `device_id`: UUID of the device associated with the alert.
        - `metric_name`: metric name associated with the alert.
        - `from`, `to`: ISO-8601 timestamps defining the time range for `triggered_at`.
      - Validates allowed values for `status`.
      - Ensures that, when both `from` and `to` are provided, `from <= to` and both are valid ISO-8601 timestamps.
      - Delegates to `AlertsRepository.findByCriteria(...)`.
      - Returns an array of `Alert` domain objects.
    - `PATCH /alerts/:id/resolve`:
      - Attempts to resolve an alert by ID via `AlertsRepository.resolveAlert(...)`.
      - Returns the updated `Alert` on success.
      - Returns HTTP `404` if no alert with that ID exists.
  - The alerts API is fully documented in Swagger under the `alerts` tag, including query parameters and response schema.

The Alerts module is fully wired into the rules engine (`RulesEngineService` uses `AlertsRepository` directly) and exposes the basic read/resolve operations.

### Auth and Devices modules

- **Auth module**:
  - API Key–based authentication for ingest:
    - `ApiKeyService` checks the configured ingest API key.
    - `ApiKeyAuthGuard` protects the `POST /ingest` endpoint.
  - JWT-based user authentication and authorization (for dashboard / admin APIs) is still pending and reserved for future phases.

- **Devices module**:
  - Implemented as a NestJS module wired into the application with its own repository and controller.
  - Device metadata is persisted in the `devices` table (`id`, `name`, `api_key`, `active`, `created_at`, `updated_at`).
  - HTTP APIs implemented:
    - `GET /devices` → lists all registered devices without exposing API keys.
    - `POST /devices` → registers a new device and returns its `id` and `api_key` (the API key is only returned at creation time and then stored).
  - The ingest pipeline still infers device identity from the `device_id` field/topic and uses a single global ingest API key configured via environment variables; per-device keys are not yet enforced at ingest time.

### HTTP endpoints

Implemented HTTP endpoints at this stage:

- `GET /`  
  Basic banner to confirm the API is running.

- `GET /health`  
  Simple JSON healthcheck with status and timestamp.

- `POST /ingest`  
  Authenticated ingest endpoint (API key) that:
  - Validates payload structure and types.
  - Normalizes metric names and timestamps.
  - Persists readings into `metric_readings`.
  - Triggers rule evaluation for each persisted reading.
  - Returns `200 OK` with `{ "status": "ok", "stored": <number_of_points> }` on success.

- `GET /metrics/:deviceId/:metricName?from=&to=`  
  Read-only metrics endpoint:
  - Returns ordered time-series points for the requested device/metric/time range.
  - Requires valid UUID `deviceId`, non-empty `metricName` and ISO-8601 `from` / `to` with `from <= to`.

- `POST /rules`  
  Creates a new rule for a device/metric (MAX/MIN/RANGE).

- `GET /rules/:deviceId`  
  Lists all rules defined for a given device.

- `GET /alerts`  
  Lists alerts, optionally filtered by:
  - `status` (`ACTIVE` | `RESOLVED`),
  - `device_id` (UUID),
  - `metric_name`,
  - `from` / `to` (ISO-8601 time range on `triggered_at`).

- `PATCH /alerts/:id/resolve`  
  Resolves an alert, changing its status from `ACTIVE` to `RESOLVED`.

- `GET /devices`  
  Returns the list of registered devices without exposing their API keys.

- `POST /devices`  
  Registers a new device and returns its `id` and `api_key`. The API key is generated server-side and only returned in this response.

### Persistence and environment

- **PostgreSQL + TimescaleDB**:
  - Hypertable `metric_readings` as the central time-series storage.
  - Relational tables `rules`, `alerts` and `devices` for the rules/alerts/devices domain.
  - Connection pooling handled by `pg` `Pool` instances in:
    - `TimeseriesStorageService`
    - `RulesRepository`
    - `AlertsRepository`

- **Mosquitto MQTT broker**:
  - Running in Docker (`iot_mqtt`).
  - Configuration, data and logs mounted from the project:
    - `mosquitto/config/mosquitto.conf`
    - `mosquitto/data/`
    - `mosquitto/log/`

### Tooling, tests and CI

- **Tooling**:
  - TypeScript.
  - Jest + ts-jest.
  - ESLint 9 + Prettier.
  - GitHub Actions CI on Node 20:
    - `npm ci`
    - Lint
    - Unit tests
    - E2E tests
    - Build.

- **Unit tests**:
  - `AppService` basic behavior.
  - `IngestService` ingest pipeline behavior (normalization and delegation to storage).
  - `MqttIngestListener` covering:
    - Valid MQTT message (happy path).
    - Invalid JSON payload.
    - Invalid topic.
    - Invalid metrics payload.
  - `RulesEngineService`:
    - `shouldTriggerRule` unit tests for:
      - `MAX` rules (greater than threshold).
      - `MIN` rules (less than threshold).
      - `RANGE` rules (outside `[min, max]`).
      - Null/undefined threshold edge cases.

- **End-to-end tests**:
  - `POST /ingest`:
    - Happy path (valid payload, authenticated) → `200 OK` with `{ "status": "ok", "stored": N }`.
    - Missing API key → `401`.
    - Invalid payload (e.g. empty `metrics`) → `400`.
  - `GET /metrics/:deviceId/:metricName`:
    - Happy path with data in range.
    - Empty result when the range does not contain data.
    - Validation errors for missing or inconsistent `from` / `to`.
  - Full ingest + rules + alerts pipeline:
    - `POST /rules` creates a `MAX` rule for a device/metric.
    - `POST /ingest` sends a metric that violates that rule.
    - `GET /alerts?status=ACTIVE` returns at least one alert matching the device, metric and value.

---

Future phases will extend this document with:

- Device registration and per-device API keys.
- User authentication and authorization (JWT).
- Additional business-level query APIs (devices, rules and alerts filtering, aggregations).
- Observability endpoints (`/metrics` for Prometheus) and more detailed performance considerations.
