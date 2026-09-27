"""Customer receipts (PDF) and kitchen tickets (ESC/POS or browser print).

Both are built from one ReceiptData so the customer copy and the kitchen
copy can never disagree about what was ordered.
"""
from __future__ import annotations

import io
import os
import socket
from dataclasses import dataclass, field
from datetime import date, datetime, time

from sqlmodel import Session

from app.models.organization import Organization
from app.models.system import SystemConfig
from app.services.number_format import get_decimals

STATIC_ROOT = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "static")


# ---------------------------------------------------------------- formatting

def _separators(sample: str) -> tuple[str, str]:
    return {"1.234,56": (".", ","), "1 234.56": (" ", ".")}.get(sample, (",", "."))


def format_number(value: float | None, decimals: int, sample: str) -> str:
    if value is None:
        return "-"
    group, dec = _separators(sample)
    fixed = f"{abs(float(value)):.{decimals}f}"
    whole, _, frac = fixed.partition(".")
    grouped = f"{int(whole):,}".replace(",", group)
    sign = "-" if float(value) < 0 and float(fixed) != 0 else ""
    return sign + grouped + (dec + frac if frac else "")


def format_date(d: date | None, pattern: str) -> str:
    """Organization date formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD, D MMM YYYY, MMM D, YYYY ..."""
    if not d:
        return "-"
    months = ["January", "February", "March", "April", "May", "June", "July",
              "August", "September", "October", "November", "December"]
    tokens = [("YYYY", f"{d.year:04d}"), ("MMMM", months[d.month - 1]), ("MMM", months[d.month - 1][:3]),
              ("YY", f"{d.year % 100:02d}"), ("MM", f"{d.month:02d}"), ("DD", f"{d.day:02d}"),
              ("M", str(d.month)), ("D", str(d.day))]
    out, i = "", 0
    while i < len(pattern):
        for tok, val in tokens:
            if pattern.startswith(tok, i):
                out += val
                i += len(tok)
                break
        else:
            out += pattern[i]
            i += 1
    return out


def format_time(t: time | str | None, pattern: str) -> str:
    if not t:
        return ""
    if isinstance(t, str):
        try:
            t = time.fromisoformat(t)
        except ValueError:
            return t
    if pattern.startswith("HH"):
        return t.strftime("%H:%M:%S" if "ss" in pattern else "%H:%M")
    hour = t.hour % 12 or 12
    suffix = "AM" if t.hour < 12 else "PM"
    return f"{hour:02d}:{t.minute:02d}{f':{t.second:02d}' if 'ss' in pattern else ''} {suffix}"


def currency_label(code: str | None) -> str:
    return {"PKR": "Rs", "INR": "Rs", "USD": "$", "GBP": "£", "EUR": "€", "AED": "AED", "SAR": "SAR"}.get(code or "", code or "")


# ---------------------------------------------------------------- data

@dataclass
class ReceiptLine:
    label: str
    detail: str = ""
    qty: str = ""
    amount: str = ""


@dataclass
class ReceiptData:
    company: str
    address: str
    phones: str
    email: str
    tax_number: str
    logo_path: str | None
    currency: str

    order_number: str
    status: str               # order status value
    is_draft: bool
    issued: str
    due: str
    fulfillment: str          # "Home delivery" / "Self pickup"
    delivery_address: str

    customer_name: str
    customer_phone: str

    cake_lines: list[tuple[str, str]] = field(default_factory=list)  # (attribute, value)
    lines: list[ReceiptLine] = field(default_factory=list)
    message_on_cake: str = ""
    special_instructions: str = ""
    customer_design: bool = False

    subtotal: str = ""
    delivery_charge: str = ""
    discount: str = ""
    total: str = ""
    advance_paid: str = ""
    balance_due: str = ""
    has_discount: bool = False
    has_delivery: bool = False
    advance_paid_zero: bool = False

    # What stage this receipt is for - drives title, status line and payment block
    kind: str = "order"        # "order" | "delivery" | "payment"
    title: str = "Order receipt"
    status_text: str = ""
    status_tone: str = "pending"   # "pending" | "ok" | "due"
    payment_label: str = ""        # e.g. "Paid on delivery"
    payment_amount: str = ""
    balance_label: str = "Balance due"
    paid_date: str = ""
    note: str = ""
    reference_image_path: str | None = None


