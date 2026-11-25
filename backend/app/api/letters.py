from __future__ import annotations

from pathlib import Path

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.responses import FileResponse
from sqlalchemy import select

from app.api.deps import DB, CurrentUser, own_child, own_letter
from app.core.config import get_settings
from app.core.ratelimit import limit_upload_for
from app.models import Child, Gift, Letter, LetterStatus
from app.schemas import LetterOut, LetterPatch, LetterWriteIn
from app.services import letter_pipeline
from app.services.pii import mask_pii
from app.services.uploads import UploadError, validate_and_store

router = APIRouter(prefix="/letters", tags=["cartas"])


def to_out(letter: Letter) -> LetterOut:
    out = LetterOut.model_validate(
        {
            **{
                c: getattr(letter, c)
                for c in LetterOut.model_fields
                if c not in {"has_image", "gifts"}
            },
            "has_image": bool(letter.image_path),
            "gifts": letter.gifts,
        }
    )
    return out


@router.get("", response_model=list[LetterOut])
def list_letters(user: CurrentUser, db: DB, child_id: str | None = None) -> list[LetterOut]:
    q = select(Letter).join(Child).where(Child.user_id == user.id)
    if child_id:
        q = q.where(Letter.child_id == child_id)
    return [to_out(letter) for letter in db.scalars(q.order_by(Letter.created_at.desc())).all()]


@router.get("/{letter_id}", response_model=LetterOut)
def get_letter(letter_id: str, user: CurrentUser, db: DB) -> LetterOut:
    return to_out(own_letter(db, user, letter_id))


@router.get("/{letter_id}/image")
def get_letter_image(letter_id: str, user: CurrentUser, db: DB) -> FileResponse:
    letter = own_letter(db, user, letter_id)
    if not letter.image_path or not Path(letter.image_path).exists():
        raise HTTPException(404, "La imagen ya fue borrada por privacidad.")
    return FileResponse(
        letter.image_path, media_type="image/png", headers={"Cache-Control": "private, no-store"}
    )


@router.post("", response_model=LetterOut, status_code=202)
def write_letter(
    body: LetterWriteIn, user: CurrentUser, db: DB, background: BackgroundTasks, request: Request
) -> LetterOut:
    limit_upload_for(user.id, request)
    child = own_child(db, user, body.child_id)
    if not body.deseos and not body.mensaje.strip():
        raise HTTPException(422, "La carta está vacía. ¡Cuéntale algo al Viejito!")
    lines = [body.mensaje.strip()] if body.mensaje.strip() else []
    if body.deseos:
        lines.append("Mis deseos:\n" + "\n".join(f"- {d}" for d in body.deseos))
    letter = Letter(
        child_id=child.id,
        source="escrita",
        mensaje=mask_pii(body.mensaje)[0],
        texto_original="\n\n".join(lines),
        gifts=[
            Gift(nombre=d, prioridad=i + 1 if i < 10 else None, position=i)
            for i, d in enumerate(body.deseos)
        ],
    )
    db.add(letter)
    db.commit()
    letter_pipeline.enqueue(letter.id, background)
    return to_out(letter)


@router.post("/upload", response_model=LetterOut, status_code=202)
async def upload_letter(
    request: Request,
    user: CurrentUser,
    db: DB,
    background: BackgroundTasks,
    child_id: str = Form(...),
    mensaje: str = Form("", max_length=2000),
    file: UploadFile = File(...),
) -> LetterOut:
    limit_upload_for(user.id, request)
    child = own_child(db, user, child_id)
    limit = get_settings().max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)
    try:
        stored = validate_and_store(data)
    except UploadError as exc:
        raise HTTPException(415 if "Formato" in str(exc) else 400, str(exc)) from exc
    letter = Letter(
        child_id=child.id, source="foto", mensaje=mask_pii(mensaje)[0], image_path=str(stored.path)
    )
    db.add(letter)
    db.commit()
    letter_pipeline.enqueue(letter.id, background)
    return to_out(letter)


@router.patch("/{letter_id}", response_model=LetterOut)
def update_letter(letter_id: str, body: LetterPatch, user: CurrentUser, db: DB) -> LetterOut:
    letter = own_letter(db, user, letter_id)
    edited_text = False
    if body.texto_original is not None:
        letter.texto_original = body.texto_original
        edited_text = True
    if body.texto_normalizado is not None:
        letter.texto_normalizado = body.texto_normalizado
        edited_text = True
    if body.gifts is not None:
        letter.gifts.clear()
        for i, g in enumerate(body.gifts):
            letter.gifts.append(
                Gift(nombre=g.nombre, prioridad=g.prioridad, marcado=g.marcado, position=i)
            )
    if edited_text and letter.source == "foto":
        letter.metodo = "manual"
        letter.confianza = 1.0
    if letter.status == LetterStatus.NECESITA_AYUDA and edited_text:
        letter.status = LetterStatus.LEIDA.value
        if get_settings().delete_images_after_processing and letter.image_path:
            from datetime import UTC, datetime

            Path(letter.image_path).unlink(missing_ok=True)
            letter.image_path = None
            letter.image_deleted_at = datetime.now(UTC)
    db.commit()
    return to_out(letter)


@router.delete("/{letter_id}", status_code=204)
def delete_letter(letter_id: str, user: CurrentUser, db: DB) -> Response:
    letter = own_letter(db, user, letter_id)
    if letter.image_path:
        Path(letter.image_path).unlink(missing_ok=True)
    db.delete(letter)
    db.commit()
    return Response(status_code=204)
