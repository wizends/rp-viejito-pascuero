from __future__ import annotations

import contextlib

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.core.security import ACCESS_COOKIE, decode_token
from app.models import Shipment
from app.ws.hub import hub

router = APIRouter()


def _origin_ok(ws: WebSocket) -> bool:
    origin = ws.headers.get("origin")
    return origin is None or origin in get_settings().cors_origins


async def _hold(ws: WebSocket, channel: str) -> None:
    hub.subscribe(channel, ws)
    try:
        while True:
            # Mantiene viva la conexión; el cliente envía "ping".
            msg = await ws.receive_text()
            if msg == "ping":
                await ws.send_json({"event": "pong", "data": {}})
    except WebSocketDisconnect:
        pass
    finally:
        hub.unsubscribe(channel, ws)


@router.websocket("/ws/letters")
async def letters_ws(ws: WebSocket) -> None:
    token = ws.cookies.get(ACCESS_COOKIE)
    data = decode_token(token, "access") if token else None
    if data is None or not _origin_ok(ws):
        await ws.close(code=4401)
        return
    await ws.accept()
    await _hold(ws, f"user:{data['sub']}")


@router.websocket("/ws/tracking/{share_code}")
async def tracking_ws(ws: WebSocket, share_code: str) -> None:
    if not _origin_ok(ws):
        await ws.close(code=4403)
        return
    with SessionLocal() as db:
        exists = db.scalar(select(Shipment.id).where(Shipment.share_code == share_code))
    if not exists:
        await ws.close(code=4404)
        return
    await ws.accept()
    with contextlib.suppress(RuntimeError):
        await _hold(ws, f"track:{share_code}")
