# Contributing

## Workflow

1. Pick or open an issue. Each issue has a user story and acceptance criteria.
2. Branch off `main`: `feat/<issue>-short-name`, `fix/<issue>-short-name`, `docs/...`, `chore/...`.
3. Commit using [Conventional Commits](https://www.conventionalcommits.org/):
   `feat(applications): add status transitions`, `fix(auth): reject expired tokens`.
4. Run `make check` before pushing.
5. Open a PR using the template. CI must pass before merging.
6. Squash-merge into `main`. Delete the branch.

## Local setup

```bash
uv sync               # install dependencies
uv run pre-commit install
make test             # run tests
make run              # start the API on http://localhost:8000
```

## Definition of done

- Acceptance criteria met and covered by tests
- Lint, type check and tests pass in CI
- Coverage stays at or above 85%
- Docs updated (README, design doc or a new ADR when a decision changes)
