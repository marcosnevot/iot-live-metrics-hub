
# Contributing to IoT Live Metrics Hub

Thank you for your interest in contributing to **IoT Live Metrics Hub**. This document describes how we work with Git/GitHub, how to structure changes, and what is expected from contributors.

The goal is to keep the project production‑ready, easy to maintain, and pleasant to work on for everyone.

---

## 1. Ways to contribute

You can contribute in several ways:

- Reporting bugs or suggesting improvements via GitHub issues.
- Improving documentation (README, ARCHITECTURE, comments, examples).
- Adding or improving automated tests.
- Implementing new features or refactors aligned with the existing roadmap.
- Helping with code review and triaging issues (for maintainers).

Before starting a larger change, it is recommended to open an issue or discussion so we can align on scope and approach.

---

## 2. Git workflow

We follow a **lightweight GitHub Flow / trunk‑based** style:

- The `main` branch is kept **stable and deployable**.
- All work happens in short‑lived branches created from `main`.
- Every change is integrated via a **Pull Request (PR)**.
- CI must be green before merging.

### 2.1. Branch naming

Create branches from `main` using one of these prefixes:

- `feature/<short-description>` – new functionality.
- `bugfix/<short-description>` – bug fixes.
- `hotfix/<short-description>` – urgent fixes.
- `chore/<short-description>` – maintenance, dependencies, small cleanups.
- `docs/<short-description>` – documentation‑only changes.

Examples:

```bash
git checkout main
git pull
git checkout -b feature/rules-time-window
```

Use lowercase, hyphen‑separated descriptions that clearly express the intent of the change.

### 2.2. Typical contribution flow

1. **Open an issue** (or comment on an existing one) describing what you want to change and why.
2. **Create a branch** from `main` with one of the prefixes above.
3. **Implement the change** with small, focused commits.
4. **Run checks locally** (lint, unit tests, e2e tests when relevant).
5. **Push the branch** and open a Pull Request against `main`.
6. **Address review comments**, update the PR as needed.
7. Once approved and CI is green, the PR is merged (preferably using **“Squash and merge”**).
8. The branch can be safely deleted after merge.

---

## 3. Commit messages

We use **Conventional Commits** as the standard for commit messages.

### 3.1. Format

The general format is:

```text
<type>(<optional scope>): <short summary>

[optional body]

[optional footer(s)]
```

- Write the summary in **English**, in the **imperative mood**.
- Keep the first line short (ideally up to ~72 characters).
- Use the body to explain **what** changed and **why**, not how.
- Reference issues in the footer when relevant.

### 3.2. Common types

- `feat`: new feature.
- `fix`: bug fix.
- `docs`: documentation only.
- `style`: formatting, no code changes.
- `refactor`: code changes that neither fix a bug nor add a feature.
- `perf`: performance improvements.
- `test`: add or update tests.
- `build`: build system or external dependencies.
- `ci`: CI configuration.
- `chore`: other changes that do not affect src or tests.
- `revert`: revert a previous commit.

### 3.3. Examples

```text
feat(rules): add range rule evaluation

fix(alerts): handle null resolved_at in DTO mapping

docs(readme): document docker-based quickstart

test(ingest): add e2e for mqtt invalid payload
```

Good commit messages make the history easy to understand, review and audit.

---

## 4. Coding standards

### 4.1. Languages and style

The backend is written in **TypeScript** using **NestJS**. Please:

- Keep all code, comments and public API documentation in **English**.
- Follow the existing patterns for modules, services, controllers and DTOs.
- Prefer small, focused functions and classes with clear responsibilities.

Static analysis and formatting are enforced through **ESLint** and the existing project configuration.

Run:

```bash
npm run lint
```

and fix reported issues before opening a PR.

### 4.2. Project structure

The main application code lives under `src/`, organised in NestJS modules:

- `modules/ingest`
- `modules/storage`
- `modules/metrics`
- `modules/rules`
- `modules/alerts`
- `modules/devices`
- `modules/auth`
- `modules/observability`

When adding new functionality, place it in the most appropriate module or create a new module that follows the existing structure and dependency direction. Avoid cyclic dependencies between modules.

