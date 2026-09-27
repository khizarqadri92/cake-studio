"""unit conversion: measure + factor on units, entered unit on ingredient usage

Revision ID: 0023
Revises: 0022
Create Date: 2026-09-24

"""
from alembic import op
import sqlalchemy as sa

revision = "0023"
down_revision = "0022"
branch_labels = None
depends_on = None

# Recognised abbreviations/names -> (measure, size relative to g / ml / piece)
KNOWN_UNITS = {
    "weight": {("mg", "milligram", "milligrams"): 0.001, ("g", "gm", "gms", "gram", "grams"): 1,
               ("kg", "kgs", "kilogram", "kilograms", "kilo"): 1000, ("lb", "lbs", "pound", "pounds"): 453.592,
               ("oz", "ounce", "ounces"): 28.3495},
    "volume": {("ml", "millilitre", "milliliter", "millilitres", "milliliters"): 1,
               ("l", "ltr", "ltrs", "litre", "liter", "litres", "liters"): 1000,
               ("tsp", "teaspoon"): 5, ("tbsp", "tablespoon"): 15, ("cup", "cups"): 240},
    "count": {("pcs", "pc", "piece", "pieces", "nos", "no", "unit", "units", "each", "ea"): 1,
              ("dozen", "dz", "doz"): 12, ("tray", "crate"): 30},
}


def upgrade() -> None:
    with op.batch_alter_table("unitofmeasure") as batch_op:
        batch_op.add_column(sa.Column("measure", sa.String, nullable=True))
        batch_op.add_column(sa.Column("factor", sa.Float, nullable=False, server_default="1"))
    with op.batch_alter_table("orderingredientusage") as batch_op:
        batch_op.add_column(sa.Column("entered_quantity", sa.Float, nullable=True))
        batch_op.add_column(sa.Column("entered_unit", sa.String, nullable=True))

    # Fill in units you've already created, matched by abbreviation or name.
    # Anything unrecognised is left without a measure and can be set on the
    # Units page; until then it simply converts only to itself.
    bind = op.get_bind()
    for unit_id, name, abbr in bind.execute(sa.text("SELECT id, name, abbreviation FROM unitofmeasure")).fetchall():
        keys = {(abbr or "").strip().lower().rstrip("."), (name or "").strip().lower()}
        for measure, table in KNOWN_UNITS.items():
            factor = next((f for aliases, f in table.items() if keys & set(aliases)), None)
            if factor is not None:
                bind.execute(
                    sa.text("UPDATE unitofmeasure SET measure = :m, factor = :f WHERE id = :id"),
                    {"m": measure, "f": factor, "id": unit_id},
                )
                break


def downgrade() -> None:
    with op.batch_alter_table("orderingredientusage") as batch_op:
        batch_op.drop_column("entered_unit")
        batch_op.drop_column("entered_quantity")
    with op.batch_alter_table("unitofmeasure") as batch_op:
        batch_op.drop_column("factor")
        batch_op.drop_column("measure")
