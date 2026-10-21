"""Run the real Alembic migrations, so problems show up locally and not just in CI."""

from collections import Counter
from collections.abc import Iterator
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture
def alembic_config(tmp_path: Path) -> Iterator[tuple[Config, str]]:
    url = f"sqlite:///{tmp_path / 'migrations.db'}"
    config = Config(str(ROOT / "alembic.ini"))
    config.set_main_option("script_location", str(ROOT / "migrations"))
    config.set_main_option("sqlalchemy.url", url)
    yield config, url


def test_upgrade_downgrade_round_trip(alembic_config: tuple[Config, str]) -> None:
    config, url = alembic_config

    command.upgrade(config, "head")
    command.check(config)  # models and migrations agree
    command.downgrade(config, "base")
    command.upgrade(config, "head")

    engine = create_engine(url)
    tables = set(inspect(engine).get_table_names())
    engine.dispose()
    expected = {"users", "applications", "status_changes", "interviews", "refresh_tokens", "jobs"}
    assert expected <= tables


def test_check_constraints_are_named_and_not_duplicated(alembic_config: tuple[Config, str]) -> None:
    """Autogenerate writes enum CHECK constraints twice (see CONTRIBUTING.md). Catch it here."""
    config, url = alembic_config
    command.upgrade(config, "head")

    engine = create_engine(url)
    inspector = inspect(engine)
    problems = []
    for table in inspector.get_table_names():
        constraints = inspector.get_check_constraints(table)
        unnamed = [c["sqltext"] for c in constraints if not (c["name"] or "").startswith("ck_")]
        duplicated = [t for t, n in Counter(c["sqltext"] for c in constraints).items() if n > 1]
        problems += [f"{table}: unnamed {t}" for t in unnamed]
        problems += [f"{table}: duplicated {t}" for t in duplicated]
    engine.dispose()

    assert problems == []
