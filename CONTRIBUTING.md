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

## Database migrations

```bash
make migration m="describe the change"   # autogenerate from the models
```

Always read the generated file before committing. Known autogenerate problems:

- Columns using our string enums (ADR 0004) get their CHECK constraint twice. Keep the
  `op.f("ck_...")` one and set `create_constraint=False` on the `sa.Enum`.
- It never writes data migrations (backfills); add those by hand.
- It doesn't compare CHECK constraints, so changes to `models/enums.py` need a
  hand-written migration.

CI applies every migration on PostgreSQL, runs `alembic check`, and downgrades to base.
`tests/test_migrations.py` does the same on SQLite during `make test`, and fails if a
table has an unnamed or duplicated CHECK constraint.

## Tests

- `make test` uses in-memory SQLite. To run against PostgreSQL like CI does:
  `APPLYTRACK_TEST_DATABASE_URL=postgresql+psycopg://... make test`
  (tests marked PostgreSQL-only, such as row locking, run only then).
- Tests use cheap Argon2 settings for speed. Mark a test `@pytest.mark.real_hashing`
  to use the production ones.
- Any warning fails the run. Add an explicit `filterwarnings` entry only for known
  upstream warnings.

## Dependencies and security

- `make audit` checks every locked dependency against known vulnerabilities (CI runs it too).
- Dependabot opens weekly PRs for Python packages, GitHub Actions and the Docker base image.
  Minor and patch updates come grouped; review the changelog for majors.
- GitHub Actions are pinned to full commit SHAs, with the version in a comment. A tag
  can be moved to point at different code, but a SHA can't. Dependabot updates both.
- Report vulnerabilities privately, as described in [SECURITY.md](SECURITY.md).

## Definition of done

- Acceptance criteria met and covered by tests
- Lint, type check and tests pass in CI
- Coverage stays at or above 85%
- Docs updated (README, design doc or a new ADR when a decision changes)
