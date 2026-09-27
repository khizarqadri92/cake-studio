"""Reports. Every period report takes ?start=YYYY-MM-DD&end=YYYY-MM-DD
(inclusive) and counts by business (processing) date, never the PC clock.

Cake cost = quantity of each ingredient the baker logged for the order x
that ingredient's weighted average purchase price (total spent / quantity
bought). Ingredients never bought through Purchases have no known cost;
those orders are flagged rather than guessed.
"""
from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.permissions import require_permission
from app.models.catalog import CakeAddon, CakeFlavor, CakeSize, CakeTier, Theme
from app.models.customer import Customer
from app.models.inventory import InventoryItem, Purchase, PurchaseItem, StockMovement, Supplier
from app.models.orders import FulfillmentType, Order, OrderIngredientUsage, OrderItem, OrderItemAddon, OrderStatus
from app.models.organization import Organization
from app.models.staff import Staff
from app.api.v1.endpoints.inventory import unit_label

router = APIRouter()

NOT_SALES = (OrderStatus.DRAFT, OrderStatus.CANCELLED)  # drafts aren't agreed yet; cancelled never happened


# ---------------------------------------------------------------- helpers

def _period(start: date, end: date) -> tuple[date, date]:
    if start > end:
        raise HTTPException(status_code=400, detail="The start date must be on or before the end date")
    if (end - start).days > 3660:
        raise HTTPException(status_code=400, detail="Choose a period of 10 years or less")
    return start, end


def _days(start: date, end: date) -> list[date]:
    return [start + timedelta(days=i) for i in range((end - start).days + 1)]


def _series_bucket(start: date, end: date) -> str:
    """Daily points for up to ~2 months, monthly beyond that."""
    return "day" if (end - start).days <= 62 else "month"


def _bucket_key(d: date, bucket: str) -> str:
    return d.isoformat() if bucket == "day" else d.strftime("%Y-%m")


def _bucket_keys(start: date, end: date, bucket: str) -> list[str]:
    if bucket == "day":
        return [d.isoformat() for d in _days(start, end)]
    keys, d = [], date(start.year, start.month, 1)
    while d <= end:
        keys.append(d.strftime("%Y-%m"))
        d = date(d.year + (d.month == 12), d.month % 12 + 1, 1)
    return keys


def _local_date(ts: datetime | None, tz_name: str) -> date | None:
    """Timestamps are stored in UTC; convert to the business's time zone."""
    if not ts:
        return None
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(tz_name)
    except Exception:  # time zone data unavailable - fall back to UTC
        tz = timezone.utc
    if ts.tzinfo is None:
        ts = ts.replace(tzinfo=timezone.utc)
    return ts.astimezone(tz).date()


def _tz(session: Session) -> str:
    org = session.get(Organization, 1)
    return (org.timezone if org and org.timezone else "Asia/Karachi")


def _avg_costs(session: Session) -> dict[uuid.UUID, float]:
    """Weighted average purchase price per stock unit, per ingredient."""
    spent: dict[uuid.UUID, float] = defaultdict(float)
    qty: dict[uuid.UUID, float] = defaultdict(float)
    for line in session.exec(select(PurchaseItem)).all():
        spent[line.inventory_item_id] += line.line_total
        qty[line.inventory_item_id] += line.quantity
    return {k: spent[k] / qty[k] for k in qty if qty[k] > 0}


def _paid(o: Order) -> float:
    """What the customer has actually paid so far."""
    collected = 0.0
    if o.status in (OrderStatus.DELIVERED, OrderStatus.COMPLETED):
        if o.fulfillment_type == FulfillmentType.DELIVERY and o.rider_amount_collected is not None:
            collected = o.rider_amount_collected
        else:
            collected = o.amount_received or 0
    return (o.advance_paid or 0) + collected


def _orders_in(session: Session, start: date, end: date, sales_only: bool = True) -> list[Order]:
    q = select(Order).where(Order.business_date >= start, Order.business_date <= end)
    if sales_only:
        q = q.where(Order.status.not_in(NOT_SALES))
    return list(session.exec(q.order_by(Order.business_date, Order.order_number)).all())


