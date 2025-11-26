# Portfolio notes – IoT Live Metrics Hub

This document summarises how **IoT Live Metrics Hub** can be presented as a portfolio project in interviews or screening calls.  
It is not part of the runtime system; it is an internal reference for positioning the project and structuring the conversation.

---

## 1. High-level pitch

A concise pitch for the project could be:

> *“IoT Live Metrics Hub is a backend service that ingests IoT telemetry over HTTP and MQTT, stores it as time-series data in PostgreSQL/TimescaleDB, evaluates alert rules in real time, and exposes APIs to query metrics, rules, alerts and devices. It includes structured logging, Prometheus metrics and automated tests, so it looks and behaves like a small production-ready backend.”*

Key elements of this pitch:

- **Real-time ingest** over HTTP and MQTT with a shared pipeline.
- **Time-series storage** using a TimescaleDB hypertable and dedicated indexes.
- A **rules engine** and **alerts lifecycle** (ACTIVE / RESOLVED).
- A simple but solid **security model** with per-device API keys and JWT roles.
- **Observability and QA**: structured JSON logs, Prometheus metrics, lint + unit + e2e tests, and CI.

Depending on the role (backend, IoT, SRE, platform, etc.), the emphasis can shift towards architecture, data modelling, performance, or observability.

---

## 2. Technical selling points

### 2.1. Architecture and data flow

- Modular NestJS monolith with distinct domains:
  - **Ingest**, **storage**, **metrics**, **rules**, **alerts**, **devices**, **auth**, **observability**.
- Typical data flow:
  - A device sends metrics via HTTP or MQTT.
  - The message is normalised and persisted into a **TimescaleDB hypertable**.
  - The rules engine evaluates alert rules for each new reading and creates alerts when thresholds are violated.
  - Business APIs expose metrics, rules, alerts and devices, guarded by JWT-based authentication and roles.
- The modules are structured so that a future extraction into separate services would be straightforward.

### 2.2. Ingest design and latency

- The HTTP ingest endpoint accepts **batches of metrics**, inserting them with a single parameterised SQL statement.
- Rules evaluation happens **after** a successful DB write to avoid losing data if the rules engine fails.
- Prometheus metrics track:
  - Ingest success/failure by channel (`http` / `mqtt`).
  - End-to-end ingest latency.
  - Database write latency for time-series inserts.
- This provides a basis for discussing **latency targets** and how they could be monitored in a production setting.

### 2.3. Rules engine and alerts

- Rules are defined per device + metric with types `MAX`, `MIN` and `RANGE`.
- Rule evaluation is implemented as a **pure function**, which is easy to test and reason about.
- The rules engine service is responsible for orchestration:
  - Loading active rules.
  - Evaluating them for each reading.
  - Creating alerts and logging the outcome.
- Alerts have a clear lifecycle (ACTIVE / RESOLVED) and can be queried with filters (status, device, metric, time range).

### 2.4. Storage and time-series modelling

- Central hypertable: `metric_readings(device_id, metric_name, ts, value)`.
- Index design optimised for:
  - Per-device and per-metric range queries.
  - Global “latest data” queries ordered by time.
- The schema is defined in a single SQL file reused both in local development and CI, which simplifies setup and keeps environments consistent.

### 2.5. Security and authentication

- Devices authenticate with **high-entropy API keys**, and only the **hash** is stored in the database.
- Human users authenticate via **JWT**, with roles such as:
  - `admin` – full management of devices, rules and alerts.
  - `analyst` – read-only access to metrics, devices, rules and alerts.
- Sensitive data is redacted in logs.
- Rate limiting is applied to protect key endpoints:
  - Stricter limits for `POST /auth/login`.
  - More permissive but bounded limits for `POST /ingest`.

### 2.6. Observability and testing

