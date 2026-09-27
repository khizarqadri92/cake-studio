"""Knowledge of common measurement units, so conversions (kg <-> g, l <-> ml,
dozen <-> pcs) work without anyone having to configure them by hand."""

# measure -> {aliases: size relative to the smallest unit of that measure}
KNOWN_UNITS: dict[str, dict[tuple[str, ...], float]] = {
    "weight": {
        ("mg", "milligram", "milligrams"): 0.001,
        ("g", "gm", "gms", "gr", "gram", "grams", "gramme", "grammes"): 1,
        ("kg", "kgs", "kilogram", "kilograms", "kilo", "kilos"): 1000,
        ("lb", "lbs", "pound", "pounds"): 453.592,
        ("oz", "ounce", "ounces"): 28.3495,
    },
    "volume": {
        ("ml", "mls", "millilitre", "milliliter", "millilitres", "milliliters"): 1,
        ("l", "lt", "ltr", "ltrs", "litre", "liter", "litres", "liters"): 1000,
        ("tsp", "teaspoon", "teaspoons"): 5,
        ("tbsp", "tablespoon", "tablespoons"): 15,
        ("cup", "cups"): 240,
    },
    "count": {
        ("pcs", "pc", "piece", "pieces", "nos", "no", "unit", "units", "each", "ea"): 1,
        ("dozen", "dz", "doz"): 12,
        ("tray", "trays", "crate", "crates"): 30,
    },
}

# The companion units the seed makes sure exist for each measure you use.
STANDARD_UNITS: dict[str, list[tuple[str, str, float]]] = {
    "weight": [("Gram", "g", 1), ("Kilogram", "kg", 1000)],
    "volume": [("Millilitre", "ml", 1), ("Litre", "l", 1000)],
    "count": [("Pieces", "pcs", 1), ("Dozen", "dozen", 12)],
}


def _normalise(text: str | None) -> str:
    return (text or "").strip().lower().rstrip(".")


def guess_unit(name: str | None, abbreviation: str | None) -> tuple[str, float] | None:
    """(measure, factor) for a recognisable unit, else None."""
    keys = {_normalise(abbreviation), _normalise(name)} - {""}
    for measure, table in KNOWN_UNITS.items():
        for aliases, factor in table.items():
            if keys & set(aliases):
                return measure, float(factor)
    return None


def ensure_standard_units(session) -> tuple[int, list[str]]:
    """Keep unit conversions working without manual setup.

    1) Recognisable units with no measure (kg, Ltr, dozen...) get their
       measure and size filled in.
    2) For every measure in use, its standard partner units exist - so kg
       always has g, litre always has ml, dozen always has pieces. A unit you
       already have at that size (under any name) is never duplicated, and a
       partner you've deactivated stays deactivated.

    Returns (units whose type was filled in, abbreviations added)."""
    from sqlmodel import select
    from app.models.inventory import UnitOfMeasure

    units = list(session.exec(select(UnitOfMeasure)).all())
    filled = 0
    for u in units:
        if not u.measure:
            guessed = guess_unit(u.name, u.abbreviation)
            if guessed:
                u.measure, u.factor = guessed
                session.add(u)
                filled += 1

    added: list[str] = []
    for measure in sorted({u.measure for u in units if u.measure}):
        for name, abbr, factor in STANDARD_UNITS.get(measure, []):
            same_size = any(u.measure == measure and abs(u.factor - factor) < 1e-9 for u in units)
            name_taken = any(u.name.strip().lower() == name.lower() for u in units)
            if not same_size and not name_taken:
                unit = UnitOfMeasure(name=name, abbreviation=abbr, measure=measure, factor=factor)
                session.add(unit)
                units.append(unit)
                added.append(abbr)

    if filled or added:
        session.commit()
    return filled, added
