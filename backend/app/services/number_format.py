"""Decimal places for money and quantities, set under System setup."""
from sqlmodel import Session

from app.models.system import SystemConfig

DEFAULT_AMOUNT_DECIMALS = 2
DEFAULT_QUANTITY_DECIMALS = 3
MAX_DECIMALS = 4


def get_decimals(session: Session) -> tuple[int, int]:
    """(amount_decimals, quantity_decimals)."""
    config = session.get(SystemConfig, 1)
    if not config:
        return DEFAULT_AMOUNT_DECIMALS, DEFAULT_QUANTITY_DECIMALS
    return config.amount_decimals, config.quantity_decimals


def round_amount(session: Session, value: float) -> float:
    """Round a money value to the configured decimal places."""
    return round(float(value), get_decimals(session)[0])
