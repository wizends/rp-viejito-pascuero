"""Modelos ORM. Todas las entidades cuelgan de User para aislar datos por cuenta."""

from __future__ import annotations

import secrets
import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import (
    Boolean,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base, UTCDateTime


def _uuid() -> str:
    return str(uuid.uuid4())


def _now() -> datetime:
    return datetime.now(UTC)


def _share_code() -> str:
    return secrets.token_urlsafe(12)


class LetterStatus(StrEnum):
    RECIBIDA = "recibida"
    LEYENDO = "leyendo"
    LEIDA = "leida"
    NECESITA_AYUDA = "necesita_ayuda"


class LetterMethod(StrEnum):
    OCR = "ocr"
    IA = "ia"
    MANUAL = "manual"
    ESCRITA = "escrita"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    display_name: Mapped[str] = mapped_column(String(80))
    allow_external_ai: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)

    children: Mapped[list[Child]] = relationship(
        back_populates="user", cascade="all, delete-orphan", order_by="Child.created_at"
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(UTCDateTime())
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class Child(Base):
    __tablename__ = "children"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    nickname: Mapped[str] = mapped_column(String(40))
    age: Mapped[int | None] = mapped_column(Integer, nullable=True)
    avatar: Mapped[str] = mapped_column(String(32), default="duende_rojo")
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)

    user: Mapped[User] = relationship(back_populates="children")
    letters: Mapped[list[Letter]] = relationship(
        back_populates="child", cascade="all, delete-orphan", order_by="Letter.created_at.desc()"
    )
    shipment: Mapped[Shipment | None] = relationship(
        back_populates="child", cascade="all, delete-orphan", uselist=False
    )


class Letter(Base):
    __tablename__ = "letters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    child_id: Mapped[str] = mapped_column(ForeignKey("children.id", ondelete="CASCADE"), index=True)
    source: Mapped[str] = mapped_column(String(16))  # escrita | foto
    status: Mapped[str] = mapped_column(String(20), default=LetterStatus.RECIBIDA.value)
    mensaje: Mapped[str] = mapped_column(Text, default="")
    texto_original: Mapped[str] = mapped_column(Text, default="")
    texto_normalizado: Mapped[str] = mapped_column(Text, default="")
    tono: Mapped[str | None] = mapped_column(String(32), nullable=True)
    confianza: Mapped[float | None] = mapped_column(Float, nullable=True)
    metodo: Mapped[str | None] = mapped_column(String(16), nullable=True)
    pii_masked: Mapped[bool] = mapped_column(Boolean, default=False)
    image_path: Mapped[str | None] = mapped_column(String(255), nullable=True)
    image_deleted_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now, onupdate=_now)

    child: Mapped[Child] = relationship(back_populates="letters")
    gifts: Mapped[list[Gift]] = relationship(
        back_populates="letter", cascade="all, delete-orphan", order_by="Gift.position"
    )


class Gift(Base):
    __tablename__ = "gifts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    letter_id: Mapped[str] = mapped_column(ForeignKey("letters.id", ondelete="CASCADE"), index=True)
    nombre: Mapped[str] = mapped_column(String(120))
    prioridad: Mapped[int | None] = mapped_column(Integer, nullable=True)
    marcado: Mapped[bool] = mapped_column(Boolean, default=False)
    position: Mapped[int] = mapped_column(Integer, default=0)

    letter: Mapped[Letter] = relationship(back_populates="gifts")


class Shipment(Base):
    __tablename__ = "shipments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    child_id: Mapped[str] = mapped_column(
        ForeignKey("children.id", ondelete="CASCADE"), unique=True, index=True
    )
    share_code: Mapped[str] = mapped_column(
        String(32), unique=True, index=True, default=_share_code
    )
    arrival_at: Mapped[datetime] = mapped_column(UTCDateTime())
    created_at: Mapped[datetime] = mapped_column(UTCDateTime(), default=_now)

    child: Mapped[Child] = relationship(back_populates="shipment")
    stops: Mapped[list[Stop]] = relationship(
        back_populates="shipment", cascade="all, delete-orphan", order_by="Stop.position"
    )


class Stop(Base):
    __tablename__ = "stops"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=_uuid)
    shipment_id: Mapped[str] = mapped_column(
        ForeignKey("shipments.id", ondelete="CASCADE"), index=True
    )
    position: Mapped[int] = mapped_column(Integer, default=0)
    nombre: Mapped[str] = mapped_column(String(80))
    icono: Mapped[str] = mapped_column(String(32), default="estrella")
    descripcion: Mapped[str] = mapped_column(String(280), default="")
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    eta: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(UTCDateTime(), nullable=True)
    auto_advance: Mapped[bool] = mapped_column(Boolean, default=False)

    shipment: Mapped[Shipment] = relationship(back_populates="stops")
