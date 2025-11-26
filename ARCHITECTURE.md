# Architecture

## Overview

IoT Live Metrics Hub is a monolithic NestJS backend designed to:

- Ingest IoT metrics over HTTP and MQTT.
- Store readings as time-series in PostgreSQL + TimescaleDB.
- Evaluate simple alert rules (MIN / MAX / RANGE) on each reading.
- Persist alerts with status and lifecycle.
- Expose business APIs for querying metrics, rules, alerts and devices.
- Register devices and provision per-device API keys, using:
  - Strong random API keys generated per device.
  - Hashed storage of API keys in the `devices` table.
  - Binding between `device_id` and API key for ingest.
- Authenticate human users via JWT with simple roles (`admin`, `analyst`) to protect business APIs.
- Provide internal observability via structured JSON logs and a Prometheus `/metrics` endpoint.

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
  - HTTP APIs for listing and creating devices (`GET /devices`, `POST /devices`).
  - Per-device API key provisioning:
    - API keys are generated server-side with high entropy.
    - Only the raw API key is returned once at creation time.
    - The `devices.api_key` column stores a SHA-256 hash of the API key, never the raw value.
  - Business APIs are protected with JWT and role-based access:
    - `GET /devices` is accessible to `admin` and `analyst`.
    - `POST /devices` is restricted to `admin`.

- **Auth module**
  - API Key–based authentication for ingest requests, using per-device API keys:
    - HTTP ingest requires `Authorization: Bearer <device_api_key>` plus a valid `device_id` in the request body.
    - The API key is validated against the hashed value stored in the `devices` table.
    - Legacy devices (created before hashing) are still supported by comparing raw values as a fallback.
  - JWT-based user authentication for business APIs:
    - `POST /auth/login` issues a signed JWT (HS256) using `JWT_SECRET`.
    - Users and roles (`admin`, `analyst`) are configured via environment variables.
    - A `JwtAuthGuard` and `RolesGuard` enforce access control on business endpoints.

- **API documentation**
  - OpenAPI/Swagger documentation exposed at `/docs`, covering App, Ingest, Metrics, Rules, Alerts and Devices APIs.
  - Security schemes:
    - API key scheme for device ingest (`Authorization: Bearer <device_api_key>`).
    - Bearer JWT scheme for business APIs (`Authorization: Bearer <access_token>`).

- **Observability module**
  - Central Prometheus registry and metrics definitions.
  - Global HTTP metrics interceptor that records per-route traffic and status codes.
  - `/metrics` endpoint for Prometheus scraping, exposing both Node.js default metrics and domain-specific metrics (ingest, alerts, latencies).

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

## Implementation status (release 1.0.0 – stable: HTTP & MQTT ingest, time-series storage, rules engine & alerts, business APIs & Swagger, security, observability and hardening & QA)

At this stage, the backend implements the following:

### Core application and infrastructure

- NestJS application bootstrap:
  - `src/main.ts` with an HTTP server on port 3000.
  - Global `ValidationPipe` for DTO-based request validation (`whitelist`, `forbidNonWhitelisted`, implicit conversion).
  - Application logging wired through `nestjs-pino` as the main logger, emitting structured JSON logs with module/operation fields and redaction of sensitive data (authorization headers, API keys, cookies and passwords).
  - Core Nest module wiring in `src/app.module.ts`.

- API documentation:
  - `@nestjs/swagger` + `swagger-ui-express` configured in `src/main.ts`.
  - OpenAPI document exposed at `GET /docs` with tags for App, Ingest, Metrics, Rules, Alerts and Devices.
  - API key security scheme (`api-key`) configured for ingest endpoints.

- Environment and configuration:
  - Database and ingest configuration driven by environment variables:
    - `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
    - `MQTT_BROKER_URL` (optional; defaults to `mqtt://127.0.0.1:1883` in local dev).
  - Device authentication configuration:
    - Per-device API keys are stored hashed in the `devices` table; there is no longer a single global ingest API key.
  - User authentication configuration (JWT):
    - `JWT_SECRET` – secret used to sign JWTs (HS256).
    - `JWT_EXPIRES_IN` – token lifetime (e.g. `1h`).
    - `ADMIN_USERNAME`, `ADMIN_PASSWORD` – credentials for the admin user.
    - `ANALYST_USERNAME`, `ANALYST_PASSWORD` – credentials for the analyst user.
  - Environment variable loading:
    - Configuration is loaded via `dotenv` from a local `.env` file at application bootstrap (see `main.ts`).
    - .env.example provides documented local-development defaults; the real .env file is excluded from version control so that real credentials are never committed to the repository.

