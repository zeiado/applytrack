"""Write the API's OpenAPI schema, which the web app's typed client is generated from.

Usage: uv run python scripts/export_openapi.py web/openapi.json
CI runs it and fails if the committed file is out of date (make openapi-check).
"""

import json
import sys
from pathlib import Path

from pydantic import SecretStr

from applytrack.core.config import Settings
from applytrack.main import create_app


def main(path: str) -> None:
    # Settings don't change the schema; these just avoid needing a .env file.
    settings = Settings(
        environment="test",
        database_url="sqlite+pysqlite:///:memory:",
        jwt_secret_key=SecretStr("openapi-export-only-not-a-real-secret-123"),
    )
    schema = create_app(settings).openapi()
    schema["info"].pop("version", None)  # changes every release; not part of the contract
    Path(path).write_text(
        json.dumps(schema, indent=2, ensure_ascii=False, sort_keys=True) + "\n", encoding="utf-8"
    )


if __name__ == "__main__":
    main(sys.argv[1])