def _status(o: Order) -> str:
    return o.status.value if hasattr(o.status, "value") else str(o.status)


def _completed_on(o: Order, tz: str) -> date | None:
    """Local calendar day the order was completed (handed over / cash received)."""
    return _local_date(o.handover_at, tz) if o.status == OrderStatus.COMPLETED else None


def _orders_by_basis(session: Session, start: date, end: date, basis: str, sales_only: bool = True) -> tuple[list[Order], dict]:
    """Orders for a period, counted either by the day they were taken
    (business date) or the day they were completed. Returns the orders and
    the date each one is counted on."""
    if basis == "completed":
        tz = _tz(session)
        done = session.exec(select(Order).where(Order.status == OrderStatus.COMPLETED)).all()
        picked = [(o, _completed_on(o, tz)) for o in done]
        picked = sorted(((o, d) for o, d in picked if d and start <= d <= end), key=lambda od: (od[1], od[0].order_number))
        return [o for o, _ in picked], {o.id: d for o, d in picked}
    orders = _orders_in(session, start, end, sales_only=sales_only)
    return orders, {o.id: o.business_date for o in orders}


def _basis(value: str) -> str:
    if value not in ("taken", "completed"):
        raise HTTPException(status_code=400, detail="Count by must be 'taken' or 'completed'")
    return value


@router.get("/context")
def report_context(
    session: Session = Depends(get_session),
    _s: str = Depends(require_permission("reports.page.view")),
):
    """Dates the Reports page needs: the processing date, today's real date
    in the business's time zone (to warn when the processing date has fallen
    behind), and the first/last dates that have any data (for 'All time')."""
    from app.services.processing_date import get_processing_date
    tz = _tz(session)
    processing = get_processing_date(session)
    today = _local_date(datetime.now(timezone.utc), tz)
    dates = [d for d in (
        *(o.business_date for o in session.exec(select(Order)).all()),
        *(p.purchase_date for p in session.exec(select(Purchase)).all()),
    ) if d]
    done = [_completed_on(o, tz) for o in session.exec(select(Order).where(Order.status == OrderStatus.COMPLETED)).all()]
    dates += [d for d in done if d]
    return {
        "processing_date": processing.isoformat(),
        "today": today.isoformat() if today else None,
        "days_behind": (today - processing).days if today else 0,
        "first_date": min(dates).isoformat() if dates else processing.isoformat(),
        "last_date": max(dates + [processing]).isoformat() if dates else processing.isoformat(),
    }


# ---------------------------------------------------------------- dates available

def calendar_today(session: Session) -> date:
    """Today's date in the business's time zone - used only to warn when the
    processing date has fallen behind, never to date transactions."""
    from app.services.processing_date import system_today
    return system_today(session)


# ---------------------------------------------------------------- 1. orders

