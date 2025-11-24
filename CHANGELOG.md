# Changelog

All notable changes to this project will be documented in this file.

The format follows [Semantic Versioning](https://semver.org/).

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
