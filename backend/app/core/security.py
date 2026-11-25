"""Hash de contraseñas (argon2), JWT y cookies de sesión con CSRF double-submit."""

from __future__ import annotations

import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Response

from app.core.config import get_settings

ACCESS_COOKIE = "vp_access"
REFRESH_COOKIE = "vp_refresh"
CSRF_COOKIE = "vp_csrf"
CSRF_HEADER = "X-CSRF-Token"
ALGORITHM = "HS256"

_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


def _encode(payload: dict[str, Any], ttl: timedelta) -> str:
    now = datetime.now(UTC)
    body = {**payload, "iat": now, "exp": now + ttl}
    return jwt.encode(body, get_settings().secret_key, algorithm=ALGORITHM)


def create_access_token(user_id: str) -> str:
    return _encode(
        {"sub": user_id, "typ": "access"}, timedelta(minutes=get_settings().access_token_minutes)
    )


def create_refresh_token(user_id: str, jti: str) -> str:
    return _encode(
        {"sub": user_id, "typ": "refresh", "jti": jti},
        timedelta(days=get_settings().refresh_token_days),
    )


def decode_token(token: str, expected_type: str) -> dict[str, Any] | None:
    try:
        data: dict[str, Any] = jwt.decode(token, get_settings().secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    if data.get("typ") != expected_type:
        return None
    return data


def set_session_cookies(response: Response, access: str, refresh: str) -> None:
    s = get_settings()
    common: dict[str, Any] = {"secure": s.cookie_secure, "samesite": s.cookie_samesite}
    response.set_cookie(
        ACCESS_COOKIE,
        access,
        httponly=True,
        max_age=s.access_token_minutes * 60,
        path="/",
        **common,
    )
    response.set_cookie(
        REFRESH_COOKIE,
        refresh,
        httponly=True,
        max_age=s.refresh_token_days * 86400,
        path="/api/auth",
        **common,
    )
    # El token CSRF es legible por JS (no httpOnly) para el patrón double-submit.
    response.set_cookie(
        CSRF_COOKIE,
        secrets.token_urlsafe(24),
        httponly=False,
        max_age=s.refresh_token_days * 86400,
        path="/",
        **common,
    )


def clear_session_cookies(response: Response) -> None:
    response.delete_cookie(ACCESS_COOKIE, path="/")
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")
    response.delete_cookie(CSRF_COOKIE, path="/")
