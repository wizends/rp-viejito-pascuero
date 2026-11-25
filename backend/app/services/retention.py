"""Política de retención: borra imágenes de cartas más antiguas que RETENTION_DAYS."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from sqlalchemy import select

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import Letter


def purge_expired_images(now: datetime | None = None) -> int:
    now = now or datetime.now(UTC)
    limit = now - timedelta(days=get_settings().retention_days)
    count = 0
    with SessionLocal() as db:
        for letter in db.scalars(select(Letter).where(Letter.image_path.is_not(None))).all():
            created = (
                letter.created_at
                if letter.created_at.tzinfo
                else letter.created_at.replace(tzinfo=UTC)
            )
            if created < limit and letter.image_path:
                Path(letter.image_path).unlink(missing_ok=True)
                letter.image_path = None
                letter.image_deleted_at = now
                count += 1
        db.commit()
    return count
