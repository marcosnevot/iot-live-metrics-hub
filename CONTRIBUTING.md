# Contributing

Thank you for contributing to **IoT Live Metrics Hub**.

## Workflow

1. Open an issue describing the change or bug.
2. Create a branch from `main`:
   - `feature/...`, `bugfix/...`, `hotfix/...` or `chore/...`.
3. Commit using **Conventional Commits** (in English).
4. Open a Pull Request against `main`:
   - Use the PR template.
   - Link the related issues (e.g. `Closes #123`).
5. Wait for review and make any requested changes.
6. Once CI is green and at least one review is approved,
   the PR will be merged using **"Squash and merge"**.

## Commit messages (Conventional Commits)

Examples:

- `feat(ingest): Add HTTP /ingest endpoint`
- `fix(rules): Handle null max_value in range rules`
- `chore(ci): Add Node.js 20 GitHub Actions workflow`

## Code style and tests

- Code style is enforced by ESLint and Prettier (to be configured).
- New code should be covered by unit or e2e tests when applicable.
- Before pushing, run:

    npm run lint
    npm test
