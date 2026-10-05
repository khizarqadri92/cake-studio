import uuid
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.permissions import require_any_permission, require_permission
from app.services.audit import log_audit
from app.models.catalog import CakeFlavor, CakeFilling, CakeFrosting, CakeShape, CakeSize, Theme, CakeAddon, CakeBox, CakeTier, CakeColor


# --- shared schema for the four catalogs with identical field shapes ---
class NamedCatalogIn(BaseModel):
    name: str
    description: str | None = None
    price_modifier: float = 0
    image_url: str | None = None
    is_active: bool = True
    sort_order: int = 0


class SizeIn(BaseModel):
    name: str
    servings: int | None = None
    price_modifier: float = 0
    is_active: bool = True
    sort_order: int = 0


class ThemeIn(BaseModel):
    name: str
    description: str | None = None
    image_url: str | None = None
    is_active: bool = True
    sort_order: int = 0


class AddonIn(BaseModel):
    name: str
    description: str | None = None
    price: float = 0
    max_qty: int = 1
    image_url: str | None = None
    is_active: bool = True
    sort_order: int = 0


def build_catalog_router(model_cls, schema_cls, permission_prefix: str, audit_label: str) -> APIRouter:
    """Generates list/create/update/delete endpoints for one catalog table.

    Used seven times below (flavours, fillings, frostings, shapes, sizes,
    themes, add-ons) instead of writing near-identical CRUD code per
    catalog. Each catalog still gets its own permission keys and its own
    input schema, since their actual fields aren't quite identical.
    """
    router = APIRouter()

    @router.get("", response_model=list[model_cls])
    def list_items(
        session: Session = Depends(get_session),
        # Read: whoever manages this list, or anyone working with orders (the
        # order form needs it). Create / edit / delete stay restricted below.
        _staff_id: str = Depends(require_any_permission(f"{permission_prefix}.page.view", "orders.page.view")),
    ):
        return session.exec(select(model_cls).order_by(model_cls.sort_order, model_cls.name)).all()

    @router.post("", response_model=model_cls)
    def create_item(
        payload: schema_cls,
        session: Session = Depends(get_session),
        staff_id: str = Depends(require_permission(f"{permission_prefix}.button.create")),
    ):
        if session.exec(select(model_cls).where(model_cls.name == payload.name)).first():
            raise HTTPException(status_code=400, detail=f'"{payload.name}" already exists')
        item = model_cls(**payload.model_dump())
        session.add(item)
        session.commit()
        session.refresh(item)
        log_audit(
            session, f"{audit_label}.created", actor_staff_id=uuid.UUID(staff_id),
            target_type=audit_label, target_id=str(item.id),
        )
        return item

    @router.put("/{item_id}", response_model=model_cls)
    def update_item(
        item_id: uuid.UUID,
        payload: schema_cls,
        session: Session = Depends(get_session),
        staff_id: str = Depends(require_permission(f"{permission_prefix}.field.edit")),
    ):
        item = session.get(model_cls, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        clash = session.exec(
            select(model_cls).where(model_cls.name == payload.name, model_cls.id != item_id)
        ).first()
        if clash:
            raise HTTPException(status_code=400, detail=f'"{payload.name}" already exists')
        for key, value in payload.model_dump().items():
            setattr(item, key, value)
        session.add(item)
        session.commit()
        session.refresh(item)
        log_audit(
            session, f"{audit_label}.updated", actor_staff_id=uuid.UUID(staff_id),
            target_type=audit_label, target_id=str(item_id),
        )
        return item

    @router.delete("/{item_id}")
    def delete_item(
        item_id: uuid.UUID,
        session: Session = Depends(get_session),
        staff_id: str = Depends(require_permission(f"{permission_prefix}.button.delete")),
    ):
        item = session.get(model_cls, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="Not found")
        session.delete(item)
        session.commit()
        log_audit(
            session, f"{audit_label}.deleted", actor_staff_id=uuid.UUID(staff_id),
            target_type=audit_label, target_id=str(item_id),
        )
        return {"status": "ok"}

    return router


flavors_router = build_catalog_router(CakeFlavor, NamedCatalogIn, "cake_flavors", "cake_flavor")
fillings_router = build_catalog_router(CakeFilling, NamedCatalogIn, "cake_fillings", "cake_filling")
frostings_router = build_catalog_router(CakeFrosting, NamedCatalogIn, "cake_frostings", "cake_frosting")
shapes_router = build_catalog_router(CakeShape, NamedCatalogIn, "cake_shapes", "cake_shape")
sizes_router = build_catalog_router(CakeSize, SizeIn, "cake_sizes", "cake_size")
themes_router = build_catalog_router(Theme, ThemeIn, "themes", "theme")
addons_router = build_catalog_router(CakeAddon, AddonIn, "cake_addons", "cake_addon")
boxes_router = build_catalog_router(CakeBox, NamedCatalogIn, "cake_boxes", "cake_box")
tiers_router = build_catalog_router(CakeTier, NamedCatalogIn, "cake_tiers", "cake_tier")
colors_router = build_catalog_router(CakeColor, NamedCatalogIn, "cake_colors", "cake_color")
