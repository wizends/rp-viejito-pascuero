"""Pipeline asíncrono de cartas: OCR → criterio de fallo → IA de visión → extracción → PII.

Estados emitidos: recibida → leyendo → leida | necesita_ayuda.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.db import SessionLocal
from app.models import Gift, Letter, LetterStatus
from app.services.extraction import CartaExtraida, detect_tone, extract_gifts, normalize
from app.services.ocr.engines import OcrEngine, get_engine
from app.services.ocr.preprocess import load, preprocess
from app.services.ocr.quality import evaluate
from app.services.pii import mask_pii
from app.services.vision_providers import VisionError, VisionReader, get_reader
from app.ws.hub import hub

log = logging.getLogger(__name__)

MENSAJES = {
    LetterStatus.RECIBIDA: "¡Tu carta llegó al Polo Norte!",
    LetterStatus.LEYENDO: "El Viejito Pascuero se puso los lentes y está leyendo…",
    LetterStatus.LEIDA: "¡Qué letra más bonita! El Viejito leyó tu carta.",
    LetterStatus.NECESITA_AYUDA: "Esta carta necesita ayuda de un duende para leerla.",
}


@dataclass
class ImageOutcome:
    result: CartaExtraida | None
    trace: list[str]


def read_image(path: Path, engine: OcrEngine | None, reader: VisionReader | None) -> ImageOutcome:
    """Lee una carta fotografiada. Separado de la BD para poder probarlo aislado."""
    trace: list[str] = []
    if engine is not None:
        try:
            gray, binary = preprocess(load(path))
            ocr = engine.read(gray, binary)
            q = evaluate(ocr.text, ocr.mean_confidence)
            trace.append(f"ocr:{engine.name}:{q.reason}")
            if q.ok:
                text = ocr.text
                return ImageOutcome(
                    CartaExtraida(
                        texto_original=text,
                        texto_normalizado=normalize(text),
                        regalos=extract_gifts(text),
                        tono=detect_tone(text),
                        confianza=round(q.confidence, 3),
                        metodo="ocr",
                    ),
                    trace,
                )
        except Exception as exc:
            log.exception("Falló el OCR")
            trace.append(f"ocr:error:{exc.__class__.__name__}")
    else:
        trace.append("ocr:sin_motor")

    if reader is not None:
        try:
            result = reader.read(path)
            # La IA también pasa por el criterio de calidad: los modelos de visión
            # "alucinan" texto plausible sobre garabatos (p. ej. TrOCR → "a letter .").
            q = evaluate(
                result.texto_original, result.confianza, get_settings().vision_min_confidence
            )
            trace.append(f"ia:{reader.name}:{q.reason}")
            if q.ok:
                return ImageOutcome(result, trace)
        except VisionError as exc:
            trace.append(f"ia:{reader.name}:{exc}")
        except Exception as exc:
            log.exception("Falló la IA de visión")
            trace.append(f"ia:{reader.name}:error:{exc.__class__.__name__}")
    else:
        trace.append("ia:sin_proveedor")
    return ImageOutcome(None, trace)


def _set_status(db: Session, letter: Letter, status: LetterStatus) -> None:
    letter.status = status.value
    db.commit()
    hub.publish(
        f"user:{letter.child.user_id}",
        "letter.status",
        {
            "id": letter.id,
            "child_id": letter.child_id,
            "status": status.value,
            "mensaje": MENSAJES[status],
        },
    )


def _apply(letter: Letter, data: CartaExtraida) -> None:
    original, m1 = mask_pii(data.texto_original)
    normal, m2 = mask_pii(data.texto_normalizado)
    letter.texto_original = original
    letter.texto_normalizado = normal
    letter.tono = data.tono
    letter.confianza = data.confianza
    letter.metodo = data.metodo
    letter.pii_masked = letter.pii_masked or m1 or m2
    letter.gifts.clear()
    for i, g in enumerate(data.regalos):
        name, masked = mask_pii(g.nombre)
        letter.pii_masked = letter.pii_masked or masked
        letter.gifts.append(Gift(nombre=name[:120], prioridad=g.prioridad, position=i))


def _delete_image(letter: Letter) -> None:
    if letter.image_path:
        Path(letter.image_path).unlink(missing_ok=True)
        letter.image_path = None
        letter.image_deleted_at = datetime.now(UTC)


def process_letter(
    letter_id: str,
    *,
    engine: OcrEngine | None = None,
    reader: VisionReader | None = None,
    use_defaults: bool = True,
) -> None:
    """Punto de entrada de la cola. ``use_defaults`` carga motor y proveedor configurados."""
    with SessionLocal() as db:
        letter = db.get(Letter, letter_id)
        # Idempotente: un reintento de la cola no reprocesa una carta ya terminada.
        if letter is None or letter.status not in (LetterStatus.RECIBIDA, LetterStatus.LEYENDO):
            return
        _set_status(db, letter, LetterStatus.LEYENDO)

        if letter.source == "escrita":
            # Ya viene como texto: no hay OCR, solo extracción y filtro de datos sensibles.
            if letter.gifts:
                _mask_written(letter)
            else:
                _apply(
                    letter,
                    CartaExtraida(
                        texto_original=letter.texto_original,
                        texto_normalizado=normalize(letter.texto_original),
                        regalos=extract_gifts(letter.texto_original),
                        tono=detect_tone(letter.texto_original),
                        confianza=1.0,
                        metodo="escrita",
                    ),
                )
            _set_status(db, letter, LetterStatus.LEIDA)
            return

        if not letter.image_path:
            _set_status(db, letter, LetterStatus.NECESITA_AYUDA)
            return

        if use_defaults:
            engine = engine or get_engine()
            reader = reader or get_reader(letter.child.user.allow_external_ai)
        outcome = read_image(Path(letter.image_path), engine, reader)
        log.info("Carta %s: %s", letter.id, " → ".join(outcome.trace))

        if outcome.result is not None:
            _apply(letter, outcome.result)
            status = LetterStatus.LEIDA
        else:
            status = LetterStatus.NECESITA_AYUDA

        # Si necesita ayuda, se conserva la imagen para que el padre pueda transcribirla.
        if get_settings().delete_images_after_processing and status is LetterStatus.LEIDA:
            _delete_image(letter)
        _set_status(db, letter, status)


def _mask_written(letter: Letter) -> None:
    original, masked = mask_pii(letter.texto_original)
    letter.texto_original = original
    letter.texto_normalizado = normalize(original)
    letter.tono = detect_tone(original)
    letter.confianza = 1.0
    letter.metodo = "escrita"
    letter.pii_masked = masked
    for g in letter.gifts:
        g.nombre, m = mask_pii(g.nombre)
        letter.pii_masked = letter.pii_masked or m


def enqueue(letter_id: str, background: object | None = None) -> None:
    """Encola en RQ o, en modo inline, en BackgroundTasks de FastAPI."""
    if get_settings().task_backend == "rq":
        from redis import Redis
        from rq import Queue

        Queue("cartas", connection=Redis.from_url(get_settings().redis_url)).enqueue(
            "app.services.letter_pipeline.process_letter", letter_id, job_timeout=600
        )
        return
    from fastapi import BackgroundTasks

    if isinstance(background, BackgroundTasks):
        background.add_task(process_letter, letter_id)
    else:
        process_letter(letter_id)
