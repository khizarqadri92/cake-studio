from sqlmodel import Session, select
from app.models.orders import OrderSequence


def generate_order_number(session: Session) -> str:
    """Simple ORD-0001 style sequence, using a dedicated counter row so
    numbers stay stable and gapless even if an order is later deleted."""
    seq = session.exec(select(OrderSequence).where(OrderSequence.id == 1)).first()
    if not seq:
        seq = OrderSequence(id=1, next_number=1)
        session.add(seq)
        session.commit()
        session.refresh(seq)

    number = seq.next_number
    seq.next_number += 1
    session.add(seq)
    session.commit()
    return f"ORD-{str(number).zfill(4)}"
