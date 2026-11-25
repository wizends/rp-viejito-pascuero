from __future__ import annotations

import os
import shutil
import tempfile
from collections.abc import Iterator
from pathlib import Path

_TMP = Path(tempfile.mkdtemp(prefix="buzon-test-"))
os.environ.update(
    ENVIRONMENT="test",
    DATABASE_URL=f"sqlite:///{(_TMP / 'test.db').as_posix()}",
    UPLOAD_DIR=str(_TMP / "uploads"),
    TASK_BACKEND="inline",
    VISION_PROVIDER="none",
    OCR_ENGINE="tesseract",
    RATE_LIMIT_IP="10000",
    RATE_LIMIT_AUTH="10000",
    RATE_LIMIT_UPLOADS="10000",
)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.core import ratelimit  # noqa: E402
from app.core.db import Base, engine  # noqa: E402
from app.core.security import CSRF_COOKIE  # noqa: E402
from app.main import app  # noqa: E402

FIXTURES = Path(__file__).parent / "fixtures"


@pytest.fixture(autouse=True)
def _db() -> Iterator[None]:
    Base.metadata.create_all(engine)
    ratelimit.reset_limits()
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture(scope="session", autouse=True)
def _cleanup() -> Iterator[None]:
    yield
    engine.dispose()
    shutil.rmtree(_TMP, ignore_errors=True)


class Client(TestClient):
    """TestClient que reenvía el token CSRF como hace el frontend."""

    def request(self, method: str, url: str, **kw):  # type: ignore[no-untyped-def, override]
        token = self.cookies.get(CSRF_COOKIE)
        if token:
            kw["headers"] = {**(kw.get("headers") or {}), "X-CSRF-Token": token}
        return super().request(method, url, **kw)


def make_client() -> Client:
    return Client(app, base_url="http://testserver")


def register(c: Client, email: str = "mama@example.com") -> dict:
    r = c.post(
        "/api/auth/register",
        json={"email": email, "password": "galletas-de-jengibre", "display_name": "Mamá"},
    )
    assert r.status_code == 201, r.text
    return r.json()


@pytest.fixture
def client() -> Iterator[Client]:
    with make_client() as c:
        yield c


@pytest.fixture
def parent(client: Client) -> Client:
    register(client)
    return client
