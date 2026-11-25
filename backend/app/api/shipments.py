from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Response
from sqlalchemy import select

from app.api.deps import DB, CurrentUser, own_child, own_shipment, own_stop
from app.models import Shipment, Stop
from app.schemas import ShipmentOut, ShipmentPatch, StopIn, StopOrderIn, StopPatch, TrackingOut
from app.services import tracking

router = APIRouter(tags=["trayecto"])
MAX_STOPS = 30


@router.get("/children/{child_id}/shipment", response_model=ShipmentOut)
def get_shipment(child_id: str, user: CurrentUser, db: DB) -> ShipmentOut:
    child = own_child(db, user, child_id)
    return tracking.serialize(tracking.get_or_create_shipment(db, child))


@router.patch("/shipments/{shipment_id}", response_model=ShipmentOut)
def update_shipment(
    shipment_id: str, body: ShipmentPatch, user: CurrentUser, db: DB
) -> ShipmentOut:
    sh = own_shipment(db, user, shipment_id)
    sh.arrival_at = body.arrival_at
    db.commit()
    tracking.broadcast(sh)
    return tracking.serialize(sh)


@router.post("/shipments/{shipment_id}/stops", response_model=ShipmentOut, status_code=201)
def add_stop(shipment_id: str, body: StopIn, user: CurrentUser, db: DB) -> ShipmentOut:
    sh = own_shipment(db, user, shipment_id)
    if len(sh.stops) >= MAX_STOPS:
        raise HTTPException(400, "El trineo no aguanta más de 30 paradas.")
    sh.stops.append(Stop(position=len(sh.stops), **body.model_dump()))
    db.commit()
    tracking.broadcast(sh)
    return tracking.serialize(sh)


@router.post("/shipments/{shipment_id}/stops/templates", response_model=ShipmentOut)
def add_templates(shipment_id: str, user: CurrentUser, db: DB) -> ShipmentOut:
    sh = own_shipment(db, user, shipment_id)
    if len(sh.stops) + len(tracking.TEMPLATES) > MAX_STOPS:
        raise HTTPException(400, "El trineo no aguanta más de 30 paradas.")
    tracking.add_templates(db, sh)
    tracking.broadcast(sh)
    return tracking.serialize(sh)


@router.put("/shipments/{shipment_id}/stops/order", response_model=ShipmentOut)
def reorder(shipment_id: str, body: StopOrderIn, user: CurrentUser, db: DB) -> ShipmentOut:
    sh = own_shipment(db, user, shipment_id)
    current = {s.id: s for s in sh.stops}
    if set(body.ids) != set(current) or len(body.ids) != len(current):
        raise HTTPException(422, "El orden debe incluir todas las paradas una vez.")
    for i, sid in enumerate(body.ids):
        current[sid].position = i
    db.commit()
    db.refresh(sh)
    tracking.broadcast(sh)
    return tracking.serialize(sh)


@router.patch("/stops/{stop_id}", response_model=ShipmentOut)
def update_stop(stop_id: str, body: StopPatch, user: CurrentUser, db: DB) -> ShipmentOut:
    stop = own_stop(db, user, stop_id)
    data = body.model_dump(exclude_unset=True)
    completed = data.pop("completed", None)
    for k, v in data.items():
        setattr(stop, k, v)
    just_completed = False
    if completed is True and stop.completed_at is None:
        stop.completed_at = datetime.now(UTC)
        just_completed = True
    elif completed is False:
        stop.completed_at = None
    db.commit()
    sh = stop.shipment
    tracking.broadcast(sh, completed=stop if just_completed else None)
    return tracking.serialize(sh)


@router.delete("/stops/{stop_id}", response_model=ShipmentOut)
def delete_stop(stop_id: str, user: CurrentUser, db: DB) -> ShipmentOut:
    stop = own_stop(db, user, stop_id)
    sh = stop.shipment
    sh.stops.remove(stop)
    for i, s in enumerate(sh.stops):
        s.position = i
    db.commit()
    tracking.broadcast(sh)
    return tracking.serialize(sh)


@router.get("/tracking/{share_code}", response_model=TrackingOut)
def public_tracking(share_code: str, db: DB, response: Response) -> TrackingOut:
    sh = db.scalar(select(Shipment).where(Shipment.share_code == share_code))
    if sh is None:
        raise HTTPException(404, "Este código de seguimiento no existe.")
    response.headers["Cache-Control"] = "no-store"
    return tracking.public_view(sh)
