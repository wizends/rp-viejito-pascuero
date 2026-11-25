from __future__ import annotations

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.db import SessionLocal
from app.services.tracking import TEMPLATES, advance_due_stops, default_arrival
from tests.conftest import Client


def _shipment(c: Client) -> dict:
    child = c.post("/api/children", json={"nickname": "Benja"}).json()
    return c.get(f"/api/children/{child['id']}/shipment").json()


def test_default_arrival_is_christmas_midnight_chile() -> None:
    arr = default_arrival(datetime(2026, 11, 24, tzinfo=UTC))
    local = arr.astimezone(ZoneInfo("America/Santiago"))
    assert (local.year, local.month, local.day, local.hour, local.minute) == (2026, 12, 25, 0, 0)
    assert default_arrival(datetime(2026, 12, 28, tzinfo=UTC)).year == 2027


def test_arrival_roundtrip_keeps_chile_midnight(parent: Client) -> None:
    """Regresión: SQLite perdía el offset y la llegada salía 3 h antes."""
    sh = _shipment(parent)
    local = datetime.fromisoformat(sh["arrival_at"]).astimezone(ZoneInfo("America/Santiago"))
    assert (local.month, local.day, local.hour, local.minute) == (12, 25, 0, 0)
    eta = "2026-12-24T22:30:00-03:00"
    sh = parent.post(f"/api/shipments/{sh['id']}/stops", json={"nombre": "X", "eta": eta}).json()
    got = datetime.fromisoformat(sh["stops"][0]["eta"])
    assert got == datetime.fromisoformat(eta)


def test_stops_crud_and_order(parent: Client) -> None:
    sh = _shipment(parent)
    assert sh["stops"] == []
    sh = parent.post(f"/api/shipments/{sh['id']}/stops/templates").json()
    assert len(sh["stops"]) == len(TEMPLATES)
    assert sh["stops"][0]["nombre"] == "Carta recibida en el Polo Norte"

    sh = parent.post(
        f"/api/shipments/{sh['id']}/stops",
        json={
            "nombre": "Pasando por la casa de la abuela",
            "icono": "estrella",
            "lat": -33.0,
            "lng": -71.5,
        },
    ).json()
    ids = [s["id"] for s in sh["stops"]]
    new_order = [ids[-1], *ids[:-1]]
    sh = parent.put(f"/api/shipments/{sh['id']}/stops/order", json={"ids": new_order}).json()
    assert [s["id"] for s in sh["stops"]] == new_order

    bad = parent.put(f"/api/shipments/{sh['id']}/stops/order", json={"ids": new_order[:2]})
    assert bad.status_code == 422

    sid = new_order[0]
    sh = parent.patch(f"/api/stops/{sid}", json={"completed": True}).json()
    assert sh["stops"][0]["completed_at"] is not None
    sh = parent.delete(f"/api/stops/{sid}").json()
    assert sid not in [s["id"] for s in sh["stops"]]
    assert [s["position"] for s in sh["stops"]] == list(range(len(sh["stops"])))


def test_invalid_coordinates_rejected(parent: Client) -> None:
    sh = _shipment(parent)
    r = parent.post(f"/api/shipments/{sh['id']}/stops", json={"nombre": "X", "lat": 200})
    assert r.status_code == 422


def test_auto_advance(parent: Client) -> None:
    sh = _shipment(parent)
    past = (datetime.now(UTC) - timedelta(minutes=5)).isoformat()
    future = (datetime.now(UTC) + timedelta(days=5)).isoformat()
    parent.post(
        f"/api/shipments/{sh['id']}/stops", json={"nombre": "A", "eta": past, "auto_advance": True}
    )
    parent.post(
        f"/api/shipments/{sh['id']}/stops",
        json={"nombre": "B", "eta": future, "auto_advance": True},
    )
    parent.post(
        f"/api/shipments/{sh['id']}/stops", json={"nombre": "C", "eta": past, "auto_advance": False}
    )
    with SessionLocal() as db:
        assert advance_due_stops(db) == 1
    stops = parent.get(f"/api/children/{sh['child_id']}/shipment").json()["stops"]
    done = {s["nombre"]: s["completed_at"] is not None for s in stops}
    assert done == {"A": True, "B": False, "C": False}


def test_tracking_websocket_receives_updates(parent: Client) -> None:
    sh = _shipment(parent)
    sh = parent.post(f"/api/shipments/{sh['id']}/stops", json={"nombre": "Polo"}).json()
    stop_id = sh["stops"][0]["id"]
    with parent.websocket_connect(f"/ws/tracking/{sh['share_code']}") as ws:
        parent.patch(f"/api/stops/{stop_id}", json={"completed": True})
        events = {ws.receive_json()["event"], ws.receive_json()["event"]}
        assert events == {"tracking.updated", "tracking.stop_completed"}


def test_letters_websocket_requires_session(client: Client) -> None:
    import pytest
    from starlette.websockets import WebSocketDisconnect

    with pytest.raises(WebSocketDisconnect), client.websocket_connect("/ws/letters") as ws:
        ws.receive_json()