@router.get("/orders")
def orders_report(
    start: date = Query(...), end: date = Query(...), basis: str = Query("taken"),
    session: Session = Depends(get_session),
    _s: str = Depends(require_permission("reports.orders.view")),
):
    start, end = _period(start, end)
    all_orders, counted_on = _orders_by_basis(session, start, end, _basis(basis), sales_only=False)
    sales = [o for o in all_orders if o.status not in NOT_SALES]
    tz = _tz(session)
    customers = {c.id: c for c in session.exec(select(Customer)).all()}
    bucket = _series_bucket(start, end)
    series = {k: {"key": k, "orders": 0, "value": 0.0} for k in _bucket_keys(start, end, bucket)}
    for o in sales:
        pt = series.get(_bucket_key(counted_on[o.id], bucket))
        if pt:
            pt["orders"] += 1
            pt["value"] += o.total
    by_status: dict[str, int] = defaultdict(int)
    for o in all_orders:
        by_status[_status(o)] += 1
    value = sum(o.total for o in sales)
    paid = sum(min(_paid(o), o.total) for o in sales)
    return {
        "summary": {
            "orders": len(sales), "value": value, "average": value / len(sales) if sales else 0,
            "collected": paid, "outstanding": max(value - paid, 0),
            "delivery": sum(1 for o in sales if o.fulfillment_type == FulfillmentType.DELIVERY),
            "pickup": sum(1 for o in sales if o.fulfillment_type == FulfillmentType.PICKUP),
            "drafts": by_status.get("draft", 0), "cancelled": by_status.get("cancelled", 0),
        },
        "by_status": [{"status": k, "count": v} for k, v in sorted(by_status.items(), key=lambda kv: -kv[1])],
        "basis": basis, "bucket": bucket, "series": list(series.values()),
        "rows": [{
            "order_number": o.order_number, "date": o.business_date.isoformat() if o.business_date else "",
            "completed": (_completed_on(o, tz).isoformat() if _completed_on(o, tz) else ""), "due": o.delivery_date.isoformat(),
            "customer": customers[o.customer_id].full_name if o.customer_id in customers else "",
            "status": _status(o), "fulfillment": o.fulfillment_type.value if hasattr(o.fulfillment_type, "value") else o.fulfillment_type,
            "total": o.total, "paid": min(_paid(o), o.total), "balance": max(o.total - _paid(o), 0),
        } for o in all_orders],
    }


# ---------------------------------------------------------------- 2. ingredients used

@router.get("/ingredients-used")
def ingredients_used_report(
    start: date = Query(...), end: date = Query(...),
    session: Session = Depends(get_session),
    _s: str = Depends(require_permission("reports.inventory.view")),
):
    start, end = _period(start, end)
    costs = _avg_costs(session)
    items = {i.id: i for i in session.exec(select(InventoryItem)).all()}
    orders = {o.id: o for o in session.exec(select(Order)).all()}
    staff = {s.id: s.full_name for s in session.exec(select(Staff)).all()}
    usage = session.exec(
        select(OrderIngredientUsage)
        .where(OrderIngredientUsage.processing_date >= start, OrderIngredientUsage.processing_date <= end)
        .order_by(OrderIngredientUsage.processing_date)
    ).all()
    per_item: dict[uuid.UUID, dict] = {}
    rows = []
    for u in usage:
        item = items.get(u.inventory_item_id)
        cost = u.quantity_used * costs[u.inventory_item_id] if u.inventory_item_id in costs else None
        agg = per_item.setdefault(u.inventory_item_id, {
            "item": item.name if item else "Unknown", "unit": unit_label(session, item) if item else "",
            "quantity": 0.0, "cost": 0.0, "cost_known": u.inventory_item_id in costs, "orders": set(),
        })
        agg["quantity"] += u.quantity_used
        agg["cost"] += cost or 0
        agg["orders"].add(u.order_id)
        order = orders.get(u.order_id)
        rows.append({
            "date": u.processing_date.isoformat() if u.processing_date else "",
            "order_number": order.order_number if order else "", "item": agg["item"],
            "quantity": u.quantity_used, "unit": agg["unit"],
            "entered": f"{u.entered_quantity:g} {u.entered_unit}" if u.entered_quantity is not None and u.entered_unit and u.entered_unit != agg["unit"] else "",
            "cost": cost, "baker": staff.get(u.recorded_by_staff_id, ""),
        })
    summary_items = sorted(
        ({**v, "orders": len(v["orders"])} for v in per_item.values()), key=lambda r: -r["cost"])
    return {
        "summary": {
            "entries": len(rows), "ingredients": len(per_item),
            "orders": len({u.order_id for u in usage}),
            "cost": sum(v["cost"] for v in per_item.values()),
            "items_without_cost": sum(1 for v in per_item.values() if not v["cost_known"]),
        },
        "items": summary_items, "rows": rows,
    }


# ---------------------------------------------------------------- 3. purchases

