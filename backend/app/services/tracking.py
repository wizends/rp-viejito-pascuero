"""Lógica del trayecto del regalo: plantillas, serialización y auto-avance."""

from __future__ import annotations

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import Child, Shipment, Stop
from app.schemas import ShipmentOut, StopOut, TrackingOut
from app.ws.hub import hub

log = logging.getLogger(__name__)

# (nombre, icono, descripción, lat, lng, horas antes de la llegada)
TEMPLATES: list[tuple[str, str, str, float | None, float | None, float]] = [
    (
        "Carta recibida en el Polo Norte",
        "carta",
        "Tu carta llegó al buzón del taller.",
        None,
        None,
        240,
    ),
    (
        "Duendes fabricando tu regalo",
        "taller",
        "Martillos, pegamento y mucha risa.",
        None,
        None,
        168,
    ),
    (
        "Control de calidad de los duendes",
        "lupa",
        "Lo revisan tres veces con lupa.",
        None,
        None,
        72,
    ),
    ("Envuelto con cinta dorada", "regalo", "Papel brillante y un moño gigante.", None, None, 30),
    ("Cargado en el trineo", "trineo", "Bien amarrado para que no se caiga.", None, None, 12),
    ("Los renos calientan motores", "reno", "Avena mágica y estiramientos.", None, None, 6),
    (
        "Sobrevolando la Cordillera de los Andes",
        "montana",
        "¡Qué frío hace allá arriba!",
        -27.1,
        -68.5,
        2,
    ),
    ("Llegando a tu ciudad", "ciudad", "Ya se ven las luces de las casas.", -33.45, -70.66, 0.5),
    ("¡Bajo el árbol!", "arbol", "El regalo te espera. ¡Feliz Navidad!", None, None, 0),
]


def default_arrival(now: datetime | None = None) -> datetime:
    """Medianoche entre el 24 y el 25 de diciembre (Nochebuena), hora de Chile."""
    tz = ZoneInfo(get_settings().timezone)
    now = (now or datetime.now(UTC)).astimezone(tz)
    year = now.year if (now.month, now.day) <= (12, 25) else now.year + 1
    return datetime(year, 12, 25, 0, 0, tzinfo=tz)


def get_or_create_shipment(db: Session, child: Child) -> Shipment:
    if child.shipment is None:
        child.shipment = Shipment(arrival_at=default_arrival())
        db.commit()
        db.refresh(child)
    assert child.shipment is not None
    return child.shipment


def add_templates(db: Session, sh: Shipment) -> None:
    start = len(sh.stops)
    for i, (nombre, icono, desc, lat, lng, hours) in enumerate(TEMPLATES):
        sh.stops.append(
            Stop(
                position=start + i,
                nombre=nombre,
                icono=icono,
                descripcion=desc,
                lat=lat,
                lng=lng,
                eta=_aware(sh.arrival_at) - timedelta(hours=hours),
                auto_advance=True,
            )
        )
    db.commit()


def _aware(dt: datetime) -> datetime:
    # SQLite devuelve datetimes "naive" aunque se guarden con zona; se asume UTC.
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def serialize(sh: Shipment) -> ShipmentOut:
    out = ShipmentOut.model_validate(sh)
    out.arrival_at = _aware(out.arrival_at)
    out.stops = [_stop_out(s) for s in sh.stops]
    return out


def _stop_out(s: Stop) -> StopOut:
    out = StopOut.model_validate(s)
    out.eta = _aware(out.eta) if out.eta else None
    out.completed_at = _aware(out.completed_at) if out.completed_at else None
    return out


def public_view(sh: Shipment) -> TrackingOut:
    return TrackingOut(
        nickname=sh.child.nickname,
        avatar=sh.child.avatar,
        arrival_at=_aware(sh.arrival_at),
        server_time=datetime.now(UTC),
        stops=[_stop_out(s) for s in sh.stops],
    )


def broadcast(sh: Shipment, completed: Stop | None = None) -> None:
    channel = f"track:{sh.share_code}"
    hub.publish(channel, "tracking.updated", public_view(sh).model_dump(mode="json"))
    if completed is not None:
        hub.publish(
            channel, "tracking.stop_completed", _stop_out(completed).model_dump(mode="json")
        )
    hub.publish(f"user:{sh.child.user_id}", "shipment.updated", {"id": sh.id})


def advance_due_stops(db: Session, now: datetime | None = None) -> int:
    """Completa paradas con auto-avance cuya hora ya pasó. Devuelve cuántas avanzó."""
    now = now or datetime.now(UTC)
    due = db.scalars(
        select(Stop).where(
            Stop.auto_advance.is_(True), Stop.completed_at.is_(None), Stop.eta.is_not(None)
        )
    ).all()
    changed = [s for s in due if s.eta is not None and _aware(s.eta) <= now]
    for s in changed:
        s.completed_at = now
    if changed:
        db.commit()
        for s in changed:
            broadcast(s.shipment, completed=s)
    return len(changed)


async def auto_advance_loop() -> None:
    interval = get_settings().auto_advance_interval_seconds
    while True:
        try:
            await asyncio.to_thread(_tick)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("Error en el auto-avance de paradas")
        await asyncio.sleep(interval)


def _tick() -> None:
    with SessionLocal() as db:
        advance_due_stops(db)
