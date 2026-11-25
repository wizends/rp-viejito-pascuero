"""Configuración central leída desde variables de entorno (.env)."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

DEV_SECRET = "solo-desarrollo-cambiar-en-produccion"  # noqa: S105
# Carpeta backend/: las rutas por defecto no dependen del directorio desde donde se lance.
BASE_DIR = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(BASE_DIR.parent / ".env", BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # General
    environment: Literal["development", "production", "test"] = "development"
    app_name: str = "Buzón del Viejito Pascuero"
    database_url: str = f"sqlite:///{(BASE_DIR / 'buzon.db').as_posix()}"
    redis_url: str = "redis://localhost:6379/0"
    task_backend: Literal["inline", "rq"] = "inline"
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://localhost:5183",
            "http://localhost:8080",
        ]
    )

    # Seguridad
    secret_key: str = DEV_SECRET
    access_token_minutes: int = 15
    refresh_token_days: int = 14
    cookie_secure: bool = False
    cookie_samesite: Literal["lax", "strict"] = "lax"

    # Rate limiting (peticiones por ventana)
    rate_limit_window_seconds: int = 60
    rate_limit_ip: int = 120
    rate_limit_auth: int = 10
    rate_limit_uploads: int = 12

    # Archivos
    upload_dir: Path = BASE_DIR / "data" / "uploads"
    max_upload_mb: int = 10
    delete_images_after_processing: bool = True
    retention_days: int = 60

    # OCR
    ocr_engine: Literal["easyocr", "paddleocr", "tesseract", "auto"] = "auto"
    ocr_min_confidence: float = 0.60
    ocr_min_valid_words: int = 3
    ocr_max_garbage_ratio: float = 0.35

    # IA de visión (fallback)
    # La IA de visión también se valida (palabras en español, basura) con este umbral.
    vision_min_confidence: float = 0.5
    vision_provider: Literal["trocr", "gemini", "groq", "openrouter", "none"] = "trocr"
    trocr_model: str = "microsoft/trocr-base-handwritten"
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash"
    groq_api_key: str = ""
    groq_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    openrouter_api_key: str = ""
    openrouter_model: str = "qwen/qwen2.5-vl-72b-instruct:free"

    # Tracking
    timezone: str = "America/Santiago"
    auto_advance_interval_seconds: int = 30

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, v: object) -> object:
        if isinstance(v, str) and not v.startswith("["):
            return [o.strip() for o in v.split(",") if o.strip()]
        return v

    @model_validator(mode="after")
    def _prod_guard(self) -> Settings:
        if self.environment == "production":
            if self.secret_key == DEV_SECRET or len(self.secret_key) < 32:
                raise ValueError("SECRET_KEY debe ser aleatoria y de al menos 32 caracteres")
            if not self.cookie_secure:
                raise ValueError("COOKIE_SECURE debe ser true en producción")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