@router.get("/purchases")
def purchases_report(
    start: date = Query(...), end: date = Query(...),
    session: Session = Depends(get_session),
    _s: str = Depends(require_permission("reports.inventory.view")),
):
    start, end = _period(start, end)
    purchases = session.exec(
        select(Purchase).where(Purchase.purchase_date >= start, Purchase.purchase_date <= end).order_by(Purchase.purchase_date)
    ).all()
    suppliers = {s.id: s.name for s in session.exec(select(Supplier)).all()}
    items = {i.id: i for i in session.exec(select(InventoryItem)).all()}
    ids = [p.id for p in purchases]
    lines = session.exec(select(PurchaseItem).where(PurchaseItem.purchase_id.in_(ids))).all() if ids else []
    per_item: dict[uuid.UUID, dict] = {}
    for ln in lines:
        item = items.get(ln.inventory_item_id)
        agg = per_item.setdefault(ln.inventory_item_id, {
            "item": item.name if item else "Unknown", "unit": unit_label(session, item) if item else "",
            "quantity": 0.0, "amount": 0.0, "purchases": set()})
        agg["quantity"] += ln.quantity
        agg["amount"] += ln.line_total
        agg["purchases"].add(ln.purchase_id)
    per_supplier: dict[str, dict] = {}
    for p in purchases:
        name = suppliers.get(p.supplier_id, "No supplier")
        agg = per_supplier.setdefault(name, {"supplier": name, "purchases": 0, "amount": 0.0})
        agg["purchases"] += 1
        agg["amount"] += p.total_amount
    line_count = defaultdict(int)
    for ln in lines:
        line_count[ln.purchase_id] += 1
    total = sum(p.total_amount for p in purchases)
    return {
        "summary": {"purchases": len(purchases), "amount": total,
                    "average": total / len(purchases) if purchases else 0,
                    "suppliers": len(per_supplier), "ingredients": len(per_item)},
        "items": sorted(({**v, "purchases": len(v["purchases"]),
                          "average_price": v["amount"] / v["quantity"] if v["quantity"] else 0}
                         for v in per_item.values()), key=lambda r: -r["amount"]),
        "suppliers": sorted(per_supplier.values(), key=lambda r: -r["amount"]),
        "rows": [{"date": p.purchase_date.isoformat(), "supplier": suppliers.get(p.supplier_id, "No supplier"),
                  "invoice": p.invoice_number or "", "lines": line_count[p.id], "amount": p.total_amount}
                 for p in purchases],
    }


# ---------------------------------------------------------------- 4. profit

@router.get("/profit")
def profit_report(
    start: date = Query(...), end: date = Query(...), basis: str = Query("taken"),
    session: Session = Depends(get_session),
    _s: str = Depends(require_permission("reports.profit.view")),
):
    start, end = _period(start, end)
    costs = _avg_costs(session)
    orders, counted_on = _orders_by_basis(session, start, end, _basis(basis))
    customers = {c.id: c.full_name for c in session.exec(select(Customer)).all()}
    ids = [o.id for o in orders]
    usage = session.exec(select(OrderIngredientUsage).where(OrderIngredientUsage.order_id.in_(ids))).all() if ids else []
    cost_by_order: dict[uuid.UUID, float] = defaultdict(float)
    logged: set[uuid.UUID] = set()
    unknown: set[uuid.UUID] = set()
    for u in usage:
        logged.add(u.order_id)
        if u.inventory_item_id in costs:
            cost_by_order[u.order_id] += u.quantity_used * costs[u.inventory_item_id]
        else:
            unknown.add(u.order_id)
    bucket = _series_bucket(start, end)
    series = {k: {"key": k, "sales": 0.0, "cost": 0.0, "profit": 0.0} for k in _bucket_keys(start, end, bucket)}
    rows = []
    for o in orders:
        cost = cost_by_order.get(o.id, 0.0)
        note = "" if o.id in logged and o.id not in unknown else (
            "Ingredients not logged yet" if o.id not in logged else "Some ingredients have no purchase price")
        rows.append({
            "order_number": o.order_number, "date": counted_on[o.id].isoformat(),
            "customer": customers.get(o.customer_id, ""), "status": _status(o),
            "sales": o.total, "delivery_charge": o.delivery_charge, "cost": cost, "profit": o.total - cost,
            "margin": ((o.total - cost) / o.total * 100) if o.total else 0, "cost_complete": not note, "note": note,
        })
        pt = series.get(_bucket_key(counted_on[o.id], bucket))
        if pt:
            pt["sales"] += o.total
            pt["cost"] += cost
            pt["profit"] += o.total - cost
    sales = sum(r["sales"] for r in rows)
    cost = sum(r["cost"] for r in rows)
    complete = [r for r in rows if r["cost_complete"]]
    c_sales, c_cost = sum(r["sales"] for r in complete), sum(r["cost"] for r in complete)
    return {
        "summary": {
            "orders": len(rows), "sales": sales, "ingredient_cost": cost, "gross_profit": sales - cost,
            "margin": ((sales - cost) / sales * 100) if sales else 0,
            "orders_with_full_cost": len(complete),
            "margin_full_cost_orders": ((c_sales - c_cost) / c_sales * 100) if c_sales else 0,
            "orders_missing_cost": len(rows) - len(complete),
        },
        "basis": basis, "bucket": bucket, "series": list(series.values()), "rows": rows,
    }


