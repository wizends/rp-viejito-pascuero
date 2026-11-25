"""Worker RQ: procesa la cola "cartas". Precarga el motor OCR para no pagarlo por carta.

Usa SimpleWorker (sin fork): PyTorch, ya inicializado en este proceso por la
precarga, se bloquea dentro de un hijo creado con fork (pool de hilos de OpenMP).
Para más paralelismo, escalar réplicas: `docker compose up --scale worker=3`.
"""

from __future__ import annotations

import logging

from redis import Redis
from rq import Queue
from rq import SimpleWorker as Worker

from app.core.config import get_settings
from app.services.ocr.engines import get_engine

logging.basicConfig(level=logging.INFO)


def main() -> None:
    get_engine()
    conn = Redis.from_url(get_settings().redis_url)
    Worker([Queue("cartas", connection=conn)], connection=conn).work(with_scheduler=False)


if __name__ == "__main__":
    main()
