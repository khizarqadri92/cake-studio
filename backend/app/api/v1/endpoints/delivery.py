import uuid
from pydantic import BaseModel, model_validator
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, select
from app.core.database import get_session
from app.core.permissions import require_any_permission, require_permission
from app.services.audit import log_audit
from app.models.delivery import DeliveryZone

router = APIRouter()


class DeliveryZoneIn(BaseModel):
    name: str | None = None
    distance_from_km: float
    distance_to_km: float
    price: float = 0
    is_active: bool = True
    sort_order: int = 0

    @model_validator(mode="after")
    def check_range(self):
        if self.distance_from_km < 0 or self.distance_to_km < 0:
            raise ValueError("Distances can't be negative")
        if self.distance_from_km >= self.distance_to_km:
            raise ValueError("'Distance from' must be less than 'distance to'")
        return self


def _overlaps(session: Session, payload: DeliveryZoneIn, exclude_id: uuid.UUID | None = None) -> bool:
    existing = session.exec(select(DeliveryZone)).all()
    for zone in existing:
        if exclude_id and zone.id == exclude_id:
            continue
        # Two ranges overlap unless one ends before the other starts.
        if payload.distance_from_km < zone.distance_to_km and zone.distance_from_km < payload.distance_to_km:
            return True
    return False


@router.get("", response_model=list[DeliveryZone])
def list_zones(
    session: Session = Depends(get_session),
    _staff_id: str = Depends(require_any_permission("delivery_zones.page.view", "orders.page.view")),
):
    return session.exec(select(DeliveryZone).order_by(DeliveryZone.distance_from_km)).all()


@router.post("", response_model=DeliveryZone)
def create_zone(
    payload: DeliveryZoneIn,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("delivery_zones.button.create")),
):
    if _overlaps(session, payload):
        raise HTTPException(status_code=400, detail="This distance range overlaps an existing zone")
    zone = DeliveryZone(**payload.model_dump())
    session.add(zone)
    session.commit()
    session.refresh(zone)
    log_audit(session, "delivery_zone.created", actor_staff_id=uuid.UUID(staff_id), target_type="delivery_zone", target_id=str(zone.id))
    return zone


@router.put("/{zone_id}", response_model=DeliveryZone)
def update_zone(
    zone_id: uuid.UUID,
    payload: DeliveryZoneIn,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("delivery_zones.field.edit")),
):
    zone = session.get(DeliveryZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Not found")
    if _overlaps(session, payload, exclude_id=zone_id):
        raise HTTPException(status_code=400, detail="This distance range overlaps an existing zone")
    for key, value in payload.model_dump().items():
        setattr(zone, key, value)
    session.add(zone)
    session.commit()
    session.refresh(zone)
    log_audit(session, "delivery_zone.updated", actor_staff_id=uuid.UUID(staff_id), target_type="delivery_zone", target_id=str(zone_id))
    return zone


@router.delete("/{zone_id}")
def delete_zone(
    zone_id: uuid.UUID,
    session: Session = Depends(get_session),
    staff_id: str = Depends(require_permission("delivery_zones.button.delete")),
):
    zone = session.get(DeliveryZone, zone_id)
    if not zone:
        raise HTTPException(status_code=404, detail="Not found")
    session.delete(zone)
    session.commit()
    log_audit(session, "delivery_zone.deleted", actor_staff_id=uuid.UUID(staff_id), target_type="delivery_zone", target_id=str(zone_id))
    return {"status": "ok"}
