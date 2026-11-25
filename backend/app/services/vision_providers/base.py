"""Interfaz común para lectores de visión con IA (fallback del OCR)."""

from __future__ import annotations

import json
import re
from abc import ABC, abstractmethod
from pathlib import Path

from pydantic import ValidationError

from app.services.extraction import CartaExtraida

PROMPT = """Eres un duende transcriptor del Viejito Pascuero (Chile).
La imagen es la carta manuscrita de un niño o niña.
1. Transcribe LITERALMENTE el texto en "texto_original", respetando la ortografía original,
   los saltos de línea y los errores. No inventes palabras: usa [?] si algo es ilegible.
2. Escribe en "texto_normalizado" la misma carta con ortografía corregida, sin cambiar el sentido.
3. Extrae la lista de regalos pedidos en "regalos" como [{"nombre": str, "prioridad": int|null}],
   en el orden en que aparecen (prioridad 1 = primero).
4. "tono": uno de alegre, carinoso, ilusionado, timido, neutral.
5. "confianza": número entre 0 y 1 con tu seguridad sobre la transcripción.
No incluyas apellidos, direcciones, teléfonos, RUT ni colegios: reemplázalos por [dato protegido].
Responde SOLO con un objeto JSON con esas claves."""


class VisionError(RuntimeError):
    pass


class VisionReader(ABC):
    """Adaptador intercambiable. ``external`` indica si los datos salen del servidor."""

    name: str
    external: bool

    @abstractmethod
    def read(self, image_path: Path) -> CartaExtraida: ...


def parse_model_json(raw: str, metodo: str = "ia") -> CartaExtraida:
    """Extrae y valida el JSON de la respuesta del modelo (tolera bloques ```json)."""
    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise VisionError("El modelo no devolvió JSON")
    try:
        data = json.loads(match.group(0))
        data["metodo"] = metodo
        data.setdefault("confianza", 0.7)
        data.setdefault("texto_normalizado", data.get("texto_original", ""))
        return CartaExtraida.model_validate(data)
    except (json.JSONDecodeError, ValidationError) as exc:
        raise VisionError(f"JSON inválido del modelo: {exc}") from exc