# ---------------------------------------------------------------- 5. best sellers

@router.get("/best-sellers")
def best_sellers_report(
    start: date = Query(...), end: date = Query(...),
    session: Session = Depends(get_session),
    _s: str = Depends(require_permission("reports.orders.view")),
):
    start, end = _period(start, end)
    orders = {o.id: o for o in _orders_in(session, start, end)}
    items = session.exec(select(OrderItem).where(OrderItem.order_id.in_(list(orders)))).all() if orders else []
    names = {}
    for model in (CakeFlavor, CakeSize, CakeTier, Theme, CakeAddon):
        names[model] = {r.id: r.name for r in session.exec(select(model)).all()}

    def tally(field: str, model) -> list[dict]:
        agg: dict[str, dict] = {}
        for it in items:
            key = getattr(it, field)
            if not key:
                continue
            name = names[model].get(key, "Unknown")
            a = agg.setdefault(name, {"name": name, "orders": 0, "revenue": 0.0})
            a["orders"] += 1
            a["revenue"] += orders[it.order_id].total
        return sorted(agg.values(), key=lambda r: (-r["orders"], -r["revenue"]))

    addon_rows = session.exec(select(OrderItemAddon).where(OrderItemAddon.order_item_id.in_([i.id for i in items]))).all() if items else []
    addons: dict[str, dict] = {}
    for a in addon_rows:
        name = names[CakeAddon].get(a.addon_id, "Unknown")
        agg = addons.setdefault(name, {"name": name, "orders": 0, "quantity": 0, "revenue": 0.0})
        agg["orders"] += 1
        agg["quantity"] += a.quantity
        agg["revenue"] += a.unit_price * a.quantity
    return {
        "orders": len(orders),
        "flavours": tally("cake_flavor_id", CakeFlavor), "sizes": tally("cake_size_id", CakeSize),
        "tiers": tally("cake_tier_id", CakeTier), "themes": tally("theme_id", Theme),
        "addons": sorted(addons.values(), key=lambda r: -r["revenue"]),
        "fulfillment": [
            {"name": "Home delivery", "orders": sum(1 for o in orders.values() if o.fulfillment_type == FulfillmentType.DELIVERY)},
            {"name": "Self pickup", "orders": sum(1 for o in orders.values() if o.fulfillment_type == FulfillmentType.PICKUP)},
        ],
    }


# ---------------------------------------------------------------- 6. money outstanding (right now)

