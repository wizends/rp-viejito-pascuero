"""Fábrica de lectores de visión según VISION_PROVIDER y el consentimiento del padre."""

from __future__ import annotations

from functools import lru_cache

from app.core.config import get_settings
from app.services.vision_providers.base import VisionError, VisionReader
from app.services.vision_providers.external import GeminiReader, GroqReader, OpenRouterReader
from app.services.vision_providers.trocr import TrOcrReader

__all__ = ["VisionError", "VisionReader", "get_reader"]

_REGISTRY: dict[str, type[VisionReader]] = {
    "trocr": TrOcrReader,
    "gemini": GeminiReader,
    "groq": GroqReader,
    "openrouter": OpenRouterReader,
}


@lru_cache
def _instance(name: str) -> VisionReader:
    return _REGISTRY[name]()


def get_reader(allow_external: bool) -> VisionReader | None:
    """Si el proveedor configurado es externo y el padre no lo aceptó, se usa TrOCR local."""
    name = get_settings().vision_provider
    if name == "none":
        return None
    reader = _instance(name)
    if reader.external and not allow_external:
        return _instance("trocr")
    return reader
