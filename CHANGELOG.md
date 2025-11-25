# Changelog

All notable changes to this project will be documented in this file.

The format follows [Semantic Versioning](https://semver.org/).

## [0.7.0] - 2025-11-24

### Added

- Business APIs & Swagger (F7 – Business APIs & API documentation):
  - Devices domain and storage:
    - `devices` table in PostgreSQL for device catalog and per-device API keys:
      - `id UUID PRIMARY KEY`, `name TEXT`, `api_key TEXT`,
        `active BOOLEAN`, `created_at TIMESTAMPTZ`, `updated_at TIMESTAMPTZ`.
    - `DevicesRepository` using `pg.Pool` and generating UUIDs and strong API keys
      in the application layer.
    - `DevicesModule` and `DevicesController` with:
      - `GET /devices` to list all registered devices without exposing API keys.
      - `POST /devices` to register a new device and return its `id` and `api_key`
        (API key is only returned at creation time).
  - API documentation with Swagger / OpenAPI:
    - `@nestjs/swagger` + `swagger-ui-express` configured in `main.ts`.
    - HTTP API documentation exposed at `GET /docs`.
    - Tags defined for `App`, `Ingest`, `Metrics`, `Rules`, `alerts` and `devices`.
    - DTOs and response schemas documented for:
      - Root and health endpoints (`GET /`, `GET /health`).
      - Ingest (`POST /ingest`).
      - Metrics (`GET /metrics/:deviceId/:metricName`).
      - Rules (`POST /rules`, `GET /rules/:deviceId`).
      - Alerts (`GET /alerts`, `PATCH /alerts/:id/resolve`).
      - Devices (`GET /devices`, `POST /devices`).

### Changed

- Alerts query surface (F7 – Alerts filters):
  - `AlertsRepository` now exposes a `findByCriteria({ status, deviceId, metricName, from, to })`
    method that builds a parameterized query with optional filters and orders results
    by `triggered_at DESC`.
  - `findByStatus(status?: AlertStatus)` is now a thin wrapper around `findByCriteria`
    to keep backwards compatibility.
  - `AlertsController` `GET /alerts` extended to support optional filters:
    - `status` (`ACTIVE` | `RESOLVED`),
    - `device_id` (UUID),
    - `metric_name`,
    - `from` / `to` (ISO-8601 range on `triggered_at`),
    with validation for allowed values and consistent time ranges.
- Metrics API:
  - `MetricsController` response for `GET /metrics/:deviceId/:metricName?from=&to=`
    is now explicitly modeled and documented in Swagger as:
    - `{ "device_id", "metric_name", "points": [{ "ts", "value" }] }`,
    without changing the existing behavior.
- Documentation and architecture:
  - `ARCHITECTURE.md` updated to include:
    - Devices module as implemented (table, repository and HTTP APIs).
    - Extended alerts query capabilities with filters.
    - Presence of the Swagger/OpenAPI surface (`GET /docs`) and the `api-key`
      security scheme for ingest.

## [0.6.0] - 2025-11-24

### Added

- Rules Engine & Alerts (F6 – Rules Engine):
  - `rules` table in PostgreSQL for rule definitions:
    - `id UUID PRIMARY KEY`, `device_id UUID`, `metric_name TEXT`,
      `rule_type ENUM('MAX','MIN','RANGE')`, `min_value`, `max_value`,
      `enabled`, `created_at`.
  - `alerts` table in PostgreSQL for triggered alerts:
    - `id UUID PRIMARY KEY`, `device_id UUID`, `metric_name TEXT`,
      `rule_id UUID`, `value`, `status ENUM('ACTIVE','RESOLVED')`,
      `triggered_at`, `resolved_at`.
  - `RulesRepository` and `AlertsRepository` using `pg.Pool` and generating UUIDs
    in the application layer for `id`.
  - `RulesEngineService` with:
    - Pure function `shouldTriggerRule(rule, value)` implementing MAX / MIN / RANGE semantics.
    - `evaluateForMetric({ deviceId, metricName, value })` that:
      - Loads active rules for the given device + metric.
      - Evaluates each rule.
      - Creates `ACTIVE` alerts via `AlertsRepository` for every triggered rule.
      - Logs `Rule triggered, alert created` at `warn` level.
  - HTTP APIs:
    - `POST /rules` to create rules for a given device and metric.
    - `GET /rules/:deviceId` to list rules per device.
    - `GET /alerts?status=ACTIVE|RESOLVED` to list alerts, optionally filtered by status.
    - `PATCH /alerts/:id/resolve` to resolve an alert and mark it as `RESOLVED`.
  - Automated tests:
    - Unit tests for `shouldTriggerRule` covering MAX, MIN, RANGE and null/edge cases.
    - End-to-end test for the full pipeline:
      - `POST /rules` creates a MAX rule.
      - `POST /ingest` sends a metric that violates the rule.
      - `GET /alerts?status=ACTIVE` returns at least one matching alert.

### Changed

- Time-series storage and ingest pipeline:
  - `TimeseriesStorageService.insertReadings(...)` now triggers the rules engine
    **after** successfully inserting readings into the `metric_readings` hypertable:
    - For each reading, it builds a `MetricEvaluationContext` and calls
      `RulesEngineService.evaluateForMetric(...)`.
    - Any error in rule evaluation or alert creation is logged as
      `rules_engine_evaluation_error` but does not fail the ingest request.
  - `StorageModule` now imports `RulesModule` so that `TimeseriesStorageService`
    can inject and use `RulesEngineService`.

## [0.5.0] - 2025-11-24

### Added

- Time-series query surface (F5 – Time-Series Storage):
  - `MetricsModule` and `MetricsController` exposing the read-only endpoint:
    - `GET /metrics/:deviceId/:metricName?from=&to=` for querying time-series data by device, metric and time range.
  - HTTP response contract for metrics queries:
    ```json
    {
      "device_id": "<uuid>",
      "metric_name": "<metric>",
      "points": [
        { "ts": "<ISO-8601>", "value": 27.5 }
      ]
    }
    ```
  - `TimeseriesStorageService.getReadingsForDeviceMetric(deviceId, metricName, from, to)` to retrieve ordered time-series points from the database.

- Automated tests:
  - End-to-end tests for `GET /metrics/:deviceId/:metricName` covering:
    - Happy path with data in the requested time range.
    - Empty result set when the range does not contain data.
    - Validation errors for missing or inconsistent `from` / `to` parameters.

### Changed

- Storage / PostgreSQL + TimescaleDB:
  - Converted the `metric_readings(device_id, metric_name, ts, value)` table into a TimescaleDB hypertable partitioned on `ts`.
  - Added dedicated indexes on `(device_id, metric_name, ts DESC)` and on `(ts DESC)` to optimize device/metric range queries and global time-based queries.
  - Kept the existing ingest pipeline (HTTP + MQTT) writing into `metric_readings` without contract changes, ensuring compatibility with previous phases.

## [0.4.0] - 2025-11-24

### Added

- MQTT ingest pipeline (F4 – MQTT ingest):
  - `MqttIngestListener` connecting to the Eclipse Mosquitto broker and subscribing to the `devices/{deviceId}/metrics` topic pattern with QoS 1.
  - Transformation of MQTT messages into `IngestRequestDto` instances and delegation to `IngestService` so HTTP and MQTT share the same ingest pipeline.
  - Basic validation of MQTT messages: topic shape, JSON parsing, non-empty `metrics` array, and per-metric shape validation (`name: string`, `value: number`, optional `ts: string`).

- Logging and observability:
  - Channel-aware ingest logging via an optional context parameter in `IngestService.ingest` (`channel = "http" | "mqtt"`).
  - Structured MQTT-specific log events: `mqtt_message_received`, `mqtt_invalid_json`, `mqtt_unexpected_topic`, `mqtt_invalid_payload`, `mqtt_invalid_metric`, `mqtt_ingest_success`, `mqtt_ingest_error`.

- Automated tests:
  - Unit tests for `MqttIngestListener` covering: valid message (happy path), invalid JSON payload, invalid topic and invalid metrics payload.

### Changed

- `IngestService`:
  - Extended the `ingest` method signature to accept an optional context object with the ingest channel, without changing the existing HTTP contract or public API.

## [0.3.0] - 2025-11-24

### Added

- HTTP ingest pipeline (F3 – HTTP ingest):
  - `POST /ingest` endpoint with DTOs and validation using `class-validator` / `class-transformer` and a global `ValidationPipe`.
  - Basic API key authentication (`Authorization: Bearer <INGEST_API_KEY>`) via `ApiKeyAuthGuard` and `ApiKeyService`.
  - PostgreSQL integration through `TimeseriesStorageService` and the `metric_readings` table for time-series readings.
  - Structured logging with `nestjs-pino`, including domain events `ingest_success` and `ingest_db_error`.

- Automated tests:
  - Unit tests for `IngestService`.
  - End-to-end tests for `POST /ingest` (happy path, missing API key, and invalid payload).

- Environment-based configuration:
  - Support for `INGEST_API_KEY`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` in the ingest pipeline.

### Changed

- Application bootstrap:
  - Updated `main.ts` to use a global `ValidationPipe` and the Pino-based logger.
  - Updated `AppModule` to register `LoggerModule` from `nestjs-pino` and the existing domain modules.

## [0.2.0] - 2025-11-23

### Added

- NestJS application bootstrap:
  - `src/main.ts`, `src/app.module.ts`, `src/app.controller.ts`, `src/app.service.ts`.
  - Basic HTTP endpoints: `GET /` and `GET /health`.
- Initial module skeletons under `src/modules/`:
  - `ingest`, `storage`, `rules`, `alerts`, `devices`, `auth` as empty NestJS modules.
- Tooling and configs:
  - TypeScript compiler configuration (`tsconfig.json`, `tsconfig.build.json`).
  - Nest CLI configuration (`nest-cli.json`).
  - Jest configuration (`jest.config.cjs`, `test/jest-e2e.json`).
  - ESLint 9 flat config with Prettier integration (`eslint.config.cjs`).
- Basic automated tests:
  - Unit test for `AppService` (`src/app.service.spec.ts`).

### Changed

- CI pipeline (`.github/workflows/ci.yml`):
  - Uses Node.js 20 with npm cache.
  - Installs dependencies with `npm ci`.
  - Runs `npm run lint`, `npm test` and `npm run build` on pushes and pull requests.

## [0.1.0] - 2025-11-22

### Added

- Initial repository structure (F1 – Repository setup).
- Base documentation files: README, ARCHITECTURE, CONTRIBUTING.
- Minimal CI pipeline for lint and test stubs.
