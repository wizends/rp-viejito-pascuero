from __future__ import annotations

from fastapi import APIRouter, HTTPException, Response

from app.api.deps import DB, CurrentUser, own_child
from app.models import Child
from app.schemas import ChildIn, ChildOut, ChildPatch

router = APIRouter(prefix="/children", tags=["niños"])
MAX_CHILDREN = 12


@router.get("", response_model=list[ChildOut])
def list_children(user: CurrentUser) -> list[Child]:
    return list(user.children)


@router.post("", response_model=ChildOut, status_code=201)
def create_child(body: ChildIn, user: CurrentUser, db: DB) -> Child:
    if len(user.children) >= MAX_CHILDREN:
        raise HTTPException(400, "¡Son muchos duendecitos! El máximo es 12 perfiles.")
    child = Child(user_id=user.id, nickname=body.nickname.strip(), age=body.age, avatar=body.avatar)
    db.add(child)
    db.commit()
    return child


@router.patch("/{child_id}", response_model=ChildOut)
def update_child(child_id: str, body: ChildPatch, user: CurrentUser, db: DB) -> Child:
    child = own_child(db, user, child_id)
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(child, k, v)
    db.commit()
    return child


@router.delete("/{child_id}", status_code=204)
def delete_child(child_id: str, user: CurrentUser, db: DB) -> Response:
    child = own_child(db, user, child_id)
    from pathlib import Path

    for letter in child.letters:
        if letter.image_path:
            Path(letter.image_path).unlink(missing_ok=True)
    db.delete(child)
    db.commit()
    return Response(status_code=204)
