"""Rate limiting de ventana fija, en Redis si está disponible o en memoria."""

from __future__ import annotations

import threading
import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

from app.core.config import get_settings


class _MemoryCounter:
    def __init__(self) -> None:
        self._data: dict[str, tuple[int, float]] = defaultdict(lambda: (0, 0.0))
        self._lock = threading.Lock()

    def hit(self, key: str, window: int) -> int:
        now = time.monotonic()
        with self._lock:
            count, reset = self._data[key]
            if now >= reset:
                count, reset = 0, now + window
            count += 1
            self._data[key] = (count, reset)
            return count

    def reset(self) -> None:
        with self._lock:
            self._data.clear()


class _RedisCounter:
    def __init__(self, url: str) -> None:
        import redis

        self._r = redis.Redis.from_url(url)

    def hit(self, key: str, window: int) -> int:
        pipe = self._r.pipeline()
        pipe.incr(f"rl:{key}")
        pipe.expire(f"rl:{key}", window, nx=True)
        count, _ = pipe.execute()
        return int(count)


_counter: _MemoryCounter | _RedisCounter | None = None


def _get_counter() -> _MemoryCounter | _RedisCounter:
    global _counter
    if _counter is None:
        s = get_settings()
        _counter = _RedisCounter(s.redis_url) if s.task_backend == "rq" else _MemoryCounter()
    return _counter


def reset_limits() -> None:
    c = _get_counter()
    if isinstance(c, _MemoryCounter):
        c.reset()


def client_ip(request: Request) -> str:
    if get_settings().trust_forwarded_for:
        # el proxy agrega la IP real al principio de la cadena
        fwd = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        if fwd:
            return fwd
    return request.client.host if request.client else "desconocido"


def check(key: str, limit: int) -> None:
    window = get_settings().rate_limit_window_seconds
    if _get_counter().hit(key, window) > limit:
        raise HTTPException(
            status.HTTP_429_TOO_MANY_REQUESTS,
            "Los duendes necesitan un respiro. Intenta de nuevo en un ratito.",
            headers={"Retry-After": str(window)},
        )


def limit_auth(request: Request) -> None:
    check(f"auth:{client_ip(request)}", get_settings().rate_limit_auth)


def limit_upload_for(user_id: str, request: Request) -> None:
    s = get_settings()
    check(f"up-ip:{client_ip(request)}", s.rate_limit_uploads)
    check(f"up-user:{user_id}", s.rate_limit_uploads)