- **Structured JSON logs** with consistent fields (`module`, `operation`, `status`, and domain identifiers).
- **Prometheus metrics** for HTTP traffic, ingest operations, alerts and latency.
- Automated tests include:
  - Unit tests for services and pure logic (e.g. rule evaluation).
  - End-to-end tests that exercise real flows (login → create device → create rule → ingest → query alerts).
- GitHub Actions CI runs lint, unit tests, e2e tests and build on every push and pull request.

These characteristics position the project as more than a simple CRUD API; it behaves like a small, realistic platform service.

---

## 3. Interview narratives

When discussing the project, it is useful to prepare a few short “stories” that illustrate design decisions and trade-offs.

### 3.1. Ingest pipeline and failure handling

- HTTP and MQTT ingest paths are unified in a single service to avoid duplicated logic.
- The system treats a write as successful once the DB insert has completed; any failure in rules evaluation is logged but does not invalidate the ingest.
- Structured logs and Prometheus metrics make it possible to understand where failures occur and how often.
- This narrative highlights robustness, error isolation and observability.

### 3.2. Rules engine design

- Rules are modelled explicitly with a `rules` table and a small set of rule types.
- The decision to use a pure function for evaluation keeps the logic easy to test and extend.
- The engine is intentionally simple in v1 (threshold-based) but leaves room for future extensions such as time windows or aggregations.
- This narrative focuses on **testability**, **extensibility** and keeping the first iteration manageable.

### 3.3. Observability and QA

- From early stages, the project uses structured logging instead of ad-hoc text logs.
- A dedicated observability module exports Prometheus metrics so that traffic and performance can be visualised.
- E2E tests rely on a real database and MQTT broker, closely mirroring real runtime conditions.
- CI runs all checks on every change, enforcing a minimum quality bar.
- This narrative shows an understanding of **operational readiness**.

### 3.4. Security and rate limiting

- Device identity is decoupled from human users through separate authentication mechanisms (API keys vs JWT).
- API keys are generated with high entropy and stored only as hashes.
- Rate limiting is applied where abuse would be most damaging (authentication and ingest).
- Logs are configured to avoid leaking credentials or tokens.
- This narrative underlines **security awareness** and pragmatic controls suitable for a backend service.

### 3.5. Developer experience and maintainability

- Clear modular structure in the codebase makes it straightforward to locate domain-specific logic.
- A single `docker-compose.yml` and a SQL init script keep local and CI environments aligned.
- Documentation (`README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `CONTRIBUTING.md`) is maintained alongside the code.
- Conventional commits and a simple branching strategy support clean history and easy reviews.
- This narrative shows attention to **developer experience** and maintainability over time.

---

## 4. Demo outline

In a live demo (remote or onsite), a short, structured sequence can be:

1. Show the **README** and point out the Docker-based quickstart.
2. Briefly walk through the **architecture**:
   - Modules in `src/modules`.
   - Data flow from ingest to storage to rules/alerts.
3. Open a REST client (Postman, HTTPie, curl) and:
   - Authenticate as `admin` via `POST /auth/login`.
   - Create a device and obtain its API key.
   - Create a simple `MAX` rule for a metric.
   - Ingest a metric that violates the rule using the device API key.
   - Query alerts via `GET /alerts` and show the generated alert.
4. Optionally, display the **Prometheus `/metrics` endpoint** and an example of structured logs.

This demonstration requires only a few minutes and touches on:

- API design and domain modelling.
- Real-time ingest and rule evaluation.
- Observability and testing mindset.

---

## 5. Checklist before sharing the repo

Before sending the repository link in an application or using it in an interview, it is useful to verify:

- The `main` branch builds and the CI pipeline is green.
- The README quickstart works on a clean machine (Docker + Node.js).
- Documentation files (`README.md`, `ARCHITECTURE.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `docs/portfolio-notes.md`) are consistent with the current code.
- There are no real secrets, credentials or sensitive data committed to the repository.

With these points checked, IoT Live Metrics Hub can be confidently presented as a production-inspired backend project that demonstrates skills in architecture, data modelling, security, observability and testing.