@router.get("/outstanding")
def outstanding_report(
    session: Session = Depends(get_session),
    _s: str = Depends(require_permission("reports.orders.view")),
):
    open_orders = session.exec(select(Order).where(Order.status.not_in(NOT_SALES + (OrderStatus.COMPLETED,)))).all()
    customers = {c.id: c for c in session.exec(select(Customer)).all()}
    staff = {s.id: s.full_name for s in session.exec(select(Staff)).all()}
    due, with_riders = [], []
    for o in sorted(open_orders, key=lambda x: x.delivery_date):
        c = customers.get(o.customer_id)
        if o.status == OrderStatus.DELIVERED:
            with_riders.append({"order_number": o.order_number, "rider": staff.get(o.rider_staff_id, ""),
                                "customer": c.full_name if c else "", "collected": o.rider_amount_collected or 0,
                                "delivered": o.delivered_at.isoformat() if o.delivered_at else ""})
        balance = max(o.total - _paid(o), 0)
        if balance > 0 and o.status != OrderStatus.DELIVERED:
            due.append({"order_number": o.order_number, "customer": c.full_name if c else "", "phone": c.phone if c else "",
                        "due": o.delivery_date.isoformat(), "status": _status(o),
                        "total": o.total, "advance": o.advance_paid, "balance": balance})
    by_rider: dict[str, float] = defaultdict(float)
    for r in with_riders:
        by_rider[r["rider"]] += r["collected"]
    return {
        "summary": {"balance_due": sum(r["balance"] for r in due), "orders_with_balance": len(due),
                    "cash_with_riders": sum(r["collected"] for r in with_riders), "orders_with_riders": len(with_riders)},
        "due": due, "with_riders": with_riders,
        "by_rider": [{"rider": k, "amount": v} for k, v in sorted(by_rider.items(), key=lambda kv: -kv[1])],
    }


# ---------------------------------------------------------------- 7. stock value & wastage

@router.get("/stock")
def stock_report(
    start: date = Query(...), end: date = Query(...),
    session: Session = Depends(get_session),
    _s: str = Depends(require_permission("reports.inventory.view")),
):
    start, end = _period(start, end)
    costs = _avg_costs(session)
    items = session.exec(select(InventoryItem).where(InventoryItem.is_active == True).order_by(InventoryItem.name)).all()  # noqa: E712
    rows = []
    for i in items:
        avg = costs.get(i.id)
        rows.append({"item": i.name, "unit": unit_label(session, i), "on_hand": i.qty_on_hand,
                     "reorder_at": i.reorder_threshold, "low": i.qty_on_hand <= i.reorder_threshold,
                     "average_cost": avg, "value": (max(i.qty_on_hand, 0) * avg) if avg is not None else None})
    by_id = {i.id: i for i in session.exec(select(InventoryItem)).all()}
    moves = session.exec(
        select(StockMovement).where(StockMovement.processing_date >= start, StockMovement.processing_date <= end,
                                    StockMovement.reason.in_(("wastage", "adjustment")))
        .order_by(StockMovement.processing_date)
    ).all()
    wastage = [{"date": m.processing_date.isoformat(), "item": by_id[m.inventory_item_id].name if m.inventory_item_id in by_id else "",
                "unit": unit_label(session, by_id.get(m.inventory_item_id)) if m.inventory_item_id in by_id else "",
                "quantity": m.qty_delta, "reason": m.reason,
                "cost": (abs(m.qty_delta) * costs[m.inventory_item_id]) if m.inventory_item_id in costs and m.qty_delta < 0 else None}
               for m in moves]
    return {
        "summary": {"items": len(rows), "stock_value": sum(r["value"] or 0 for r in rows),
                    "low_stock": sum(1 for r in rows if r["low"]),
                    "items_without_cost": sum(1 for r in rows if r["average_cost"] is None),
                    "wastage_cost": sum(w["cost"] or 0 for w in wastage if w["reason"] == "wastage")},
        "items": rows, "wastage": wastage,
    }


# ---------------------------------------------------------------- 8. staff performance

