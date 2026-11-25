"""Dependencias comunes: usuario actual y helpers de pertenencia."""

from __future__ import annotations

from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.db import get_db
from app.core.security import ACCESS_COOKIE, decode_token
from app.models import Child, Letter, Shipment, Stop, User

DB = Annotated[Session, Depends(get_db)]


def get_current_user(request: Request, db: DB) -> User:
    token = request.cookies.get(ACCESS_COOKIE)
    data = decode_token(token, "access") if token else None
    user = db.get(User, data["sub"]) if data else None
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Necesitas tu credencial de ayudante.")
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]

_NOT_FOUND = "No encontramos eso en el Polo Norte."


def own_child(db: Session, user: User, child_id: str) -> Child:
    child = db.scalar(select(Child).where(Child.id == child_id, Child.user_id == user.id))
    if child is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND)
    return child


def own_letter(db: Session, user: User, letter_id: str) -> Letter:
    letter = db.scalar(
        select(Letter).join(Child).where(Letter.id == letter_id, Child.user_id == user.id)
    )
    if letter is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND)
    return letter


def own_shipment(db: Session, user: User, shipment_id: str) -> Shipment:
    sh = db.scalar(
        select(Shipment).join(Child).where(Shipment.id == shipment_id, Child.user_id == user.id)
    )
    if sh is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND)
    return sh


def own_stop(db: Session, user: User, stop_id: str) -> Stop:
    stop = db.scalar(
        select(Stop).join(Shipment).join(Child).where(Stop.id == stop_id, Child.user_id == user.id)
    )
    if stop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, _NOT_FOUND)
    return stop
