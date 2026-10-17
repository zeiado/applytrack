import pytest
from fastapi import FastAPI
from sqlalchemy.exc import IntegrityError

from applytrack.core.errors import ConflictError
from applytrack.services.auth import AuthService


def test_register_race_on_unique_email_becomes_conflict(
    app: FastAPI, monkeypatch: pytest.MonkeyPatch
) -> None:
    """If another request inserts the same email between our check and our insert,
    the database's unique constraint wins and we still return a clean 409."""
    with app.state.session_factory() as session:
        service = AuthService(session)

        def fail_flush(_: object) -> None:
            raise IntegrityError("INSERT", {}, Exception("duplicate key"))

        monkeypatch.setattr(service.users, "add", fail_flush)

        with pytest.raises(ConflictError) as exc_info:
            service.register("ada@example.com", "correct-horse")
        assert exc_info.value.code == "email_taken"