### Rate limiting and abuse protection

- Global throttling:
  - The backend uses `@nestjs/throttler` with a global `ThrottlerGuard` to limit the number of requests per IP.
  - Global defaults are configured via environment variables:
    - `RATE_LIMIT_TTL_MS` – time window in milliseconds (default: 60000).
    - `RATE_LIMIT_LIMIT` – maximum number of requests per IP within that window (default: 300).
- Endpoint-specific policies:
  - `POST /auth/login` has a stricter policy (around 5 login attempts per minute per IP) to mitigate credential stuffing and brute-force attacks.
  - `POST /ingest` has a more permissive policy (around 120 requests per minute per IP) to support normal device traffic while still protecting against abuse.

### Ingest module

- **HTTP ingest** (`IngestModule` + `IngestController` + `IngestService`):
  - Production-grade HTTP endpoint POST /ingest that accepts device-authenticated metric batches and persists them into the time-series store.
  - Request/response contracts modeled with DTOs (`IngestRequestDto`, `MetricDto`) and validated via `class-validator` / `class-transformer`.
  - Device-side API key authentication for ingest using `ApiKeyAuthGuard` + `ApiKeyService`, expecting:
    - `Authorization: Bearer <device_api_key>` header.
    - A valid `device_id` field in the JSON body.
  - `ApiKeyService` validates the API key by:
    - Looking up the device by `device_id` in the `devices` table.
    - Verifying that the device is active.
    - Comparing the SHA-256 hash of the provided API key against the stored `devices.api_key` value, with a fallback to plain-text comparison for legacy rows.
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

The Rules module implements the data model and runtime behavior for defining threshold rules and evaluating them automatically on each new metric.

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

The Alerts module covers alert generation, alert lifecycle (ACTIVE / RESOLVED) and a query surface for active and historical alerts.

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
    - `GET /alerts`
      - Protected with JWT and roles:
        - Accessible to `admin` and `analyst`.
      - Uses a dedicated query DTO `GetAlertsQueryDto` with `class-validator` to validate filters:
        - `status`: `ACTIVE` | `RESOLVED` (enum).
        - `device_id`: UUID v4.
        - `metric_name`: optional string.
        - `from`, `to`: ISO-8601 timestamps.
      - Ensures that, when both `from` and `to` are provided, `from <= to`.
      - Delegates to `AlertsRepository.findByCriteria(...)`.
      - Returns an array of `Alert` domain objects ordered by `triggered_at DESC`.
    - `PATCH /alerts/:id/resolve`:
      - Attempts to resolve an alert by ID via `AlertsRepository.resolveAlert(...)`.
      - Returns the updated `Alert` on success.
      - Returns HTTP `404` if no alert with that ID exists.
      - Protected with JWT; only users with the `admin` role are allowed to resolve alerts.
  - The alerts API is fully documented in Swagger under the `alerts` tag, including query parameters and response schema.

The Alerts module is fully wired into the rules engine (`RulesEngineService` uses `AlertsRepository` directly) and exposes the basic read/resolve operations.

### Auth and Devices modules

- **Auth module**:
  - Provides two authentication mechanisms:
    - Device authentication for ingest:
      - `ApiKeyService` validates per-device API keys against the `devices` table.
      - `ApiKeyAuthGuard` protects `POST /ingest`, enforcing:
        - `Authorization: Bearer <device_api_key>` header.
        - A valid `device_id` in the request body that matches an active device.
    - User authentication for business APIs:
      - `AuthController` exposes `POST /auth/login`, which:
        - Accepts username/password credentials.
        - Validates them against in-memory users configured via:
          - `ADMIN_USERNAME`, `ADMIN_PASSWORD`
          - `ANALYST_USERNAME`, `ANALYST_PASSWORD`
        - Issues a signed JWT (`HS256`) using `JWT_SECRET` and `JWT_EXPIRES_IN`.
      - `JwtStrategy` decodes and validates incoming tokens, attaching a user object (username + role) to the request.
      - `JwtAuthGuard` and `RolesGuard` work together to protect business endpoints by role.
  - Roles:
    - `admin`:
      - Full access to device management, rule creation and alert resolution.
    - `analyst`:
      - Read-only access to devices, rules, alerts and metrics.

