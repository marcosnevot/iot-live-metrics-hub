# Changelog

All notable changes to this project will be documented in this file.

The format follows [Semantic Versioning](https://semver.org/).

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
