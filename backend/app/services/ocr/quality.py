"""Criterio para decidir si el OCR es suficientemente bueno o hay que pedir ayuda a la IA."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass

from app.core.config import get_settings

# Palabras frecuentes en cartas al Viejito Pascuero; sirven para validar que hay español real.
_COMMON = set(
    [
        "a",
        "al",
        "algo",
        "amor",
        "año",
        "años",
        "ayuda",
        "bien",
        "buen",
        "buena",
        "bueno",
        "carta",
        "casa",
        "como",
        "con",
        "cosa",
        "cosas",
        "de",
        "del",
        "el",
        "ella",
        "en",
        "es",
        "esta",
        "este",
        "esto",
        "estoy",
        "familia",
        "feliz",
        "gracias",
        "hermana",
        "hermano",
        "hola",
        "la",
        "las",
        "le",
        "lo",
        "los",
        "mama",
        "mamá",
        "me",
        "mi",
        "mis",
        "mucho",
        "muchos",
        "muy",
        "navidad",
        "no",
        "nos",
        "papa",
        "papá",
        "para",
        "pascuero",
        "pero",
        "por",
        "portado",
        "porque",
        "que",
        "quiero",
        "querido",
        "regalo",
        "regalos",
        "se",
        "si",
        "sí",
        "su",
        "te",
        "tengo",
        "todo",
        "todos",
        "un",
        "una",
        "viejito",
        "y",
        "yo",
        "pido",
        "pedir",
        "juguete",
        "muñeca",
        "pelota",
        "bicicleta",
        "libro",
        "perrito",
        "gato",
        "abrazo",
        "besos",
        "portado",
        "portada",
        "portaré",
        "año",
        "nuevo",
        "saludos",
        "cariño",
        "hermanito",
        "hermanita",
        "abuela",
        "abuelo",
        "tambien",
        "también",
    ]
)
_WORD = re.compile(r"[a-záéíóúüñ]{2,}", re.IGNORECASE)


@dataclass(frozen=True)
class Quality:
    ok: bool
    confidence: float
    valid_words: int
    garbage_ratio: float
    reason: str


def _strip_accents(s: str) -> str:
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn")


def _is_plausible_spanish(word: str) -> bool:
    w = word.lower()
    if w in _COMMON or _strip_accents(w) in {_strip_accents(c) for c in _COMMON}:
        return True
    # Palabra plausible: ≥3 letras, alterna vocales y consonantes, sin 4 consonantes seguidas.
    plain = _strip_accents(w)
    if len(plain) < 3 or not re.search(r"[aeiou]", plain):
        return False
    return re.search(r"[^aeiou]{4,}", plain) is None


def garbage_ratio(text: str) -> float:
    chars = [c for c in text if not c.isspace()]
    if not chars:
        return 1.0
    allowed = set("¡!¿?.,;:'\"()-—–")
    bad = sum(1 for c in chars if not (c.isalnum() or c in allowed))
    return bad / len(chars)


def evaluate(text: str, confidence: float, min_confidence: float | None = None) -> Quality:
    s = get_settings()
    threshold = s.ocr_min_confidence if min_confidence is None else min_confidence
    words = _WORD.findall(text)
    valid = sum(1 for w in words if _is_plausible_spanish(w))
    garbage = garbage_ratio(text)
    if confidence < threshold:
        reason = f"confianza baja ({confidence:.2f} < {threshold:.2f})"
    elif valid < s.ocr_min_valid_words:
        reason = f"pocas palabras válidas ({valid} < {s.ocr_min_valid_words})"
    elif garbage > s.ocr_max_garbage_ratio:
        reason = f"demasiados caracteres basura ({garbage:.0%})"
    else:
        return Quality(True, confidence, valid, garbage, "ok")
    return Quality(False, confidence, valid, garbage, reason)