def build_receipt(session: Session, order) -> ReceiptData:
    """`order` is the OrderOut produced by the orders API (has resolved names)."""
    org = session.get(Organization, 1) or Organization()
    amount_dp, qty_dp = get_decimals(session)
    sample = org.number_format or "1,234.56"
    money = lambda v: format_number(v, amount_dp, sample)  # noqa: E731

    address = ", ".join(p for p in [org.address_line1, org.address_line2, org.city, org.state, org.country] if p)
    phones = " / ".join(p for p in [org.phone_primary, org.phone_secondary] if p)
    logo_path = None
    if org.logo_url and org.logo_url.startswith("/static/"):
        candidate = os.path.join(STATIC_ROOT, org.logo_url[len("/static/"):])
        if os.path.isfile(candidate) and candidate.lower().endswith((".png", ".jpg", ".jpeg")):
            logo_path = candidate

    item = order.item
    cake_lines: list[tuple[str, str]] = []
    lines: list[ReceiptLine] = []
    if item:
        for label, value in (
            ("Flavour", item.cake_flavor_name), ("Filling", item.cake_filling_name),
            ("Frosting", item.cake_frosting_name), ("Shape", item.cake_shape_name),
            ("Size", item.cake_size_name), ("Tier", item.cake_tier_name),
            ("Colour", item.cake_color_name), ("Theme", item.theme_name), ("Box", item.cake_box_name),
        ):
            if value:
                cake_lines.append((label, value))
        cake_summary = ", ".join(v for k, v in cake_lines if k in ("Tier", "Flavour", "Size")) or "Custom cake"
        cake_price = item.unit_price * item.quantity
        lines.append(ReceiptLine("Cake", cake_summary, str(item.quantity), money(cake_price)))
        for a in item.addons:
            lines.append(ReceiptLine(a.name or "Add-on", "", str(a.quantity), money(a.unit_price * a.quantity)))

    status = str(getattr(order.status, "value", order.status))
    is_delivery = str(getattr(order.fulfillment_type, "value", order.fulfillment_type)) == "delivery"
    balance = max(order.total - order.advance_paid, 0)
    date_fmt = org.date_format or "DD/MM/YYYY"
    if status in ("delivered", "completed"):
        paid_now = (order.rider_amount_collected if is_delivery and order.rider_amount_collected is not None else order.amount_received) or 0
        remaining = max(order.total - order.advance_paid - paid_now, 0)
        paid_at = (order.delivered_at if is_delivery else order.handover_at) or order.handover_at
        stage = dict(
            kind="payment", title="Payment receipt",
            status_text="Paid in full" if remaining <= 0 else f"Part paid - balance {currency_label(org.default_currency)} {money(remaining)}",
            status_tone="ok" if remaining <= 0 else "due",
            payment_label="Paid on delivery" if is_delivery else "Paid on collection",
            payment_amount=money(paid_now), balance_label="Balance remaining", balance_value=money(remaining),
            paid_date=format_date(paid_at.date() if paid_at else None, date_fmt),
            note="Thank you! This receipt confirms your payment.",
        )
    elif status in ("rider_assigned", "out_for_delivery"):
        stage = dict(
            kind="delivery", title="Delivery receipt",
            status_text=f"Amount to pay on delivery: {currency_label(org.default_currency)} {money(balance)}" if balance > 0 else "Fully paid - nothing to pay on delivery",
            status_tone="due" if balance > 0 else "ok",
            balance_label="To pay on delivery", balance_value=money(balance),
            note="Please pay the rider the amount above when you receive your cake." if balance > 0 else "Enjoy your cake!",
        )
    elif status == "draft":
        stage = dict(kind="order", title="Order receipt", status_text="Awaiting your confirmation", status_tone="pending",
                     balance_value=money(balance),
                     note="Please check these details. Reply to confirm your order and we'll start preparing it.")
    else:
        stage = dict(kind="order", title="Order receipt", status_text="Confirmed", status_tone="ok",
                     balance_value=money(balance),
                     note="Thank you for your order. We'll have it ready on the due date.")
    balance_value = stage.pop("balance_value")

    ref_path = None
    if item and item.is_customer_design and item.reference_image_url and item.reference_image_url.startswith("/static/"):
        candidate = os.path.join(STATIC_ROOT, item.reference_image_url[len("/static/"):])
        if os.path.isfile(candidate) and candidate.lower().endswith((".png", ".jpg", ".jpeg")):
            ref_path = candidate

    time_text = format_time(order.delivery_time, org.time_format or "hh:mm A")
    due = format_date(order.delivery_date, org.date_format or "DD/MM/YYYY") + (f", {time_text}" if time_text else "")

    return ReceiptData(
        company=org.company_name or "Cake Studio", address=address, phones=phones,
        email=org.email_primary or "", tax_number=org.tax_number or "", logo_path=logo_path,
        currency=currency_label(org.default_currency),
        order_number=order.order_number, status=str(order.status.value if hasattr(order.status, "value") else order.status),
        is_draft=str(getattr(order.status, "value", order.status)) == "draft",
        issued=format_date(getattr(order, "business_date", None) or (order.created_at.date() if order.created_at else None), org.date_format or "DD/MM/YYYY"),
        due=due,
        fulfillment="Home delivery" if str(getattr(order.fulfillment_type, "value", order.fulfillment_type)) == "delivery" else "Self pickup",
        delivery_address=order.delivery_address or "",
        customer_name=order.customer_name, customer_phone=order.customer_phone,
        cake_lines=cake_lines, lines=lines,
        message_on_cake=(item.custom_message or "") if item else "",
        special_instructions=(item.special_instructions or "") if item else "",
        customer_design=bool(item and item.is_customer_design),
        subtotal=money(order.subtotal), delivery_charge=money(order.delivery_charge),
        discount=money(order.discount), total=money(order.total), advance_paid=money(order.advance_paid),
        balance_due=balance_value,
        has_discount=bool(order.discount), has_delivery=bool(order.delivery_charge),
        advance_paid_zero=not order.advance_paid,
        reference_image_path=ref_path,
        **stage,
    )


