"""Adaptadores de motores OCR. Cada uno se carga solo si su librería está instalada."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from functools import lru_cache
from typing import Protocol

import numpy as np

from app.core.config import get_settings
from app.services.ocr.preprocess import Img

log = logging.getLogger(__name__)


@dataclass
class OcrLine:
    text: str
    confidence: float  # 0..1


@dataclass
class OcrResult:
    engine: str
    lines: list[OcrLine] = field(default_factory=list)

    @property
    def text(self) -> str:
        return "\n".join(line.text for line in self.lines if line.text.strip())

    @property
    def mean_confidence(self) -> float:
        if not self.lines:
            return 0.0
        return float(np.mean([line.confidence for line in self.lines]))


class OcrEngine(Protocol):
    name: str

    def read(self, gray: Img, binary: Img) -> OcrResult: ...


class EasyOcrEngine:
    name = "easyocr"

    def __init__(self) -> None:
        import easyocr

        self._reader = easyocr.Reader(["es"], gpu=False, verbose=False)

    def read(self, gray: Img, binary: Img) -> OcrResult:
        out = self._reader.readtext(gray, detail=1, paragraph=False)
        # Agrupa cajas en renglones según su coordenada vertical.
        boxes = sorted(out, key=lambda b: (b[0][0][1], b[0][0][0]))
        lines: list[OcrLine] = []
        current: list[tuple[str, float]] = []
        last_y: float | None = None
        for box, text, conf in boxes:
            y = float(box[0][1])
            h = float(box[2][1] - box[0][1])
            if last_y is not None and abs(y - last_y) > max(10.0, h * 0.6) and current:
                lines.append(_merge(current))
                current = []
            current.append((text, float(conf)))
            last_y = y
        if current:
            lines.append(_merge(current))
        return OcrResult(self.name, lines)


class PaddleOcrEngine:
    name = "paddleocr"

    def __init__(self) -> None:
        from paddleocr import PaddleOCR

        self._ocr = PaddleOCR(lang="es", use_angle_cls=True, show_log=False)

    def read(self, gray: Img, binary: Img) -> OcrResult:
        res = self._ocr.ocr(gray, cls=True) or []
        lines = [OcrLine(t, float(c)) for page in res if page for _box, (t, c) in page]
        return OcrResult(self.name, lines)


class TesseractEngine:
    name = "tesseract"

    def __init__(self) -> None:
        import pytesseract

        pytesseract.get_tesseract_version()  # falla si el binario no existe
        self._t = pytesseract

    def read(self, gray: Img, binary: Img) -> OcrResult:
        data = self._t.image_to_data(
            binary, lang="spa", config="--psm 6", output_type=self._t.Output.DICT
        )
        grouped: dict[tuple[int, int, int], list[tuple[str, float]]] = {}
        for i, word in enumerate(data["text"]):
            conf = float(data["conf"][i])
            if not word.strip() or conf < 0:
                continue
            key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
            grouped.setdefault(key, []).append((word, conf / 100))
        return OcrResult(self.name, [_merge(ws) for _, ws in sorted(grouped.items())])


def _merge(words: list[tuple[str, float]]) -> OcrLine:
    return OcrLine(" ".join(w for w, _ in words), float(np.mean([c for _, c in words])))


_ENGINES: dict[str, type[EasyOcrEngine] | type[PaddleOcrEngine] | type[TesseractEngine]] = {
    "easyocr": EasyOcrEngine,
    "paddleocr": PaddleOcrEngine,
    "tesseract": TesseractEngine,
}


@lru_cache
def get_engine() -> OcrEngine | None:
    """Devuelve el motor configurado; en ``auto`` prueba EasyOCR → Paddle → Tesseract."""
    choice = get_settings().ocr_engine
    order = ["easyocr", "paddleocr", "tesseract"] if choice == "auto" else [choice]
    for name in order:
        try:
            engine = _ENGINES[name]()
            log.info("Motor OCR activo: %s", name)
            return engine
        except Exception as exc:
            log.warning("Motor OCR %s no disponible: %s", name, exc)
    return None
