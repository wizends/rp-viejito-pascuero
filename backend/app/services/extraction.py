"""Extracción estructurada desde texto: regalos, versión normalizada y tono."""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

Tono = Literal["alegre", "carinoso", "ilusionado", "timido", "neutral"]
Metodo = Literal["ocr", "ia", "manual", "escrita"]


class RegaloOut(BaseModel):
    nombre: str = Field(min_length=1, max_length=120)
    prioridad: int | None = Field(default=None, ge=1, le=10)

    @field_validator("nombre")
    @classmethod
    def _tidy(cls, v: str) -> str:
        return re.sub(r"\s+", " ", v).strip(" .,;:-").strip()[:120]


class CartaExtraida(BaseModel):
    """Contrato validado de lo que entrega OCR o IA."""

    texto_original: str
    texto_normalizado: str
    regalos: list[RegaloOut] = Field(default_factory=list, max_length=30)
    tono: Tono = "neutral"
    confianza: float = Field(ge=0, le=1)
    metodo: Metodo


_REQUEST = re.compile(
    r"(?:quiero|quisiera|me gustar[ií]a|te pido|pido|deseo|me traes?|tr[aá]eme|"
    r"me puedes traer|para navidad quiero)\s+(?:que me traigas\s+)?(?P<items>[^.!?\n]+)",
    re.IGNORECASE,
)
_LIST_ITEM = re.compile(r"^\s*(?:[-*•·]|\d+[.)])\s*(?P<item>.+)$", re.MULTILINE)
_SPLIT = re.compile(r",|\s+y\s+|\s+e\s+|\s+o\s+|;")
_ARTICLE = re.compile(r"^(?:un|una|unos|unas|el|la|los|las|mi|mis)\s+", re.IGNORECASE)

_FIXES = {
    r"\bkiero\b": "quiero",
    r"\bkerido\b": "querido",
    r"\bbiejito\b": "viejito",
    r"\bpaskuero\b": "pascuero",
    r"\bregalo s\b": "regalos",
    r"\bporfa\b": "por favor",
    r"\bxfa\b": "por favor",
    r"\bnavida\b": "navidad",
    r"\bboy\b": "voy",
    r"\bq\b": "que",
}


def normalize(text: str) -> str:
    out = text
    for pattern, repl in _FIXES.items():
        out = re.sub(pattern, repl, out, flags=re.IGNORECASE)
    out = re.sub(r"[ \t]+", " ", out)
    out = re.sub(r"\n{3,}", "\n\n", out).strip()
    # Mayúscula inicial en cada oración.
    return re.sub(r"(^|[.!?]\s+)([a-záéíóúñ])", lambda m: m.group(1) + m.group(2).upper(), out)


def extract_gifts(text: str) -> list[RegaloOut]:
    found: list[str] = []
    for m in _LIST_ITEM.finditer(text):
        found.append(m.group("item"))
    for m in _REQUEST.finditer(text):
        found.extend(_SPLIT.split(m.group("items")))
    gifts: list[RegaloOut] = []
    seen: set[str] = set()
    for raw in found:
        name = _ARTICLE.sub("", raw.strip(" .,;:-¡!"))
        name = re.sub(r"\s+(por favor|porfa|gracias).*$", "", name, flags=re.IGNORECASE).strip()
        if not (2 <= len(name) <= 60) or len(name.split()) > 7:
            continue
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        gifts.append(RegaloOut(nombre=name, prioridad=len(gifts) + 1 if len(gifts) < 10 else None))
    return gifts[:30]


def detect_tone(text: str) -> Tono:
    t = text.lower()
    if any(w in t for w in ("te quiero", "te amo", "abrazo", "besos", "cariño")):
        return "carinoso"
    if any(w in t for w in ("ojalá", "ojala", "sueño", "por favor", "porfa")):
        return "ilusionado"
    if t.count("!") >= 2 or any(w in t for w in ("jaja", "feliz", "yupi", "genial")):
        return "alegre"
    if any(w in t for w in ("si se puede", "si puedes", "no importa")):
        return "timido"
    return "neutral"
