"""Detección y enmascarado de datos sensibles en el texto de las cartas.

Se enmascaran: RUT chileno, teléfonos, correos y direcciones con calle y número.
"""

from __future__ import annotations

import re

_RUT = re.compile(r"\b\d{1,2}\.?\d{3}\.?\d{3}\s*-\s*[\dkK]\b")
_EMAIL = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
_PHONE = re.compile(
    r"(?:\+?56\s*)?(?:\(?\d\)?[\s.-]*)?\b9[\s.-]*\d{4}[\s.-]*\d{4}\b|\b\d{2}[\s.-]?\d{3}[\s.-]?\d{4}\b"
)
_STREET_WORDS = (
    r"calle|avenida|av\.?|pasaje|psje\.?|camino|villa|población|poblacion|block|depto\.?|"
    r"departamento|casa|condominio"
)
_ADDRESS = re.compile(
    rf"\b(?:vivo en |mi casa (?:es|está|esta) en )?(?:{_STREET_WORDS})\s+[\wáéíóúñ ]{{2,40}}?\s*(?:n[°º]?|#|número|numero)?\s*\d{{1,5}}\b",
    re.IGNORECASE,
)
_SCHOOL = re.compile(
    r"\b(?i:colegio|escuela|liceo|jardín|jardin)\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ]+){0,3}"
)

MASK = "[🔒 dato protegido]"


def mask_pii(text: str) -> tuple[str, bool]:
    """Devuelve el texto enmascarado y si se encontró algo."""
    original = text
    for pattern in (_EMAIL, _RUT, _PHONE, _ADDRESS, _SCHOOL):
        text = pattern.sub(MASK, text)
    return text, text != original
