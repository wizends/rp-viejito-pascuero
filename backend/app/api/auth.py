from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import select

from app.api.deps import DB, CurrentUser
from app.core.config import get_settings
from app.core.ratelimit import limit_auth
from app.core.security import (
    REFRESH_COOKIE,
    clear_session_cookies,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    set_session_cookies,
    verify_password,
)
from app.models import RefreshToken, User
from app.schemas import LoginIn, RegisterIn, UserOut, UserPatch

router = APIRouter(prefix="/auth", tags=["auth"])

# Hash fijo para igualar el tiempo de respuesta cuando el email no existe.
_DUMMY_HASH = hash_password("duende-de-relleno-123")


def _open_session(db: DB, user: User, response: Response) -> None:
    jti = str(uuid.uuid4())
    db.add(
        RefreshToken(
            id=jti,
            user_id=user.id,
            expires_at=datetime.now(UTC) + timedelta(days=get_settings().refresh_token_days),
        )
    )
    db.commit()
    set_session_cookies(response, create_access_token(user.id), create_refresh_token(user.id, jti))


@router.post(
    "/register", response_model=UserOut, status_code=201, dependencies=[Depends(limit_auth)]
)
def register(body: RegisterIn, db: DB, response: Response) -> User:
    email = body.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese correo ya tiene credencial de ayudante.")
    user = User(
        email=email,
        password_hash=hash_password(body.password),
        display_name=body.display_name.strip(),
    )
    db.add(user)
    db.commit()
    _open_session(db, user, response)
    return user


@router.post("/login", response_model=UserOut, dependencies=[Depends(limit_auth)])
def login(body: LoginIn, db: DB, response: Response) -> User:
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(user.password_hash if user else _DUMMY_HASH, body.password)
    if user is None or not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Correo o contraseña incorrectos.")
    _open_session(db, user, response)
    return user


@router.post("/refresh", response_model=UserOut, dependencies=[Depends(limit_auth)])
def refresh(request: Request, db: DB, response: Response) -> User:
    token = request.cookies.get(REFRESH_COOKIE)
    data = decode_token(token, "refresh") if token else None
    stored = db.get(RefreshToken, data["jti"]) if data else None
    if data is None or stored is None or stored.revoked or stored.user_id != data["sub"]:
        clear_session_cookies(response)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "La sesión expiró.")
    # Rotación: el refresh usado se revoca y se emite uno nuevo.
    stored.revoked = True
    user = db.get(User, data["sub"])
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "La sesión expiró.")
    _open_session(db, user, response)
    return user


@router.post("/logout", status_code=204)
def logout(request: Request, db: DB, response: Response) -> Response:
    token = request.cookies.get(REFRESH_COOKIE)
    data = decode_token(token, "refresh") if token else None
    if data and (stored := db.get(RefreshToken, data["jti"])):
        stored.revoked = True
        db.commit()
    response.status_code = 204
    clear_session_cookies(response)
    return response


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser) -> User:
    return user


@router.patch("/me", response_model=UserOut)
def update_me(body: UserPatch, user: CurrentUser, db: DB) -> User:
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(user, k, v)
    db.commit()
    return user