# ---------------------------------------------------------------- PDF (customer copy)

PLUM = (110 / 255, 36 / 255, 55 / 255)
INK = (42 / 255, 31 / 255, 29 / 255)
MUTED = (107 / 255, 94 / 255, 88 / 255)
HAIRLINE = (231 / 255, 223 / 255, 213 / 255)
HONEY_BG = (251 / 255, 243 / 255, 228 / 255)


def render_pdf(r: ReceiptData) -> bytes:
    from reportlab.lib.colors import Color
    from reportlab.lib.enums import TA_RIGHT
    from reportlab.lib.pagesizes import A5
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Image, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
    from xml.sax.saxutils import escape as esc

    plum, ink, muted, hair, honey = (Color(*c) for c in (PLUM, INK, MUTED, HAIRLINE, HONEY_BG))
    base = ParagraphStyle("base", fontName="Helvetica", fontSize=9, leading=12, textColor=ink)
    small = ParagraphStyle("small", parent=base, fontSize=8, leading=10.5, textColor=muted)
    right = ParagraphStyle("right", parent=base, alignment=TA_RIGHT)
    right_small = ParagraphStyle("rs", parent=small, alignment=TA_RIGHT)
    title = ParagraphStyle("title", parent=base, fontName="Times-Bold", fontSize=20, leading=24, textColor=ink)
    company = ParagraphStyle("company", parent=base, fontName="Times-Bold", fontSize=15, leading=18, textColor=plum)
    label = ParagraphStyle("label", parent=small, fontName="Helvetica-Bold", textColor=muted)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A5, leftMargin=12 * mm, rightMargin=12 * mm,
                            topMargin=11 * mm, bottomMargin=11 * mm,
                            title=f"Order receipt {r.order_number}", author=r.company)
    width = doc.width - 12  # SimpleDocTemplate's frame keeps 6 pt padding on each side
    story = []

    # Header: logo or company name, contact details on the right
    brand = []
    if r.logo_path:
        try:
            img = Image(r.logo_path)
            ratio = img.imageWidth / float(img.imageHeight or 1)
            img.drawHeight = 16 * mm
            img.drawWidth = min(16 * mm * ratio, width * 0.45)
            img.hAlign = "LEFT"
            brand.append(img)
        except Exception:
            brand.append(Paragraph(esc(r.company), company))
    else:
        brand.append(Paragraph(esc(r.company), company))
    contact = "<br/>".join(esc(x) for x in [r.address, r.phones, r.email, f"Tax no. {r.tax_number}" if r.tax_number else ""] if x)
    header = Table([[brand, Paragraph(contact, right_small)]], colWidths=[width * 0.5, width * 0.5])
    header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
                                ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))
    story += [header, Spacer(1, 7 * mm)]

    # Title + status
    status_color = {"pending": "#8A5A12", "ok": "#2F6B35", "due": "#9A3B16"}[r.status_tone]
    heading = esc(r.title)
    if r.kind == "payment" and r.status_tone == "ok":
        heading += '&nbsp;&nbsp;<font size="11" color="#2F6B35">&#160;PAID&#160;</font>'
    story.append(Paragraph(heading, title))
    story.append(Paragraph(f'<font color="{status_color}"><b>{esc(r.status_text)}</b></font>'
                           + (f'<font color="#6B5E58">&nbsp;&nbsp;on {esc(r.paid_date)}</font>' if r.paid_date else ""), base))
    story.append(Spacer(1, 5 * mm))

    # Order facts in two columns
    def fact(k, v):
        return [Paragraph(esc(k), label), Paragraph(esc(v) or "-", base)]
    facts_left = [fact("Order", r.order_number), fact("Issued", r.issued), fact("Due", r.due)]
    facts_right = [fact("Customer", r.customer_name), fact("Phone", r.customer_phone), fact("Fulfilment", r.fulfillment)]
    rows = [a + b for a, b in zip(facts_left, facts_right)]
    if r.fulfillment == "Home delivery" and r.delivery_address:
        rows.append(fact("Deliver to", r.delivery_address) + ["", ""])
    facts = Table(rows, colWidths=[width * 0.14, width * 0.36, width * 0.16, width * 0.34])
    style = [("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0),
             ("BOTTOMPADDING", (0, 0), (-1, -1), 4), ("TOPPADDING", (0, 0), (-1, -1), 0)]
    if r.fulfillment == "Home delivery" and r.delivery_address:
        style.append(("SPAN", (1, len(rows) - 1), (3, len(rows) - 1)))
    facts.setStyle(TableStyle(style))
    story += [facts, Spacer(1, 4 * mm)]

    # Cake details
    if r.cake_lines:
        detail = " · ".join(f"{k}: {v}" for k, v in r.cake_lines)
        story.append(Paragraph(esc(detail), small))
    extras = []
    if r.message_on_cake:
        extras.append(f"<b>Message on cake:</b> {esc(r.message_on_cake)}")
    if r.special_instructions:
        extras.append(f"<b>Instructions:</b> {esc(r.special_instructions)}")
    if r.customer_design:
        extras.append("<b>Design:</b> customer's own design (reference image on file)")
    for e in extras:
        story.append(Paragraph(e, small))
    story.append(Spacer(1, 4 * mm))

    # Line items
    data = [[Paragraph("<b>Item</b>", small), Paragraph("<b>Qty</b>", right_small), Paragraph(f"<b>Amount ({esc(r.currency)})</b>", right_small)]]
    for ln in r.lines:
        text = f"<b>{esc(ln.label)}</b>" + (f"<br/><font color='#6B5E58'>{esc(ln.detail)}</font>" if ln.detail else "")
        data.append([Paragraph(text, base), Paragraph(esc(ln.qty), right), Paragraph(esc(ln.amount), right)])
    items = Table(data, colWidths=[width * 0.62, width * 0.12, width * 0.26])
    items.setStyle(TableStyle([
        ("LINEBELOW", (0, 0), (-1, 0), 0.6, hair), ("LINEBELOW", (0, 1), (-1, -1), 0.4, hair),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]))
    story += [items, Spacer(1, 3 * mm)]

    # Totals
    tot = [["Subtotal", r.subtotal]]
    if r.has_delivery:
        tot.append(["Delivery", r.delivery_charge])
    if r.has_discount:
        tot.append(["Discount", f"-{r.discount}"])
    tot.append(["Total", f"{r.currency} {r.total}"])
    tot.append(["Advance paid", r.advance_paid if r.advance_paid_zero else f"-{r.advance_paid}"])
    if r.kind == "payment":
        tot.append([r.payment_label, f"-{r.payment_amount}"])
    tot_rows = [[Paragraph(esc(k), base if k != "Total" else ParagraphStyle("tb", parent=base, fontName="Helvetica-Bold")),
                 Paragraph(esc(v), right if k != "Total" else ParagraphStyle("tbr", parent=right, fontName="Helvetica-Bold"))] for k, v in tot]
    totals = Table(tot_rows, colWidths=[width * 0.3, width * 0.26], hAlign="RIGHT")
    total_idx = [k for k, _ in tot].index("Total")
    totals.setStyle(TableStyle([
        ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (-1, -1), 2), ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LINEABOVE", (0, total_idx), (-1, total_idx), 0.6, hair),
    ]))
    story.append(totals)
    story.append(Spacer(1, 3 * mm))

    balance = Table([[Paragraph(f"<b>{esc(r.balance_label)}</b>", ParagraphStyle("bd", parent=base, textColor=Color(90/255, 62/255, 14/255))),
                      Paragraph(f"<b>{esc(r.currency)} {esc(r.balance_due)}</b>", ParagraphStyle("bdr", parent=right, fontSize=11, textColor=Color(90/255, 62/255, 14/255)))]],
                    colWidths=[width * 0.3, width * 0.26], hAlign="RIGHT")
    balance.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, -1), honey), ("LEFTPADDING", (0, 0), (-1, -1), 8),
                                 ("RIGHTPADDING", (0, 0), (-1, -1), 8), ("TOPPADDING", (0, 0), (-1, -1), 6),
                                 ("BOTTOMPADDING", (0, 0), (-1, -1), 6), ("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
    story += [balance, Spacer(1, 8 * mm)]

    story.append(Paragraph(esc(r.note), small))

    doc.build(story)
    return buf.getvalue()


# ---------------------------------------------------------------- kitchen ticket

def ticket_lines(r: ReceiptData, width: int) -> list[tuple[str, str]]:
    """(style, text) lines for the kitchen. Styles: 'title', 'big', 'bold', 'text', 'rule', 'center'."""
    def wrap(text: str, indent: str = "") -> list[str]:
        out, line = [], ""
        for word in text.split():
            if len(line) + len(word) + (1 if line else 0) > width - len(indent):
                out.append(indent + line)
                line = word
            else:
                line = f"{line} {word}" if line else word
        if line:
            out.append(indent + line)
        return out or [indent]

    def pair(k: str, v: str) -> list[tuple[str, str]]:
        head = f"{k}: "
        lines = wrap(v, " " * len(head))
        lines[0] = head + lines[0].lstrip()
        return [("text", ln) for ln in lines]

    rule = "-" * width
    out: list[tuple[str, str]] = [
        ("center", r.company), ("title", "KITCHEN TICKET"), ("rule", rule),
        ("big", r.order_number), ("bold", f"Due: {r.due}"), ("text", r.fulfillment),
        ("rule", rule),
    ]
    out += pair("Customer", f"{r.customer_name} ({r.customer_phone})")
    out.append(("rule", rule))
    for k, v in r.cake_lines:
        out += pair(k, v)
    qty = next((ln.qty for ln in r.lines if ln.label == "Cake"), "1")
    out.append(("bold", f"Quantity: {qty}"))
    addons = [ln for ln in r.lines if ln.label != "Cake"]
    if addons:
        out.append(("rule", rule))
        out.append(("bold", "Add-ons"))
        for a in addons:
            out += [("text", ln) for ln in wrap(f"{a.qty} x {a.label}", "  ")]
    if r.message_on_cake:
        out += [("rule", rule), ("bold", "Message on cake")]
        out += [("text", ln) for ln in wrap(f'"{r.message_on_cake}"', "  ")]
    if r.special_instructions:
        out += [("rule", rule), ("bold", "Instructions")]
        out += [("text", ln) for ln in wrap(r.special_instructions, "  ")]
    if r.customer_design:
        out += [("rule", rule), ("bold", "Customer's own design - see order photo")]
    out += [("rule", rule), ("center", f"Printed {datetime.now().strftime('%d/%m %H:%M')}")]
    return out


def escpos_bytes(r: ReceiptData, width: int) -> bytes:
    ESC, GS = b"\x1b", b"\x1d"
    init, left, center = ESC + b"@", ESC + b"a\x00", ESC + b"a\x01"
    bold_on, bold_off = ESC + b"E\x01", ESC + b"E\x00"
    big_on, big_off = GS + b"!\x11", GS + b"!\x00"
    tall_on = GS + b"!\x01"
    cut = b"\n\n\n" + GS + b"V\x42\x00"

    def enc(text: str) -> bytes:
        return text.encode("cp437", errors="replace")

    out = bytearray(init)
    for style, text in ticket_lines(r, width):
        if style == "title":
            out += center + bold_on + tall_on + enc(text) + big_off + bold_off + b"\n" + left
        elif style == "big":
            out += center + big_on + enc(text) + big_off + b"\n" + left
        elif style == "center":
            out += center + enc(text) + b"\n" + left
        elif style == "bold":
            out += bold_on + enc(text) + bold_off + b"\n"
        else:
            out += enc(text) + b"\n"
    out += cut
    return bytes(out)


def send_to_network_printer(host: str, port: int, payload: bytes, timeout: float = 5.0) -> None:
    """Raw TCP to the printer (the standard 'port 9100' protocol). Raises OSError on failure."""
    with socket.create_connection((host, port), timeout=timeout) as sock:
        sock.sendall(payload)


def printer_settings(session: Session) -> SystemConfig:
    return session.get(SystemConfig, 1) or SystemConfig()


def render_ticket_pdf(r: ReceiptData, width_chars: int) -> bytes:
    """Kitchen ticket as a PDF on receipt-width paper, with the customer's
    design photo underneath when there is one."""
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas
    from reportlab.lib.utils import ImageReader

    paper_mm = 58 if width_chars <= 32 else 76 if width_chars <= 42 else 80
    margin = 4 * mm
    usable = paper_mm * mm - 2 * margin
    lines = ticket_lines(r, width_chars)
    size = usable / (width_chars * 0.6)   # Courier glyphs are 0.6 em wide
    lead = size * 1.35
    heights = {"title": lead * 1.5, "big": lead * 2.0}
    text_h = sum(heights.get(st, lead) for st, _ in lines)

    img, img_h = None, 0.0
    if r.reference_image_path:
        try:
            img = ImageReader(r.reference_image_path)
            iw, ih = img.getSize()
            img_h = usable * ih / float(iw or 1) + lead * 2
        except Exception:
            img = None

    page_h = text_h + img_h + 2 * margin
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=(paper_mm * mm, page_h))
    c.setTitle(f"Kitchen ticket {r.order_number}")
    y = page_h - margin
    center_x = paper_mm * mm / 2
    for style, text in lines:
        h = heights.get(style, lead)
        y -= h
        if style == "rule":
            c.setDash(2, 2); c.setLineWidth(0.6)
            c.line(margin, y + h * 0.45, margin + usable, y + h * 0.45)
            c.setDash()
            continue
        if style == "big":
            c.setFont("Courier-Bold", size * 2)
            c.drawCentredString(center_x, y + h * 0.25, text)
        elif style == "title":
            c.setFont("Courier-Bold", size * 1.35)
            c.drawCentredString(center_x, y + h * 0.25, text)
        elif style == "center":
            c.setFont("Courier", size)
            c.drawCentredString(center_x, y + h * 0.25, text)
        else:
            c.setFont("Courier-Bold" if style == "bold" else "Courier", size)
            c.drawString(margin, y + h * 0.25, text)
    if img:
        y -= lead
        c.setFont("Courier-Bold", size)
        c.drawString(margin, y, "Customer's design:")
        draw_h = img_h - lead * 2
        y -= lead * 0.6 + draw_h
        c.drawImage(img, margin, y, width=usable, height=draw_h, preserveAspectRatio=True, mask="auto")
    c.showPage()
    c.save()
    return buf.getvalue()
