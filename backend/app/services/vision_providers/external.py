"""Proveedores externos con capa gratuita. Solo se usan con API key y consentimiento del padre."""

from __future__ import annotations

import base64
from pathlib import Path

import httpx

from app.core.config import get_settings
from app.services.extraction import CartaExtraida
from app.services.vision_providers.base import PROMPT, VisionError, VisionReader, parse_model_json

TIMEOUT = httpx.Timeout(60.0, connect=10.0)


def _b64(path: Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


class GeminiReader(VisionReader):
    name = "gemini"
    external = True

    def read(self, image_path: Path) -> CartaExtraida:
        s = get_settings()
        if not s.gemini_api_key:
            raise VisionError("Falta GEMINI_API_KEY")
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{s.gemini_model}:generateContent"
        body = {
            "contents": [
                {
                    "parts": [
                        {"text": PROMPT},
                        {"inline_data": {"mime_type": "image/png", "data": _b64(image_path)}},
                    ]
                }
            ],
            "generationConfig": {"responseMimeType": "application/json", "temperature": 0.1},
        }
        r = httpx.post(
            url, json=body, headers={"x-goog-api-key": s.gemini_api_key}, timeout=TIMEOUT
        )
        if r.status_code != 200:
            raise VisionError(f"Gemini respondió {r.status_code}")
        try:
            text = r.json()["candidates"][0]["content"]["parts"][0]["text"]
        except (KeyError, IndexError) as exc:
            raise VisionError("Respuesta inesperada de Gemini") from exc
        return parse_model_json(text)


class _OpenAICompatReader(VisionReader):
    external = True
    url: str
    model_attr: str
    key_attr: str

    def read(self, image_path: Path) -> CartaExtraida:
        s = get_settings()
        key = getattr(s, self.key_attr)
        if not key:
            raise VisionError(f"Falta {self.key_attr.upper()}")
        body = {
            "model": getattr(s, self.model_attr),
            "temperature": 0.1,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": PROMPT},
                        {
                            "type": "image_url",
                            "image_url": {"url": f"data:image/png;base64,{_b64(image_path)}"},
                        },
                    ],
                }
            ],
        }
        r = httpx.post(
            self.url, json=body, headers={"Authorization": f"Bearer {key}"}, timeout=TIMEOUT
        )
        if r.status_code != 200:
            raise VisionError(f"{self.name} respondió {r.status_code}")
        try:
            text = r.json()["choices"][0]["message"]["content"]
        except (KeyError, IndexError) as exc:
            raise VisionError(f"Respuesta inesperada de {self.name}") from exc
        return parse_model_json(text)


class GroqReader(_OpenAICompatReader):
    name = "groq"
    url = "https://api.groq.com/openai/v1/chat/completions"
    model_attr = "groq_model"
    key_attr = "groq_api_key"


class OpenRouterReader(_OpenAICompatReader):
    name = "openrouter"
    url = "https://openrouter.ai/api/v1/chat/completions"
    model_attr = "openrouter_model"
    key_attr = "openrouter_api_key"
