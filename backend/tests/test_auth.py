from __future__ import annotations

from tests.conftest import Client, make_client, register


def test_register_login_me_logout(client: Client) -> None:
    user = register(client)
    assert user["email"] == "mama@example.com"
    assert "password_hash" not in user
    assert client.get("/api/auth/me").status_code == 200

    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401

    r = client.post(
        "/api/auth/login", json={"email": "MAMA@example.com", "password": "galletas-de-jengibre"}
    )
    assert r.status_code == 200
    assert client.get("/api/auth/me").status_code == 200


def test_cookies_are_httponly(client: Client) -> None:
    r = client.post(
        "/api/auth/register",
        json={
            "email": "papa@example.com",
            "password": "galletas-de-jengibre",
            "display_name": "Papá",
        },
    )
    cookies = r.headers.get_list("set-cookie")
    access = next(c for c in cookies if c.startswith("vp_access="))
    refresh = next(c for c in cookies if c.startswith("vp_refresh="))
    csrf = next(c for c in cookies if c.startswith("vp_csrf="))
    assert "HttpOnly" in access and "HttpOnly" in refresh
    assert "HttpOnly" not in csrf


def test_wrong_password_and_duplicate(client: Client) -> None:
    register(client)
    r = client.post("/api/auth/login", json={"email": "mama@example.com", "password": "nop"})
    assert r.status_code == 401
    r = client.post(
        "/api/auth/register",
        json={"email": "mama@example.com", "password": "galletas-de-jengibre", "display_name": "X"},
    )
    assert r.status_code == 409


def test_short_password_rejected(client: Client) -> None:
    r = client.post(
        "/api/auth/register",
        json={"email": "a@example.com", "password": "corta", "display_name": "A"},
    )
    assert r.status_code == 422


def test_refresh_rotates_and_old_token_is_revoked(client: Client) -> None:
    register(client)
    old = client.cookies.get("vp_refresh")
    assert client.post("/api/auth/refresh").status_code == 200
    new = client.cookies.get("vp_refresh")
    assert new and new != old
    # Reusar el refresh viejo falla.
    with make_client() as other:
        other.cookies.set("vp_refresh", old, path="/api/auth")
        assert other.post("/api/auth/refresh").status_code == 401


def test_csrf_required_for_mutations(client: Client) -> None:
    register(client)
    from fastapi.testclient import TestClient

    from app.main import app

    raw = TestClient(app)
    raw.cookies = client.cookies
    r = raw.post("/api/children", json={"nickname": "Pepe"})
    assert r.status_code == 403
    r = raw.post("/api/children", json={"nickname": "Pepe"}, headers={"X-CSRF-Token": "falso"})
    assert r.status_code == 403


def test_security_headers(client: Client) -> None:
    r = client.get("/api/health")
    assert r.headers["X-Content-Type-Options"] == "nosniff"
    assert r.headers["X-Frame-Options"] == "DENY"


def test_rate_limit_auth(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from app.core.config import get_settings

    monkeypatch.setattr(get_settings(), "rate_limit_auth", 3)
    with make_client() as c:
        codes = [
            c.post("/api/auth/login", json={"email": "x@example.com", "password": "x"}).status_code
            for _ in range(5)
        ]
    assert codes[:3] == [401, 401, 401]
    assert codes[3] == 429


def test_ip_real_detras_de_proxy(monkeypatch):
    """Con TRUST_FORWARDED_FOR la IP sale de X-Forwarded-For (proxy de Vercel); sin él, se ignora."""
    from starlette.requests import Request

    from app.core import ratelimit
    from app.core.config import get_settings

    def req(fwd: str) -> Request:
        return Request({"type": "http", "headers": [(b"x-forwarded-for", fwd.encode())], "client": ("76.76.21.1", 1)})

    s = get_settings()
    monkeypatch.setattr(s, "trust_forwarded_for", False)
    assert ratelimit.client_ip(req("200.1.2.3, 76.76.21.1")) == "76.76.21.1"
    monkeypatch.setattr(s, "trust_forwarded_for", True)
    assert ratelimit.client_ip(req("200.1.2.3, 76.76.21.1")) == "200.1.2.3"
