"""Hub de eventos en tiempo real.

Los canales son strings: ``user:{id}`` (estados de cartas) y ``track:{share_code}``
(vista del niño). Cualquier proceso puede publicar con :func:`publish`: en modo
``rq`` se usa Redis pub/sub y la API reenvía a sus sockets; en modo ``inline``
se entrega directo al loop de la API.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
from collections import defaultdict
from typing import Any

from fastapi import WebSocket

from app.core.config import get_settings

log = logging.getLogger(__name__)
REDIS_CHANNEL = "vp:events"


class Hub:
    def __init__(self) -> None:
        self._subs: dict[str, set[WebSocket]] = defaultdict(set)
        self._loop: asyncio.AbstractEventLoop | None = None
        self._listener: asyncio.Task[None] | None = None

    # ---- ciclo de vida ----
    async def start(self) -> None:
        self._loop = asyncio.get_running_loop()
        if get_settings().task_backend == "rq":
            self._listener = asyncio.create_task(self._redis_listen())

    async def stop(self) -> None:
        if self._listener:
            self._listener.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._listener

    # ---- suscripciones ----
    def subscribe(self, channel: str, ws: WebSocket) -> None:
        self._subs[channel].add(ws)

    def unsubscribe(self, channel: str, ws: WebSocket) -> None:
        self._subs[channel].discard(ws)
        if not self._subs[channel]:
            self._subs.pop(channel, None)

    async def deliver(self, channel: str, message: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in list(self._subs.get(channel, ())):
            try:
                await ws.send_json(message)
            except Exception:  # socket cerrado
                dead.append(ws)
        for ws in dead:
            self.unsubscribe(channel, ws)

    # ---- publicación (segura desde hilos y workers) ----
    def publish(self, channel: str, event: str, data: dict[str, Any]) -> None:
        message = {"event": event, "data": data}
        if get_settings().task_backend == "rq":
            import redis

            r = redis.Redis.from_url(get_settings().redis_url)
            r.publish(
                REDIS_CHANNEL, json.dumps({"channel": channel, "message": message}, default=str)
            )
            return
        if self._loop is None or self._loop.is_closed():
            return
        payload = json.loads(json.dumps(message, default=str))
        try:
            running = asyncio.get_running_loop()
        except RuntimeError:
            running = None
        if running is self._loop:
            self._loop.create_task(self.deliver(channel, payload))
        else:
            asyncio.run_coroutine_threadsafe(self.deliver(channel, payload), self._loop)

    async def _redis_listen(self) -> None:
        import redis.asyncio as aioredis

        while True:
            try:
                r = aioredis.Redis.from_url(get_settings().redis_url)
                pubsub = r.pubsub()
                await pubsub.subscribe(REDIS_CHANNEL)
                async for msg in pubsub.listen():
                    if msg.get("type") != "message":
                        continue
                    body = json.loads(msg["data"])
                    await self.deliver(body["channel"], body["message"])
            except asyncio.CancelledError:
                raise
            except Exception:
                log.exception("Se cortó la escucha de Redis; reintentando")
                await asyncio.sleep(2)


hub = Hub()
