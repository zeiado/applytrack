from types import SimpleNamespace
from typing import Any, cast

import pytest
from fastapi import Request
from sqlalchemy.orm import Session

from applytrack.db.session import build_engine, build_session_factory, get_db


def _request_for(factory: Any) -> Request:
    return cast(
        Request,
        SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(session_factory=factory))),
    )


def test_get_db_yields_a_session_and_closes_it() -> None:
    factory = build_session_factory(build_engine("sqlite+pysqlite:///:memory:"))
    gen = get_db(_request_for(factory))

    session = next(gen)
    assert isinstance(session, Session)

    with pytest.raises(StopIteration):
        next(gen)


def test_get_db_rolls_back_when_the_request_fails() -> None:
    rolled_back = []

    class FakeSession:
        def __enter__(self) -> "FakeSession":
            return self

        def __exit__(self, *exc: object) -> None:
            return None

        def rollback(self) -> None:
            rolled_back.append(True)

    gen = get_db(_request_for(FakeSession))
    next(gen)

    with pytest.raises(RuntimeError):
        gen.throw(RuntimeError("boom"))
    assert rolled_back == [True]


def test_file_based_sqlite_does_not_use_static_pool(tmp_path: Any) -> None:
    engine = build_engine(f"sqlite+pysqlite:///{tmp_path}/test.db")
    assert type(engine.pool).__name__ != "StaticPool"


def test_utc_datetime_rejects_naive_and_normalizes_to_utc() -> None:
    from datetime import UTC, datetime, timedelta, timezone

    from applytrack.models.base import UTCDateTime

    col = UTCDateTime()
    dialect = build_engine("sqlite+pysqlite:///:memory:").dialect
    cairo = timezone(timedelta(hours=3))

    with pytest.raises(ValueError, match="Naive"):
        col.process_bind_param(datetime(2026, 1, 1), dialect)
    assert col.process_bind_param(None, dialect) is None
    assert col.process_bind_param(datetime(2026, 1, 1, 3, tzinfo=cairo), dialect) == datetime(
        2026, 1, 1, tzinfo=UTC
    )
    assert col.process_result_value(None, dialect) is None
    assert col.process_result_value(datetime(2026, 1, 1), dialect) == datetime(
        2026, 1, 1, tzinfo=UTC
    )
    assert col.process_result_value(datetime(2026, 1, 1, 3, tzinfo=cairo), dialect).tzinfo is UTC  # type: ignore[union-attr]
