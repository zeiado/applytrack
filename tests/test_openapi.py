from fastapi.testclient import TestClient


def test_openapi_schema_builds_and_lists_routes(client: TestClient) -> None:
    response = client.get("/openapi.json")

    assert response.status_code == 200
    schema = response.json()
    assert {
        "/health",
        "/ready",
        "/api/v1/auth/register",
        "/api/v1/auth/login",
        "/api/v1/users/me",
    } <= set(schema["paths"])
    # The Authorize button in /docs uses this scheme.
    assert schema["components"]["securitySchemes"]["OAuth2PasswordBearer"]["type"] == "oauth2"
