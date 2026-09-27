"""Home dashboard: one call, shaped for whoever is signed in.

- "Your work" cards for bakers, riders and the order desk (from roles and
  the permissions those screens already use)
- Sales, profit and stock blocks only for people who can open the matching
  report - no new permissions to manage

"Today" is the later of the processing date and the calendar date, the same
rule the Reports page uses, so a processing date that hasn't been advanced
can't empty the dashboard. The response says how far behind it is.
"""
from __future__ import annotations

from collections import defaultdict
from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.core.database import get_session
from app.core.permissions import get_current_staff_id
from app.models.catalog import CakeFlavor
from app.models.inventory import InventoryItem, Purchase
from app.models.orders import FulfillmentType, Order, OrderIngredientUsage, OrderItem, OrderStatus
from app.models.staff import Role, Staff, StaffRole
from app.services.permission_service import get_effective_permissions
from app.services.processing_date import get_processing_date
from app.api.v1.endpoints.inventory import unit_label
from app.api.v1.endpoints.reports import NOT_SALES, _avg_costs, _local_date, _paid, _status, _tz, calendar_today

router = APIRouter()
OPEN = [s for s in OrderStatus if s not in (OrderStatus.DRAFT, OrderStatus.CANCELLED, OrderStatus.COMPLETED)]
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]


def _month_start(d: date, back: int = 0) -> date:
    y, m = d.year, d.month - back
    while m <= 0:
        y, m = y - 1, m + 12
    return date(y, m, 1)


