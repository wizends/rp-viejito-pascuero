"""Validación de archivos subidos: tipo MIME real, tamaño y re-codificación sin EXIF."""

from __future__ import annotations

import io
import uuid
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps

from app.core.config import get_settings

# Evita "bombas de descompresión".
Image.MAX_IMAGE_PIXELS = 40_000_000
MAX_SIDE = 2400


class UploadError(ValueError):
    pass


@dataclass(frozen=True)
class StoredImage:
    path: Path
    width: int
    height: int


def sniff_mime(head: bytes) -> str | None:
    """Detecta el tipo por *magic bytes*, ignorando extensión y Content-Type del cliente."""
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    if (
        len(head) >= 12
        and head[4:8] == b"ftyp"
        and head[8:12]
        in {
            b"heic",
            b"heix",
            b"hevc",
            b"hevx",
            b"mif1",
            b"msf1",
            b"heim",
            b"heis",
        }
    ):
        return "image/heic"
    return None


def _open_image(data: bytes, mime: str) -> Image.Image:
    if mime == "application/pdf":
        import pypdfium2 as pdfium

        pdf = pdfium.PdfDocument(data)
        try:
            if len(pdf) < 1:
                raise UploadError("El PDF está vacío.")
            if len(pdf) > 5:
                raise UploadError("El PDF tiene demasiadas páginas (máximo 5).")
            page = pdf[0]
            rendered: Image.Image = page.render(scale=2.0).to_pil()
            return rendered
        finally:
            pdf.close()
    if mime == "image/heic":
        from pillow_heif import register_heif_opener

        register_heif_opener()
    img = Image.open(io.BytesIO(data))
    img.load()
    opened: Image.Image = img
    return opened


def validate_and_store(data: bytes) -> StoredImage:
    s = get_settings()
    if len(data) == 0:
        raise UploadError("El archivo está vacío.")
    if len(data) > s.max_upload_mb * 1024 * 1024:
        raise UploadError(f"El archivo supera los {s.max_upload_mb} MB.")
    mime = sniff_mime(data[:32])
    if mime is None:
        raise UploadError("Formato no permitido. Usa JPG, PNG, HEIC o PDF.")
    try:
        img = _open_image(data, mime)
    except UploadError:
        raise
    except Exception as exc:
        raise UploadError("No pudimos abrir la imagen. ¿Está dañada?") from exc

    # Aplica la orientación EXIF y luego re-codifica desde los píxeles:
    # así se descartan EXIF, GPS y cualquier metadato o carga extra.
    img = ImageOps.exif_transpose(img).convert("RGB")
    img.thumbnail((MAX_SIDE, MAX_SIDE))
    clean = Image.new("RGB", img.size)
    clean.paste(img)

    s.upload_dir.mkdir(parents=True, exist_ok=True)
    path = s.upload_dir / f"{uuid.uuid4().hex}.png"
    clean.save(path, format="PNG", optimize=True)
    return StoredImage(path=path, width=clean.width, height=clean.height)