- **Devices module**:
  - Implemented as a NestJS module wired into the application with its own repository and controller.
  - Device metadata is persisted in the `devices` table (`id`, `name`, `api_key`, `active`, `created_at`, `updated_at`), where:
    - `api_key` stores a SHA-256 hash of the device API key for security reasons.
  - HTTP APIs implemented:
    - `GET /devices`
      - Lists all registered devices in a `DeviceResponseDto[]`.
      - Does not expose any API key.
      - Protected with JWT; accessible to `admin` and `analyst`.
    - `POST /devices`
      - Registers a new device from a validated `CreateDeviceDto`.
      - Generates a random API key, stores its hash and returns the raw API key once in a `DeviceCreatedResponseDto`.
      - Protected with JWT; restricted to `admin`.
  - The ingest pipeline identifies the device using the `device_id` present in the payload (or MQTT topic) and validates the API key against the stored hash in the `devices` table.

### HTTP endpoints

Implemented HTTP endpoints at this stage:

- `GET /`
  Basic banner to confirm the API is running.

- `GET /health`
  Simple JSON healthcheck with status and timestamp.

- `POST /auth/login`
  - Accepts username and password in JSON format.
  - Validates credentials against environment-configured users:
    - `ADMIN_USERNAME` / `ADMIN_PASSWORD`
    - `ANALYST_USERNAME` / `ANALYST_PASSWORD`
  - On success, returns a signed JWT:
    ```json
    {
      "accessToken": "<jwt>"
    }
    ```
  - This token must be sent in the `Authorization: Bearer <accessToken>` header to access protected business APIs.

- `POST /ingest`
  - Device-authenticated ingest endpoint using per-device API keys.
  - Requires:
    - Header: `Authorization: Bearer <device_api_key>`
    - Body: `device_id` matching an active device plus a non-empty `metrics` array.
  - Validates payload structure and types.
  - Normalizes metric names and timestamps.
  - Persists readings into `metric_readings`.
  - Triggers rule evaluation for each persisted reading.
  - Returns `201 Created` with `{ "status": "ok", "stored": <number_of_points> }` on success.

- `GET /metrics/:deviceId/:metricName?from=&to=`
  - Read-only metrics endpoint protected with JWT (accessible to `admin` and `analyst`).
  - Returns ordered time-series points for the requested device/metric/time range.
  - Requires:
    - `deviceId` as a valid UUID v4.
    - Non-empty `metricName`.
    - ISO-8601 `from` / `to` with `from <= to`.

- `POST /rules`
  - Protected with JWT; restricted to `admin`.
  - Creates a new rule for a device/metric (MAX/MIN/RANGE) from a validated `CreateRuleDto`.
  - Normalizes metric names to lowercase.
  - Persists the rule in the `rules` table.

- `GET /rules/:deviceId`
  - Protected with JWT; restricted to `admin`.
  - Lists all rules defined for a given `deviceId` using `RulesRepository.findByDevice(...)`.

- `GET /alerts`
  - Protected with JWT; accessible to `admin` and `analyst`.
  - Lists alerts, optionally filtered by:
    - `status` (`ACTIVE` | `RESOLVED`),
    - `device_id` (UUID v4),
    - `metric_name`,
    - `from` / `to` (ISO-8601 time range on `triggered_at`).
  - Uses `GetAlertsQueryDto` for robust query parameter validation.
  - Returns alerts ordered by `triggered_at DESC`.

- `PATCH /alerts/:id/resolve`
  - Protected with JWT; restricted to `admin`.
  - Resolves an alert, changing its status from `ACTIVE` to `RESOLVED`.
  - Returns the updated alert on success or `404` if the alert does not exist.