If you introduce a new module or make relevant architectural changes, update `ARCHITECTURE.md` accordingly.

---

## 5. Tests

Automated tests are a core part of the project. Every non‑trivial change should be accompanied by tests.

### 5.1. Test types

- **Unit tests** – cover services, pure functions and small units of logic.
- **End‑to‑end tests (e2e)** – cover HTTP APIs and main flows (ingest, metrics, rules, alerts, auth, devices).

### 5.2. Commands

From the project root:

```bash
# Run unit tests
npm test

# Run e2e tests
npm run test:e2e
```

Before submitting a PR, make sure at least:

- `npm run lint`
- `npm test`
- `npm run test:e2e` (when your change affects runtime behaviour)

are all passing locally.

When fixing a bug, try to add a test that reproduces the issue to prevent regressions.

---

## 6. Running the project locally

For local setup and environment details, including Docker‑based PostgreSQL and Mosquitto, please refer to **`README.md`**.

In short, the typical flow is:

1. Configure environment variables from `.env.example`.
2. Start the Docker services (PostgreSQL and MQTT broker).
3. Initialize the database schema.
4. Start the NestJS application with:

   ```bash
   npm run start:dev
   ```

The README contains the authoritative, up‑to‑date instructions. If you notice a discrepancy between the code and the documentation, please open an issue or submit a PR.

---

## 7. Pull Requests

A good PR is small, focused and well‑documented.

### 7.1. PR requirements

Before requesting review, please ensure:

- The PR has a **clear, descriptive title** (you can mirror the main commit message).
- The description includes:
  - A short **summary** of what the change does.
  - The **motivation / context** (why it is needed).
  - A list of **key changes**.
  - A **testing section** describing how you verified the change (commands, manual steps).
- All relevant checks are passing:
  - Lint (`npm run lint`)
  - Unit tests (`npm test`)
  - E2E tests (`npm run test:e2e`) when applicable.
- The PR links any related issues (e.g. `Closes #123`).

### 7.2. Review guidelines

For authors:

- Be open to feedback and iterate on the PR.
- Respond to comments, even when you choose a different approach.
- Avoid force‑pushing on branches that are already under review unless necessary (and coordinate with reviewers if you do).

For reviewers:

- Focus on correctness, security, maintainability and clarity.
- Prefer constructive, specific comments.
- Use “Request changes” only when the PR should not be merged as‑is.

We generally require at least **one approval** and **green CI** before merging into `main`.

---

## 8. CI/CD

The repository includes a GitHub Actions workflow that runs on pushes and pull requests targeting `main` and standard working branches (`feature/*`, `bugfix/*`, `hotfix/*`, `chore/*`).

The pipeline typically runs:

1. Dependency installation (`npm ci`).
2. Lint checks (`npm run lint`).
3. Unit tests (`npm test`).
4. End‑to‑end tests (`npm run test:e2e`).
5. Build (`npm run build`).

PRs should not be merged if any of these checks are failing.

---

## 9. Security and secrets

- Never commit `.env` files or any real credentials, API keys or certificates.
- Use placeholder values in examples and documentation.
- If you suspect a secret has been pushed to the repository:
  - Remove it immediately from the code.
  - Rotate the secret where it is used.
  - Inform the maintainers as soon as possible.

If you are unsure whether something is sensitive, treat it as such and ask before committing.

---

## 10. Releases and versioning

The project uses **semantic versioning (SemVer)** and maintains a `CHANGELOG.md` file.

For maintainers:

- When preparing a new release:
  - Bump the version number (`MAJOR.MINOR.PATCH`).
  - Update `CHANGELOG.md` with the new version and date.
  - Tag the release in Git (`v1.0.0`, `v1.1.0`, etc.).
  - Optionally create a GitHub Release linking to the changelog.

Contributors do not need to modify the version or changelog unless explicitly agreed with the maintainers.

---

## 11. Questions and support

If you are unsure about anything (architecture choices, naming, testing strategy, etc.), please:

1. Check `README.md` and `ARCHITECTURE.md`.
2. Look at existing code and tests for examples.
3. Open an issue or start a discussion in the repository.

Thank you again for helping improve IoT Live Metrics Hub!
