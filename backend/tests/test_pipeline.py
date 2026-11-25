"""Pipeline OCR: preprocesamiento, criterio de fallback, PII y estados."""

from __future__ import annotations

import shutil
from pathlib import Path

import cv2
import pytest
from PIL import Image

from app.services.extraction import CartaExtraida, extract_gifts, normalize
from app.services.letter_pipeline import read_image
from app.services.ocr.engines import OcrLine, OcrResult, TesseractEngine
from app.services.ocr.preprocess import estimate_skew, load, preprocess, split_lines
from app.services.ocr.quality import evaluate, garbage_ratio
from app.services.pii import MASK, mask_pii
from app.services.uploads import UploadError, sniff_mime, validate_and_store
from app.services.vision_providers.base import VisionError, VisionReader, parse_model_json
from tests.conftest import FIXTURES, Client


# ---------- dobles de prueba ----------
class FakeEngine:
    name = "falso"

    def __init__(self, lines: list[tuple[str, float]]) -> None:
        self.lines = lines
        self.calls = 0

    def read(self, gray, binary) -> OcrResult:  # type: ignore[no-untyped-def]
        self.calls += 1
        return OcrResult(self.name, [OcrLine(t, c) for t, c in self.lines])


class FakeReader(VisionReader):
    name = "ia-falsa"
    external = False

    def __init__(self, fail: bool = False) -> None:
        self.fail = fail
        self.calls = 0

    def read(self, image_path: Path) -> CartaExtraida:
        self.calls += 1
        if self.fail:
            raise VisionError("no pude")
        return CartaExtraida(
            texto_original="kiero un perrito",
            texto_normalizado="Quiero un perrito",
            regalos=[{"nombre": "perrito", "prioridad": 1}],
            tono="ilusionado",
            confianza=0.8,
            metodo="ia",
        )


GOOD = [
    ("Querido Viejito Pascuero", 0.91),
    ("quiero una bicicleta roja", 0.88),
    ("me porté muy bien este año", 0.86),
]


# ---------- preprocesamiento ----------
def test_preprocess_outputs_binary_image() -> None:
    gray, binary = preprocess(load(FIXTURES / "carta_ruidosa.png"))
    assert gray.ndim == 2 and binary.ndim == 2
    assert set(map(int, (binary.min(), binary.max()))) <= {0, 255}
    assert len(split_lines(binary)) >= 4


def test_deskew_reduces_angle() -> None:
    img = load(FIXTURES / "carta_torcida.png")
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    before = abs(estimate_skew(gray))
    assert before > 3
    out, _ = preprocess(img)
    assert abs(estimate_skew(out)) < before


# ---------- criterio de fallo ----------
def test_quality_accepts_good_text() -> None:
    text = "\n".join(t for t, _ in GOOD)
    assert evaluate(text, 0.88).ok


@pytest.mark.parametrize(
    ("text", "conf", "motivo"),
    [
        ("Querido Viejito quiero una bicicleta", 0.42, "confianza"),
        ("xq zzk", 0.95, "palabras"),
        ("Querido Viejito quiero ### @@@ ~~~ ^^^ %%% {{{ }}} |||", 0.95, "basura"),
    ],
)
def test_quality_rejects(text: str, conf: float, motivo: str) -> None:
    q = evaluate(text, conf)
    assert not q.ok
    assert motivo in q.reason


def test_garbage_ratio() -> None:
    assert garbage_ratio("hola") == 0
    assert garbage_ratio("@@@@") == 1


def test_good_ocr_does_not_call_ai() -> None:
    engine, reader = FakeEngine(GOOD), FakeReader()
    out = read_image(FIXTURES / "carta_limpia.png", engine, reader)
    assert out.result is not None and out.result.metodo == "ocr"
    assert reader.calls == 0
    assert any(g.nombre.startswith("bicicleta") for g in out.result.regalos)


def test_low_confidence_falls_back_to_ai() -> None:
    engine = FakeEngine([("qu1ero un p3rr1to", 0.31)])
    reader = FakeReader()
    out = read_image(FIXTURES / "garabatos.png", engine, reader)
    assert reader.calls == 1
    assert out.result is not None and out.result.metodo == "ia"
    assert out.result.regalos[0].nombre == "perrito"