- `GET /devices`
  - Protected with JWT; accessible to `admin` and `analyst`.
  - Returns the list of registered devices without exposing their API keys.

- `POST /devices`
  - Protected with JWT; restricted to `admin`.
  - Registers a new device and returns its `id` and raw `api_key` once at creation time.

### Observability (logging and metrics)

- **Structured logging**
  - All modules use the NestJS logger, which is wired to `nestjs-pino`.
  - Logs are emitted as JSON and include `module`, `operation`, `status` and domain-specific fields (deviceId, metricName, metricsCount, etc.) to facilitate querying in log aggregation systems.
  - Sensitive information is redacted at the logger configuration level:
    - `Authorization` headers (including bearer tokens and device API keys).
    - `x-api-key` headers.
    - Cookies.
    - Passwords and token-like fields in request bodies.

- **Prometheus `/metrics` endpoint**
  - Technical endpoint `GET /metrics` exposed for Prometheus scraping (not included in the public Swagger).
  - Implemented via an `ObservabilityModule` that owns:
    - `ObservabilityService` (Prometheus `Registry` and metric definitions).
    - `ObservabilityMetricsController` (`GET /metrics`).
    - `HttpMetricsInterceptor` (global interceptor that records HTTP traffic).
  - Default Node/Process metrics are collected via `prom-client` (`process_*`, `nodejs_*` families).

- **Domain-specific metrics**
  - `http_requests_total{method, path, status_code}` – total number of HTTP requests, split by HTTP method, logical path and status code.
  - `iot_ingest_total{channel, result}` – ingest operations by channel (`http`/`mqtt`) and result (`success`/`error`).
  - `iot_alerts_triggered_total{device_id, metric_name, rule_type}` – alerts generated by the rules engine per device, metric name and rule type.
  - `iot_processing_latency_ms{stage="ingest_pipeline"}` – end-to-end ingest pipeline latency in milliseconds.
  - `iot_db_write_latency_ms{operation="insert_readings"}` – database write latency in milliseconds for time-series writes.

- **Cardinality controls**
  - Label sets are intentionally small and controlled:
    - `path` uses the NestJS route pattern (e.g. `/ingest`, `/metrics/:deviceId/:metricName`) rather than the full URL.
    - `device_id` is limited to actual devices that trigger alerts.
    - `metric_name` and `rule_type` are normalized and constrained.
  - This allows dashboards and alerts to be built without excessive time-series cardinality.

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
  - The Hardening & QA release consolidates this toolchain and enforces green CI (lint + unit + e2e) on every push to main and feature branches.

- **Unit tests**:
  - `AppService` basic behavior.
  - `IngestService` ingest pipeline behavior (normalization and delegation to storage), including error propagation.
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
  - `AuthService`:
    - Successful login with valid admin credentials.
    - Successful login with valid analyst credentials.
    - Invalid credentials (wrong username, wrong password, mismatched username/password) returning `UnauthorizedException`.

- **End-to-end tests**:
  - `POST /ingest`:
    - Happy path (valid payload, authenticated with a real device API key) → `201 Created` with `{ "status": "ok", "stored": N }`.
    - Missing API key → `401`.
    - Invalid payload (e.g. empty `metrics`) → `400`.
  - `GET /metrics/:deviceId/:metricName`:
    - Happy path with data in range.
    - Empty result when the range does not contain data.
    - Validation errors for missing or inconsistent `from` / `to`.
  - Full ingest + rules + alerts pipeline:
    - `POST /auth/login` obtains an admin JWT from environment-configured credentials.
    - `POST /devices` (admin JWT) creates a device and returns its raw `api_key`.
    - `POST /rules` (admin JWT) creates a `MAX` rule for the device/metric.
    - `POST /ingest` (device API key) sends a metric that violates that rule.
    - `GET /alerts?status=ACTIVE` (admin JWT) returns at least one alert matching device, metric and value.

---

---
Future releases may extend this document with:

- More detailed performance considerations and SLOs based on Prometheus metrics and load-testing results.
- Additional security and robustness improvements (for example, richer validation rules and more advanced alert de-duplication or aggregation strategies) if required by real-world usage.
- Further documentation polish, extra examples and operational runbooks tailored to production deployments.
