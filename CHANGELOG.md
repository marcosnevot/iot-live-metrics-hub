# Changelog

All notable changes to this project will be documented in this file.

The format follows [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2025-11-26

### Added

- Final documentation for the first public release:
  - Polished `ARCHITECTURE.md` so that it reflects the current implementation up to release `0.10.0` and is self-contained, without references to internal design documents.
  - Updated `README.md` to include:
    - A concise project overview and key technical features.
    - A Docker Compose–based quickstart guide for running the backend in local development (environment variables, infrastructure setup and how to run the app).
    - Links to architecture and contribution guidelines.
  - Clarified how to run automated tests (unit and end-to-end) and what the happy path looks like for the main flows (auth, devices, ingest, metrics, rules and alerts).

### Changed

- Changelog and release information:
  - Consolidated `CHANGELOG.md` entries up to `v1.0.0`, aligning wording and dates with the evolution of the codebase.
  - Marked release `0.10.0` as the last pre-1.0.0 technical milestone and `1.0.0` as the first “portfolio-ready” release, with no functional changes compared to `0.10.0`.

- Documentation consistency:
  - Removed remaining references to external “Master Design” documents that were only used during development.
  - Ensured terminology is consistent across `README.md`, `ARCHITECTURE.md` and the HTTP API surface (naming of roles, endpoints and core modules).

## [0.10.0] - 2025-11-26

### Added

- Hardening & QA (F10 – Technical quality pass):
  - Basic rate limiting:
    - Integrated `@nestjs/throttler` in `AppModule` with a global `ThrottlerGuard`.
    - Global defaults configured via environment variables:
      - `RATE_LIMIT_TTL_MS` – time window in milliseconds (default: 60000).
      - `RATE_LIMIT_LIMIT` – max requests per IP in that window (default: 300).
    - Endpoint-specific limits:
      - `POST /auth/login` throttled with a stricter policy (5 requests per minute per IP) to mitigate brute-force attempts.
      - `POST /ingest` throttled with a more permissive policy (120 requests per minute per IP) to guard against abuse while remaining compatible with expected ingest patterns.
  - Additional automated tests:
    - Strengthened unit tests around authentication (valid and invalid credentials, interaction with `JwtService`) and rule evaluation.
    - Extended end-to-end coverage for the ingest, metrics, devices and alerts flows, reusing real devices, rules and alerts created via the HTTP APIs.

### Changed

- Environment & configuration:
  - Normalised the use of authentication-related environment variables so that `.env.example` is the canonical template and `.env` is the only file developers need to edit for local runs.
  - Updated unit and end-to-end tests to set default values for `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ANALYST_USERNAME`, `ANALYST_PASSWORD`, `JWT_SECRET` and `JWT_EXPIRES_IN` in a way that is consistent with `.env.example`, reducing surprises on fresh environments.
  - Application bootstrap now relies on environment variables instead of hard-coded test credentials for authentication-related flows.

- Tooling & CI:
  - Cleaned up remaining ESLint/Prettier warnings (including CRLF-related noise) so that `npm run lint`, `npm test` and `npm run test:e2e` run cleanly in local development.
  - Confirmed that the GitHub Actions workflow continues to run `npm run lint`, `npm test`, `npm test:e2e` and `npm run build` on pushes and pull requests targeting `main` and standard feature/bugfix/hotfix/chore branches.

- Logging & controllers:
  - Performed minor adjustments to structured logs emitted by authentication, ingest, devices and alerts controllers to keep a consistent event shape across modules (`module`, `operation`, `status` and relevant domain identifiers).

## [0.9.0] - 2025-11-25

### Added

- Observability & telemetry (F9 – Logging & Prometheus metrics):
  - `ObservabilityModule` with:
    - `ObservabilityService` owning a dedicated Prometheus `Registry`.
    - `ObservabilityMetricsController` exposing `GET /metrics` in Prometheus text format (not part of the public Swagger surface).
    - `HttpMetricsInterceptor` registered as a global interceptor to record HTTP request metrics.
  - Prometheus metrics:
    - `http_requests_total{method, path, status_code}` for per-route traffic and status codes.
    - `iot_ingest_total{channel, result}` for ingest operations over HTTP and MQTT and their outcome.
    - `iot_alerts_triggered_total{device_id, metric_name, rule_type}` for alerts emitted by the rules engine.
    - `iot_processing_latency_ms{stage="ingest_pipeline"}` for end-to-end ingest pipeline latency.
    - `iot_db_write_latency_ms{operation="insert_readings"}` for database write latency of time-series inserts.
  - Default process and Node.js metrics collected via `prom-client` (`process_*`, `nodejs_*`).

### Changed

- Logging:
  - Enriched structured logs across ingest, rules engine, alerts, auth, devices and metrics modules with consistent fields (`module`, `operation`, `status`, domain identifiers).
  - Updated `LoggerModule` configuration to redact sensitive information from logs:
    - Authorization and API key headers.
    - Cookies.
    - Passwords and token-like fields in request bodies.
- Documentation:
  - `ARCHITECTURE.md` updated to reflect DEC-04 as implemented (JSON logs + Prometheus `/metrics`), including:
    - Observability module and `/metrics` endpoint.
    - Domain-level Prometheus metrics and their label sets.
    - Cardinality control considerations for monitoring.

## [0.8.0] - 2025-11-25

### Added

- Security & Auth Hardening (F8 – Device API keys + JWT for business APIs):
  - JWT-based user authentication:
    - `AuthModule` wiring `JwtModule`, `JwtStrategy`, `JwtAuthGuard`, `RolesGuard` and `Roles` decorator.
    - `POST /auth/login` endpoint:
      - Accepts username/password in JSON (`LoginRequestDto`).
      - Validates credentials against environment-configured users:
        - `ADMIN_USERNAME` / `ADMIN_PASSWORD`
        - `ANALYST_USERNAME` / `ANALYST_PASSWORD`
      - Issues a signed JWT (HS256) with `sub` and `role` claims, using `JWT_SECRET` and `JWT_EXPIRES_IN`.
      - Returns `{ "accessToken": "<jwt>" }`.
  - Role-based protection for business APIs:
    - `JwtAuthGuard` + `RolesGuard` applied to business controllers with `@Roles(...)`:
      - `DevicesController`:
        - `GET /devices` → accessible to `admin` and `analyst`.
        - `POST /devices` → restricted to `admin`.
      - `RulesController`:
        - `POST /rules` → restricted to `admin`.
        - `GET /rules/:deviceId` → restricted to `admin`.
      - `AlertsController`:
        - `GET /alerts` → accessible to `admin` and `analyst`.
        - `PATCH /alerts/:id/resolve` → restricted to `admin`.
      - `MetricsController`:
        - `GET /metrics/:deviceId/:metricName` → accessible to `admin` and `analyst`.
  - Stronger alerts query validation:
    - New `GetAlertsQueryDto` for `GET /alerts` using `class-validator`:
      - `status` validated as `AlertStatus` enum (`ACTIVE` | `RESOLVED`).
      - `device_id` validated as UUID v4.
      - `metric_name` validated as optional string.
      - `from` / `to` validated as ISO-8601 timestamps.
    - Keeps the invariant `from <= to` with a clear `400 Bad Request` when violated.

### Changed

- Device API key management and ingest authentication (F8 – Per-device keys):
  - `Device` domain model updated so the in-memory entity exposes `apiKeyHash` instead of the raw key.
  - `DevicesRepository`:
    - `createDevice(name)`:
      - Generates a high-entropy random API key (`randomBytes(32)`).
      - Computes a SHA-256 hash (`hashDeviceApiKey`) and stores only the hash in `devices.api_key`.
      - Returns `{ device, apiKeyPlain }` so the controller can return the raw key once at creation time.
    - New `findById(id)` method to look up devices by identifier.
  - `DevicesController`:
    - `POST /devices` now uses the `{ device, apiKeyPlain }` return shape:
      - Persists only the hash.
      - Returns the raw API key in `DeviceCreatedResponseDto` once at creation time.
    - `GET /devices` remains read-only and never exposes API keys.
  - Ingest authentication pipeline:
    - `ApiKeyService` reworked to validate per-device API keys instead of a single global `INGEST_API_KEY`:
      - Looks up the device by `device_id` in the `devices` table.
      - Verifies that the device is active.
      - Compares the SHA-256 hash of the provided API key against `devices.api_key`.
      - Supports legacy devices by also accepting a direct match when `devices.api_key` still contains a raw key.
    - `ApiKeyAuthGuard` updated to:
      - Expect `Authorization: Bearer <device_api_key>` header.
      - Read `device_id` from the JSON body.
      - Call `ApiKeyService.validateDeviceApiKey(apiKey, deviceId)` and attach `{ device: { id } }` to the request on success.
    - `POST /ingest` now enforces:
      - A valid device API key bound to the `device_id` present in the payload.
      - Proper `401`/`403` responses for missing/invalid headers or mismatched device/API key pairs.
- Alerts API robustness:
  - `AlertsController` `GET /alerts` refactored to:
    - Use `GetAlertsQueryDto` as the single source of truth for query parameter validation.
    - Rely on DTO-level validation for invalid `status`, malformed UUIDs and malformed timestamps instead of manual checks.
    - Keep the existing `AlertsRepository.findByCriteria({ status, deviceId, metricName, from, to })` contract while improving error reporting.
- Documentation and architecture:
  - `ARCHITECTURE.md` updated to reflect:
    - JWT-based user authentication with `admin` and `analyst` roles and their permissions.
    - Per-device API key hashing strategy (SHA-256) and binding between `device_id` and API key at ingest time.
    - Updated security schemes in the HTTP surface:
      - Bearer JWT for business APIs.
      - Per-device API key for ingest (`Authorization: Bearer <device_api_key>`).

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
