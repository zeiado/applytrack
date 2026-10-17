from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from applytrack.core.config import Settings
from applytrack.main import create_app


@pytest.fixture
def settings() -> Settings:
    return Settings(environment="test")


@pytest.fixture
def client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as c:
        yield c
