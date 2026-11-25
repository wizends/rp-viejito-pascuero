"""Esquemas Pydantic de entrada y salida."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

AVATARS = (
    "duende_rojo",
    "duende_verde",
    "duende_dorado",
    "reno_canela",
    "reno_nieve",
    "reno_brasita",
)
Avatar = Literal[
    "duende_rojo", "duende_verde", "duende_dorado", "reno_canela", "reno_nieve", "reno_brasita"
]
StopIcon = Literal[
    "carta", "taller", "lupa", "regalo", "trineo", "reno", "montana", "ciudad", "arbol", "estrella"
]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------- Auth ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    display_name: str = Field(min_length=1, max_length=80)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserOut(ORM):
    id: str
    email: str
    display_name: str
    allow_external_ai: bool


class UserPatch(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=80)
    allow_external_ai: bool | None = None


# ---------- Children ----------
class ChildIn(BaseModel):
    nickname: str = Field(min_length=1, max_length=40)
    age: int | None = Field(default=None, ge=1, le=17)
    avatar: Avatar = "duende_rojo"


class ChildPatch(BaseModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=40)
    age: int | None = Field(default=None, ge=1, le=17)
    avatar: Avatar | None = None


class ChildOut(ORM):
    id: str
    nickname: str
    age: int | None
    avatar: str


# ---------- Letters ----------
class GiftIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    prioridad: int | None = Field(default=None, ge=1, le=10)
    marcado: bool = False


class GiftOut(ORM):
    id: str
    nombre: str
    prioridad: int | None
    marcado: bool


class LetterWriteIn(BaseModel):
    child_id: str
    deseos: list[str] = Field(default_factory=list, max_length=20)
    mensaje: str = Field(default="", max_length=4000)

    @field_validator("deseos")
    @classmethod
    def _clean(cls, v: list[str]) -> list[str]:
        return [d.strip()[:120] for d in v if d.strip()]


class LetterPatch(BaseModel):
    texto_original: str | None = Field(default=None, max_length=8000)
    texto_normalizado: str | None = Field(default=None, max_length=8000)
    gifts: list[GiftIn] | None = Field(default=None, max_length=30)


class LetterOut(ORM):
    id: str
    child_id: str
    source: str
    status: str
    mensaje: str
    texto_original: str
    texto_normalizado: str
    tono: str | None
    confianza: float | None
    metodo: str | None
    pii_masked: bool
    has_image: bool
    created_at: datetime
    gifts: list[GiftOut]


# ---------- Shipments ----------
class StopIn(BaseModel):
    nombre: str = Field(min_length=1, max_length=80)
    icono: StopIcon = "estrella"
    descripcion: str = Field(default="", max_length=280)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    eta: datetime | None = None
    auto_advance: bool = False


class StopPatch(BaseModel):
    nombre: str | None = Field(default=None, min_length=1, max_length=80)
    icono: StopIcon | None = None
    descripcion: str | None = Field(default=None, max_length=280)
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    eta: datetime | None = None
    auto_advance: bool | None = None
    completed: bool | None = None


class StopOut(ORM):
    id: str
    position: int
    nombre: str
    icono: str
    descripcion: str
    lat: float | None
    lng: float | None
    eta: datetime | None
    completed_at: datetime | None
    auto_advance: bool


class ShipmentPatch(BaseModel):
    arrival_at: datetime


class StopOrderIn(BaseModel):
    ids: list[str] = Field(max_length=50)


class ShipmentOut(ORM):
    id: str
    child_id: str
    share_code: str
    arrival_at: datetime
    stops: list[StopOut]


class TrackingOut(BaseModel):
    """Vista pública del niño: sin ids internos ni datos del padre."""

    nickname: str
    avatar: str
    arrival_at: datetime
    server_time: datetime
    stops: list[StopOut]