@router.get("")
def dashboard(session: Session = Depends(get_session), staff_id: str = Depends(get_current_staff_id)):
    me = session.get(Staff, staff_id)
    perms = set(get_effective_permissions(session, me.id))
    roles = set(session.exec(select(Role.name).join(StaffRole, StaffRole.role_id == Role.id).where(StaffRole.staff_id == me.id)).all())
    oversight = bool(roles & {"Super Admin", "Administrator", "Manager"})
    tz = _tz(session)
    processing = get_processing_date(session)
    calendar = calendar_today(session)
    today = max(processing, calendar)
    orders = session.exec(select(Order)).all()

    out: dict = {
        "name": me.full_name, "processing_date": processing.isoformat(), "today": calendar.isoformat(),
        "days_behind": max((calendar - processing).days, 0), "work": [],
    }
    work = out["work"]

    # ---------------- your work
    if "Baker" in roles or ("orders.button.start_baking" in perms and not oversight):
        mine = [o for o in orders if o.baker_staff_id == me.id]
        work += [
            {"key": "baker_requests", "label": "New baking requests", "tone": "attention", "hint": "Waiting for you to accept",
             "count": sum(1 for o in mine if o.status == OrderStatus.SENT_TO_BAKER and not o.baker_accepted_at)},
            {"key": "baker_to_start", "label": "Accepted, not started", "tone": "attention", "hint": "Start baking when ready",
             "count": sum(1 for o in mine if o.status == OrderStatus.SENT_TO_BAKER and o.baker_accepted_at)},
            {"key": "baker_baking", "label": "Baking now", "tone": "normal", "hint": "Mark ready when done",
             "count": sum(1 for o in mine if o.status == OrderStatus.IN_PRODUCTION)},
            {"key": "baker_done", "label": "Finished today", "tone": "normal", "hint": "Cakes you marked ready",
             "count": sum(1 for o in mine if _local_date(o.ready_at, tz) == calendar)},
        ]
    if "Delivery Boy" in roles or ("orders.button.mark_delivered" in perms and not oversight):
        mine = [o for o in orders if o.rider_staff_id == me.id]
        holding = [o for o in mine if o.status == OrderStatus.DELIVERED]
        work += [
            {"key": "rider_assigned", "label": "Deliveries assigned", "tone": "attention", "hint": "Start delivery when you leave",
             "count": sum(1 for o in mine if o.status == OrderStatus.RIDER_ASSIGNED)},
            {"key": "rider_on_road", "label": "On the road", "tone": "normal", "hint": "Mark delivered at the door",
             "count": sum(1 for o in mine if o.status == OrderStatus.OUT_FOR_DELIVERY)},
            {"key": "rider_cash", "label": "Cash to hand in", "tone": "attention", "hint": "Give it to the manager",
             "count": len(holding), "amount": sum(o.rider_amount_collected or 0 for o in holding)},
            {"key": "rider_done", "label": "Delivered today", "tone": "normal", "hint": "Your deliveries today",
             "count": sum(1 for o in mine if _local_date(o.delivered_at, tz) == calendar)},
        ]
    if "orders.page.view" in perms and (oversight or not ({"Baker", "Delivery Boy"} & roles)):
        delivered = [o for o in orders if o.status == OrderStatus.DELIVERED]
        work += [
            {"key": "desk_drafts", "label": "Drafts to confirm", "tone": "attention", "hint": "Waiting on the customer",
             "count": sum(1 for o in orders if o.status == OrderStatus.DRAFT)},
            {"key": "desk_ready", "label": "Ready to hand over", "tone": "attention", "hint": "Assign a rider or complete pickup",
             "count": sum(1 for o in orders if o.status == OrderStatus.READY)},
            {"key": "desk_cash", "label": "Cash with riders", "tone": "attention", "hint": "Mark complete when received",
             "count": len(delivered), "amount": sum(o.rider_amount_collected or 0 for o in delivered)},
            {"key": "due_today", "label": "Due today", "tone": "normal", "hint": "Open orders due today",
             "count": sum(1 for o in orders if o.status in OPEN and o.delivery_date == today)},
        ]

    # ---------------- sales
    sales = [o for o in orders if o.status not in NOT_SALES and o.business_date]
    if "reports.orders.view" in perms:
        last30 = [o for o in sales if today - timedelta(days=29) <= o.business_date <= today]
        month = [o for o in sales if _month_start(today) <= o.business_date <= today]
        today_orders = [o for o in sales if o.business_date == today]
        per_day = defaultdict(lambda: {"value": 0.0, "orders": 0})
        for o in last30:
            per_day[o.business_date]["value"] += o.total
            per_day[o.business_date]["orders"] += 1
        open_orders = [o for o in orders if o.status in OPEN]
        by_status = defaultdict(int)
        for o in open_orders:
            by_status[_status(o)] += 1
        names = {f.id: f.name for f in session.exec(select(CakeFlavor)).all()}
        items = session.exec(select(OrderItem).where(OrderItem.order_id.in_([o.id for o in last30]))).all() if last30 else []
        totals = {o.id: o.total for o in last30}
        flav = defaultdict(lambda: {"orders": 0, "revenue": 0.0})
        for it in items:
            if it.cake_flavor_id:
                f = flav[names.get(it.cake_flavor_id, "Other")]
                f["orders"] += 1
                f["revenue"] += totals.get(it.order_id, 0)
        wk = [0] * 7
        for o in sales:
            if today - timedelta(days=89) <= o.business_date <= today:
                wk[o.business_date.weekday()] += 1
        completed_30 = sum(1 for o in orders if o.status == OrderStatus.COMPLETED
                           and (d := _local_date(o.handover_at, tz)) and today - timedelta(days=29) <= d <= today)
        out["sales"] = {
            "kpis": {
                "today_orders": len(today_orders), "today_value": sum(o.total for o in today_orders),
                "month_orders": len(month), "month_value": sum(o.total for o in month),
                "avg_order_30": (sum(o.total for o in last30) / len(last30)) if last30 else 0,
                "completed_30": completed_30,
                "balance_due": sum(max(o.total - _paid(o), 0) for o in open_orders if o.status != OrderStatus.DELIVERED),
                "cash_with_riders": sum(o.rider_amount_collected or 0 for o in open_orders if o.status == OrderStatus.DELIVERED),
            },
            "trend": [{"key": (today - timedelta(days=i)).isoformat(), **per_day[today - timedelta(days=i)]} for i in range(29, -1, -1)],
            "status_now": [{"status": k, "count": v} for k, v in sorted(by_status.items(), key=lambda kv: -kv[1])],
            "top_flavours": [{"name": k, **v} for k, v in sorted(flav.items(), key=lambda kv: (-kv[1]["orders"], -kv[1]["revenue"]))[:5]],
            "weekday": [{"day": WEEKDAYS[i], "orders": wk[i]} for i in range(7)],
            "fulfillment": [
                {"name": "Home delivery", "orders": sum(1 for o in last30 if o.fulfillment_type == FulfillmentType.DELIVERY)},
                {"name": "Self pickup", "orders": sum(1 for o in last30 if o.fulfillment_type == FulfillmentType.PICKUP)},
            ],
        }

    # ---------------- profit
    if "reports.profit.view" in perms:
        costs = _avg_costs(session)
        start6 = _month_start(today, 5)
        window = [o for o in sales if start6 <= o.business_date <= today]
        usage = session.exec(select(OrderIngredientUsage).where(OrderIngredientUsage.order_id.in_([o.id for o in window]))).all() if window else []
        cost = defaultdict(float)
        logged, unknown = set(), set()
        for u in usage:
            logged.add(u.order_id)
            if u.inventory_item_id in costs:
                cost[u.order_id] += u.quantity_used * costs[u.inventory_item_id]
            else:
                unknown.add(u.order_id)
        months = {}
        for i in range(5, -1, -1):
            k = _month_start(today, i).strftime("%Y-%m")
            months[k] = {"key": k, "sales": 0.0, "cost": 0.0, "profit": 0.0}
        for o in window:
            m = months[o.business_date.strftime("%Y-%m")]
            m["sales"] += o.total
            m["cost"] += cost.get(o.id, 0)
            m["profit"] += o.total - cost.get(o.id, 0)
        this = months[today.strftime("%Y-%m")]
        this_month = [o for o in window if o.business_date >= _month_start(today)]
        out["profit"] = {
            "months": list(months.values()), "month_profit": this["profit"],
            "month_margin": (this["profit"] / this["sales"] * 100) if this["sales"] else 0,
            "missing_cost": sum(1 for o in this_month if o.id not in logged or o.id in unknown),
        }

    # ---------------- stock
    if "inventory.page.view" in perms or "reports.inventory.view" in perms:
        costs = _avg_costs(session)
        items = session.exec(select(InventoryItem).where(InventoryItem.is_active == True).order_by(InventoryItem.name)).all()  # noqa: E712
        by_id = {i.id: i for i in session.exec(select(InventoryItem)).all()}
        since = today - timedelta(days=29)
        usage = session.exec(select(OrderIngredientUsage).where(OrderIngredientUsage.processing_date >= since,
                                                                OrderIngredientUsage.processing_date <= today)).all()
        used = defaultdict(lambda: {"quantity": 0.0, "cost": 0.0})
        for u in usage:
            used[u.inventory_item_id]["quantity"] += u.quantity_used
            used[u.inventory_item_id]["cost"] += u.quantity_used * costs.get(u.inventory_item_id, 0)
        low = [i for i in items if i.qty_on_hand <= i.reorder_threshold]
        out["inventory"] = {
            "stock_value": sum(max(i.qty_on_hand, 0) * costs.get(i.id, 0) for i in items),
            "used_30": sum(v["cost"] for v in used.values()),
            "bought_30": sum(p.total_amount for p in session.exec(select(Purchase).where(Purchase.purchase_date >= since, Purchase.purchase_date <= today)).all()),
            "top_used": [{"name": by_id[k].name, "unit": unit_label(session, by_id[k]), **v}
                         for k, v in sorted(used.items(), key=lambda kv: -kv[1]["cost"])[:5] if k in by_id],
            "low_stock": [{"item": i.name, "on_hand": i.qty_on_hand, "reorder_at": i.reorder_threshold, "unit": unit_label(session, i)} for i in low[:8]],
            "low_count": len(low),
        }
    return out
