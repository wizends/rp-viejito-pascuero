"""TrOCR local (microsoft/trocr-base-handwritten): gratis y sin enviar datos a terceros.

TrOCR lee un renglón a la vez, así que segmentamos la carta en líneas con OpenCV.
"""

from __future__ import annotations

from functools import cached_property
from pathlib import Path
from typing import Any

import numpy as np
from PIL import Image

from app.core.config import get_settings
from app.services.extraction import CartaExtraida, detect_tone, extract_gifts, normalize
from app.services.ocr.preprocess import load, preprocess, split_lines
from app.services.vision_providers.base import VisionError, VisionReader


class TrOcrReader(VisionReader):
    name = "trocr"
    external = False

    @cached_property
    def _model(self) -> tuple[Any, Any]:
        try:
            import torch  # noqa: F401
            from transformers import TrOCRProcessor, VisionEncoderDecoderModel
        except ImportError as exc:
            raise VisionError("transformers/torch no están instalados") from exc
        name = get_settings().trocr_model
        return TrOCRProcessor.from_pretrained(name), VisionEncoderDecoderModel.from_pretrained(name)

    def read(self, image_path: Path) -> CartaExtraida:
        import torch

        processor, model = self._model
        gray, binary = preprocess(load(image_path))
        spans = split_lines(binary)[:40]
        if not spans:
            raise VisionError("No se encontraron renglones")
        texts: list[str] = []
        scores: list[float] = []
        for top, bottom in spans:
            crop = Image.fromarray(gray[top:bottom]).convert("RGB")
            pixels = processor(images=crop, return_tensors="pt").pixel_values
            with torch.no_grad():
                out = model.generate(
                    pixels, max_new_tokens=64, output_scores=True, return_dict_in_generate=True
                )
            text = processor.batch_decode(out.sequences, skip_special_tokens=True)[0].strip()
            if out.scores:
                probs = [float(torch.softmax(s, -1).max()) for s in out.scores]
                scores.append(float(np.mean(probs)))
            if text:
                texts.append(text)
        original = "\n".join(texts)
        if not original.strip():
            raise VisionError("TrOCR no reconoció texto")
        return CartaExtraida(
            texto_original=original,
            texto_normalizado=normalize(original),
            regalos=extract_gifts(original),
            tono=detect_tone(original),
            confianza=float(np.mean(scores)) if scores else 0.5,
            metodo="ia",
        )
