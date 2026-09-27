import uuid
from typing import Type
from fastapi import APIRouter, Depends, HTTPException
from pydantic import create_model
from sqlmodel import SQLModel, Session, select
from app.core.database import get_session
from app.core.permissions import require_permission


def make_catalog_router(model: Type[SQLModel], permission_prefix: str) -> APIRouter:
    """Builds list/create/update/delete endpoints for a simple catalog table.

    permission_prefix drives the permission keys, e.g. "cake_flavor" gives
    cake_flavor.page.view, cake_flavor.button.create, cake_flavor.field.edit,
    cake_flavor.button.delete - following the same convention as every other
    module in this app.
    """
    router = APIRouter()

    # Build a "create/update" schema = every model field except id, since
    # that's generated server-side.
    create_fields = {}
    for name, field in model.model_fields.items():
        if name == "id":
            continue
        default = ... if field.is_required() else field.default
        create_fields[name] = (field.annotation, default)
    CreateSchema = create_model(f"{model.__name__}Create", **create_fields)

    @router.get("", response_model=list[model])
    def list_items(
        session: Session = Depends(get_session),
        _staff_id: str = Depends(require_permission(f"{permission_prefix}.page.view")),
    ):
        return session.exec(select(model).order_by(model.sort_order)).all()

    @router.post("", response_model=model)
    def create_item(
        payload: CreateSchema,
        session: Session = Depends(get_session),
        _staff_id: str = Depends(require_permission(f"{permission_prefix}.button.create")),
    ):
        existing = session.exec(select(model).where(model.name == payload.name)).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"'{payload.name}' already exists")
        item = model(**payload.model_dump())
        session.add(item)
        session.commit()
        session.refresh(item)
        return item

    @router.put("/{item_id}", response_model=model)
    def update_item(
        item_id: uuid.UUID,
        payload: CreateSchema,
        session: Session = Depends(get_session),
        _staff_id: str = Depends(require_permission(f"{permission_prefix}.field.edit")),
    ):
        item = session.get(model, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        for key, value in payload.model_dump().items():
            setattr(item, key, value)
        session.add(item)
        session.commit()
        session.refresh(item)
        return item

    @router.delete("/{item_id}")
    def delete_item(
        item_id: uuid.UUID,
        session: Session = Depends(get_session),
        _staff_id: str = Depends(require_permission(f"{permission_prefix}.button.delete")),
    ):
        item = session.get(model, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        session.delete(item)
        session.commit()
        return {"status": "ok"}

    return router