@router.get("/staff")
def staff_report(
    start: date = Query(...), end: date = Query(...),
    session: Session = Depends(get_session),
    _s: str = Depends(require_permission("reports.staff.view")),
):
    start, end = _period(start, end)
    tz = _tz(session)
    staff = {s.id: s.full_name for s in session.exec(select(Staff)).all()}
    orders = session.exec(select(Order)).all()
    bakers: dict[str, dict] = {}
    riders: dict[str, dict] = {}
    for o in orders:
        ready_day = _local_date(o.ready_at, tz)
        if o.baker_staff_id and ready_day and start <= ready_day <= end:
            b = bakers.setdefault(staff.get(o.baker_staff_id, "Unknown"), {"name": staff.get(o.baker_staff_id, "Unknown"), "cakes": 0, "minutes": [], "declined": 0})
            b["cakes"] += 1
            if o.production_started_at and o.ready_at:
                b["minutes"].append((o.ready_at - o.production_started_at).total_seconds() / 60)
        declined_day = _local_date(o.declined_at, tz)
        if o.declined_by_staff_id and declined_day and start <= declined_day <= end:
            name = staff.get(o.declined_by_staff_id, "Unknown")
            bakers.setdefault(name, {"name": name, "cakes": 0, "minutes": [], "declined": 0})["declined"] += 1
        delivered_day = _local_date(o.delivered_at, tz)
        if o.rider_staff_id and delivered_day and start <= delivered_day <= end:
            r = riders.setdefault(staff.get(o.rider_staff_id, "Unknown"), {"name": staff.get(o.rider_staff_id, "Unknown"), "deliveries": 0, "collected": 0.0, "minutes": []})
            r["deliveries"] += 1
            r["collected"] += o.rider_amount_collected or 0
            if o.delivery_started_at and o.delivered_at:
                r["minutes"].append((o.delivered_at - o.delivery_started_at).total_seconds() / 60)
    avg = lambda xs: (sum(xs) / len(xs)) if xs else None  # noqa: E731
    return {
        "bakers": sorted(({"name": b["name"], "cakes": b["cakes"], "declined": b["declined"], "avg_bake_minutes": avg(b["minutes"])}
                          for b in bakers.values()), key=lambda r: -r["cakes"]),
        "riders": sorted(({"name": r["name"], "deliveries": r["deliveries"], "collected": r["collected"], "avg_trip_minutes": avg(r["minutes"])}
                          for r in riders.values()), key=lambda r: -r["deliveries"]),
    }


# ---------------------------------------------------------------- 9. customers

@router.get("/customers")
def customers_report(
    start: date = Query(...), end: date = Query(...),
    session: Session = Depends(get_session),
    _s: str = Depends(require_permission("reports.customers.view")),
):
    start, end = _period(start, end)
    tz = _tz(session)
    orders = _orders_in(session, start, end)
    customers = {c.id: c for c in session.exec(select(Customer)).all()}
    first_order: dict[uuid.UUID, date] = {}
    for o in session.exec(select(Order).where(Order.status.not_in(NOT_SALES))).all():
        if o.business_date and (o.customer_id not in first_order or o.business_date < first_order[o.customer_id]):
            first_order[o.customer_id] = o.business_date
    agg: dict[uuid.UUID, dict] = {}
    for o in orders:
        c = customers.get(o.customer_id)
        a = agg.setdefault(o.customer_id, {"customer": c.full_name if c else "", "phone": c.phone if c else "",
                                           "orders": 0, "spent": 0.0, "last_order": ""})
        a["orders"] += 1
        a["spent"] += o.total
        a["last_order"] = max(a["last_order"], o.business_date.isoformat())
    new_customers = [cid for cid, d in first_order.items() if start <= d <= end]
    rows = sorted(({**v, "new": cid in new_customers} for cid, v in agg.items()), key=lambda r: -r["spent"])
    return {
        "summary": {"customers": len(rows), "new_customers": len(new_customers),
                    "returning_customers": len(rows) - len([r for r in rows if r["new"]]),
                    "average_spend": (sum(r["spent"] for r in rows) / len(rows)) if rows else 0},
        "rows": rows,
    }
