import os
from collections.abc import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from applytrack.core.config import Settings
from applytrack.main import create_app
from applytrack.models import Base

# CI sets this to a real PostgreSQL database; locally tests default to in-memory SQLite.
TEST_DATABASE_URL = os.environ.get("APPLYTRACK_TEST_DATABASE_URL", "sqlite+pysqlite:///:memory:")


@pytest.fixture
def settings() -> Settings:
    return Settings(environment="test", database_url=TEST_DATABASE_URL)


@pytest.fixture
def app(settings: Settings) -> Iterator[FastAPI]:
    app = create_app(settings)
    Base.metadata.create_all(app.state.engine)
    yield app
    Base.metadata.drop_all(app.state.engine)


@pytest.fixture
def client(app: FastAPI) -> Iterator[TestClient]:
    with TestClient(app) as c:
        yield c