class HallucinatingReader(FakeReader):
    """Simula a TrOCR inventando texto en inglés sobre garabatos."""

    def read(self, image_path: Path) -> CartaExtraida:
        self.calls += 1
        return CartaExtraida(
            texto_original="a letter .",
            texto_normalizado="A letter.",
            confianza=0.39,
            metodo="ia",
        )


def test_ai_hallucination_is_rejected() -> None:
    out = read_image(FIXTURES / "garabatos.png", FakeEngine([("~~", 0.1)]), HallucinatingReader())
    assert out.result is None
    assert any(t.startswith("ia:ia-falsa:confianza baja") for t in out.trace)


def test_reprocessing_a_finished_letter_is_a_noop(parent: Client, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from app.services import letter_pipeline

    monkeypatch.setattr(letter_pipeline, "get_engine", lambda: FakeEngine(GOOD))
    monkeypatch.setattr(letter_pipeline, "get_reader", lambda allow: None)
    child = _child(parent)
    with (FIXTURES / "carta_limpia.png").open("rb") as f:
        lid = parent.post(
            "/api/letters/upload",
            data={"child_id": child},
            files={"file": ("c.png", f, "image/png")},
        ).json()["id"]
    before = parent.get(f"/api/letters/{lid}").json()
    assert before["status"] == "leida"
    letter_pipeline.process_letter(lid)  # reintento de la cola
    after = parent.get(f"/api/letters/{lid}").json()
    assert after["status"] == "leida"
    assert after["texto_original"] == before["texto_original"]


def test_everything_fails_returns_none() -> None:
    out = read_image(FIXTURES / "garabatos.png", FakeEngine([("~~", 0.1)]), FakeReader(fail=True))
    assert out.result is None
    assert any("ia:ia-falsa" in t for t in out.trace)


def test_no_engine_no_reader() -> None:
    out = read_image(FIXTURES / "garabatos.png", None, None)
    assert out.result is None
    assert out.trace == ["ocr:sin_motor", "ia:sin_proveedor"]


@pytest.mark.skipif(shutil.which("tesseract") is None, reason="Tesseract no instalado")
def test_real_tesseract_reads_clean_letter() -> None:
    engine = TesseractEngine()
    gray, binary = preprocess(load(FIXTURES / "carta_limpia.png"))
    res = engine.read(gray, binary)
    assert "bicicleta" in res.text.lower()


# ---------- extracción y PII ----------
def test_extract_gifts_from_sentences_and_lists() -> None:
    gifts = extract_gifts("Hola! Quiero una muñeca, un puzzle y una pelota.\n- Lego de autos")
    names = [g.nombre for g in gifts]
    assert names[:4] == ["Lego de autos", "muñeca", "puzzle", "pelota"] or set(names) >= {
        "muñeca",
        "puzzle",
        "pelota",
        "Lego de autos",
    }


def test_normalize_fixes_common_spelling() -> None:
    assert normalize("kerido biejito paskuero, kiero una pelota").startswith(
        "Querido viejito pascuero, quiero"
    )


def test_mask_pii() -> None:
    text = (
        "Mi rut es 21.345.678-9, mi teléfono +56 9 8765 4321, vivo en calle Los Aromos 123 "
        "y voy al Colegio San Pedro. Mail papa@correo.cl"
    )
    masked, found = mask_pii(text)
    assert found
    for leaked in ("21.345.678-9", "8765", "Aromos 123", "San Pedro", "papa@correo.cl"):
        assert leaked not in masked
    assert masked.count(MASK) >= 4
    assert mask_pii("Quiero una pelota")[1] is False


def test_parse_model_json_validates() -> None:
    raw = '```json\n{"texto_original": "kiero", "regalos": [{"nombre": "auto"}], "tono": "alegre"}\n```'
    data = parse_model_json(raw)
    assert data.metodo == "ia" and data.regalos[0].nombre == "auto"
    with pytest.raises(VisionError):
        parse_model_json('{"texto_original": "x", "tono": "furioso"}')
    with pytest.raises(VisionError):
        parse_model_json("sin json")


# ---------- validación de archivos ----------
def test_sniff_mime_ignores_extension() -> None:
    assert sniff_mime(b"\x89PNG\r\n\x1a\n....") == "image/png"
    assert sniff_mime(b"%PDF-1.7") == "application/pdf"
    assert sniff_mime(b"\x00\x00\x00\x18ftypheic") == "image/heic"
    assert sniff_mime(b"<script>alert(1)</script>") is None


def test_upload_strips_exif_and_gps() -> None:
    src = FIXTURES / "carta_con_gps.jpg"
    assert Image.open(src).getexif().get(0x8825)
    stored = validate_and_store(src.read_bytes())
    clean = Image.open(stored.path)
    assert not clean.getexif()
    assert "exif" not in clean.info


def test_upload_rejects_bad_files() -> None:
    with pytest.raises(UploadError):
        validate_and_store(b"")
    with pytest.raises(UploadError, match="Formato"):
        validate_and_store(b"MZ\x90\x00 esto es un exe")
    with pytest.raises(UploadError, match="MB"):
        validate_and_store(b"\x89PNG\r\n\x1a\n" + b"0" * (11 * 1024 * 1024))


# ---------- flujo HTTP completo ----------
def _child(c: Client) -> str:
    return c.post("/api/children", json={"nickname": "Sofi", "age": 7}).json()["id"]


def test_written_letter_is_read_and_masked(parent: Client) -> None:
    child = _child(parent)
    r = parent.post(
        "/api/letters",
        json={
            "child_id": child,
            "deseos": ["bicicleta", "libro de dinosaurios"],
            "mensaje": "Hola Viejito! mi fono es 9 1234 5678",
        },
    )
    assert r.status_code == 202
    letter = parent.get(f"/api/letters/{r.json()['id']}").json()
    assert letter["status"] == "leida"
    assert letter["metodo"] == "escrita"
    assert [g["nombre"] for g in letter["gifts"]] == ["bicicleta", "libro de dinosaurios"]
    assert "1234 5678" not in letter["texto_original"]
    assert letter["pii_masked"]


def test_upload_without_engines_needs_help_then_manual(parent: Client, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from app.services import letter_pipeline

    monkeypatch.setattr(letter_pipeline, "get_engine", lambda: None)
    monkeypatch.setattr(letter_pipeline, "get_reader", lambda allow: None)
    child = _child(parent)
    with (FIXTURES / "garabatos.png").open("rb") as f:
        r = parent.post(
            "/api/letters/upload",
            data={"child_id": child},
            files={"file": ("carta.png", f, "image/png")},
        )
    assert r.status_code == 202, r.text
    lid = r.json()["id"]
    letter = parent.get(f"/api/letters/{lid}").json()
    assert letter["status"] == "necesita_ayuda"
    assert letter["has_image"]
    assert parent.get(f"/api/letters/{lid}/image").status_code == 200

    r = parent.patch(
        f"/api/letters/{lid}",
        json={
            "texto_original": "Quiero un trompo",
            "gifts": [{"nombre": "trompo", "marcado": True}],
        },
    )
    letter = r.json()
    assert letter["status"] == "leida" and letter["metodo"] == "manual"
    assert letter["gifts"][0]["marcado"] is True
    assert not letter["has_image"]  # se borra tras transcribir (retención)


def test_upload_with_fake_ai(parent: Client, monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from app.services import letter_pipeline

    monkeypatch.setattr(letter_pipeline, "get_engine", lambda: FakeEngine([("@@", 0.2)]))
    monkeypatch.setattr(letter_pipeline, "get_reader", lambda allow: FakeReader())
    child = _child(parent)
    with (FIXTURES / "carta_ruidosa.png").open("rb") as f:
        r = parent.post(
            "/api/letters/upload",
            data={"child_id": child},
            files={"file": ("carta.png", f, "image/png")},
        )
    letter = parent.get(f"/api/letters/{r.json()['id']}").json()
    assert letter["status"] == "leida" and letter["metodo"] == "ia"
    assert letter["gifts"][0]["nombre"] == "perrito"
    assert not letter["has_image"]


def test_upload_rejects_fake_png(parent: Client) -> None:
    child = _child(parent)
    r = parent.post(
        "/api/letters/upload",
        data={"child_id": child},
        files={"file": ("carta.png", b"<html>no soy imagen</html>", "image/png")},
    )
    assert r.status_code == 415


def test_external_provider_requires_consent(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    from app.core.config import get_settings
    from app.services import vision_providers

    monkeypatch.setattr(get_settings(), "vision_provider", "gemini")
    vision_providers._instance.cache_clear()
    assert vision_providers.get_reader(allow_external=False).name == "trocr"
    assert vision_providers.get_reader(allow_external=True).name == "gemini"
    vision_providers._instance.cache_clear()
