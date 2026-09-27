"""Clear test data before handing Cake Studio over to a client.

    python -m scripts.reset_for_deployment              # preview, backup, then asks you to type DELETE
    python -m scripts.reset_for_deployment --suppliers  # also remove suppliers
    python -m scripts.reset_for_deployment --history    # also clear login history, audit trail and date history
    python -m scripts.reset_for_deployment --keep-staff owner@cakestudio.local
                                                        # also remove every other staff account (implies --history)

Always removed: orders (with items, add-ons, ingredient usage, print history),
customers, ingredients (with stock movements, purchases and recipe lines),
expenses, and uploaded cake design photos. Order numbers restart at ORD-0001.

Always kept: organisation and logo, branches, roles and permissions, staff
logins, cake setup lists (flavours, sizes, colours...), units, delivery zones,
and all system settings (date, decimals, printer, employee codes).

A full database backup (.sql) is written to backend/backups/ first. The
delete runs in one transaction: it either all happens or nothing changes.
"""
from __future__ import annotations

import argparse
import glob
import os
import shutil
import subprocess
import sys
from datetime import datetime
from urllib.parse import unquote, urlparse

from sqlalchemy import text

from app.core.config import settings
from app.core.database import engine

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DESIGN_PHOTOS = os.path.join(BACKEND_DIR, "static", "uploads", "order-references")

# Deleted in this order so nothing is left pointing at a removed row.
ALWAYS = [
    ("printjob", "Kitchen ticket print history"),
    ("orderingredientusage", "Ingredients logged against orders"),
    ("orderitemaddon", "Order add-ons"),
    ("orderitem", "Order items"),
    ('"order"', "Orders"),
    ("customer", "Customers"),
    ("stockmovement", "Stock movements"),
    ("purchaseitem", "Purchase lines"),
    ("purchase", "Purchases"),
    ("recipeitem", "Recipe ingredient lines"),
    ("inventoryitem", "Ingredients"),
    ("expense", "Expenses"),
]
SUPPLIERS = [("supplier", "Suppliers")]
HISTORY = [
    ("loginhistory", "Login history"),
    ("auditlog", "Audit trail"),
    ("processingdatelog", "Processing date history"),
]


def table_exists(conn, name: str) -> bool:
    return conn.execute(text("select to_regclass(:n) is not null"), {"n": name.strip('"')}).scalar()


def count(conn, name: str) -> int:
    return conn.execute(text(f"select count(*) from {name}")).scalar() if table_exists(conn, name) else 0


def find_pg_dump() -> str | None:
    found = shutil.which("pg_dump")
    if found:
        return found
    # Windows installs don't always put PostgreSQL on PATH
    candidates = sorted(glob.glob(r"C:\Program Files\PostgreSQL\*\bin\pg_dump.exe"), reverse=True)
    return candidates[0] if candidates else None


def backup() -> str:
    exe = find_pg_dump()
    if not exe:
        raise RuntimeError(
            "pg_dump wasn't found, so no backup can be made. Add PostgreSQL's bin folder to PATH "
            r'(e.g. $env:Path += ";C:\Program Files\PostgreSQL\18\bin") or run with --no-backup if you are sure.'
        )
    url = urlparse(settings.DATABASE_URL.replace("postgresql+psycopg://", "postgresql://"))
    os.makedirs(os.path.join(BACKEND_DIR, "backups"), exist_ok=True)
    path = os.path.join(BACKEND_DIR, "backups", f"before-reset-{datetime.now():%Y%m%d-%H%M%S}.sql")
    env = dict(os.environ, PGPASSWORD=unquote(url.password or ""))
    cmd = [exe, "-h", url.hostname or "localhost", "-p", str(url.port or 5432), "-U", unquote(url.username or "postgres"),
           "-d", url.path.lstrip("/"), "-f", path, "--no-owner"]
    result = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if result.returncode != 0 or not os.path.isfile(path) or os.path.getsize(path) == 0:
        raise RuntimeError(f"Backup failed: {result.stderr.strip() or 'no output'}")
    return path


def main() -> int:
    ap = argparse.ArgumentParser(description="Clear test data before deploying Cake Studio to a client.")
    ap.add_argument("--suppliers", action="store_true", help="also remove suppliers")
    ap.add_argument("--history", action="store_true", help="also clear login history, audit trail and date history")
    ap.add_argument("--keep-staff", metavar="EMAILS", help="remove every staff account except these (comma separated); implies --history")
    ap.add_argument("--no-backup", action="store_true", help="skip the backup (not recommended)")
    ap.add_argument("--yes", action="store_true", help="don't ask for confirmation")
    args = ap.parse_args()

    keep = [e.strip().lower() for e in (args.keep_staff or "").split(",") if e.strip()]
    if keep:
        args.history = True
    plan = ALWAYS + (SUPPLIERS if args.suppliers else []) + (HISTORY if args.history else [])

    with engine.connect() as conn:
        db = conn.execute(text("select current_database()")).scalar()
        print(f"\nDatabase: {db}\n\nThis will permanently delete:")
        for table, label in plan:
            print(f"  {label:36} {count(conn, table):>7}")
        photos = [f for f in glob.glob(os.path.join(DESIGN_PHOTOS, "*")) if os.path.isfile(f)]
        print(f"  {'Uploaded cake design photos':36} {len(photos):>7}")

        staff_to_remove: list[tuple[str, str]] = []
        if keep:
            rows = conn.execute(text("select id, email from staff")).all()
            known = {str(e).lower() for _, e in rows}
            missing = [e for e in keep if e not in known]
            if missing:
                print(f"\nStopping: no staff account with email {', '.join(missing)}. Nothing was changed.")
                return 1
            staff_to_remove = [(str(i), e) for i, e in rows if str(e).lower() not in keep]
            print(f"  {'Staff accounts':36} {len(staff_to_remove):>7}")
            for _, e in staff_to_remove:
                print(f"      - {e}")

            # Never leave the system with nobody who can run it.
            kept = conn.execute(text(
                "select s.email, s.is_active, coalesce(string_agg(r.name, ', ' order by r.name), '') "
                "from staff s left join staffrole sr on sr.staff_id = s.id left join role r on r.id = sr.role_id "
                "where lower(s.email) = any(:keep) group by s.email, s.is_active"), {"keep": keep}).all()
            print("\n  These accounts are KEPT and will be the only ones that can sign in:")
            for email, active, roles in kept:
                print(f"      + {email}  ({roles or 'no role'}{'' if active else ', DEACTIVATED'})")
            if not any(active and "Super Admin" in (roles or "").split(", ") for _, active, roles in kept):
                print("\nStopping: none of the kept accounts is an active Super Admin, so nobody could run the system "
                      "afterwards. Keep your own admin login, or first give an account the Super Admin role with:\n"
                      "  python -m scripts.accounts --reset EMAIL --make-super-admin\nNothing was changed.")
                return 1

        print("\nKept: organisation, branches, roles & permissions, "
              + (f"staff login(s) for {', '.join(keep)}" if keep else "all staff logins")
              + ", cake setup lists, units, delivery zones, system settings"
              + ("" if args.suppliers else ", suppliers") + ("" if args.history else ", login/audit history") + ".")

    if not args.yes:
        answer = input('\nType DELETE to continue, anything else to cancel: ').strip()
        if answer != "DELETE":
            print("Cancelled. Nothing was changed.")
            return 1

    if args.no_backup:
        print("\nSkipping backup (--no-backup).")
    else:
        print("\nBacking up the database first...")
        try:
            print(f"  Backup saved: {backup()}")
        except RuntimeError as exc:
            print(f"\n{exc}\nNothing was changed.")
            return 1

    with engine.begin() as conn:  # one transaction: all or nothing
        for table, label in plan:
            if table_exists(conn, table):
                conn.execute(text(f"delete from {table}"))
        if table_exists(conn, "recipe"):
            conn.execute(text("delete from recipe where id not in (select distinct recipe_id from recipeitem)"))
        if table_exists(conn, "ordersequence"):
            conn.execute(text("update ordersequence set next_number = 1"))
        if staff_to_remove:
            ids = [i for i, _ in staff_to_remove]
            for t in ("staffrole", "staffpermissionoverride"):
                if table_exists(conn, t):
                    conn.execute(text(f"delete from {t} where staff_id = any(cast(:ids as uuid[]))"), {"ids": ids})
            if table_exists(conn, "branch"):
                conn.execute(text("update branch set manager_staff_id = null where manager_staff_id = any(cast(:ids as uuid[]))"), {"ids": ids})
            conn.execute(text("delete from staff where id = any(cast(:ids as uuid[]))"), {"ids": ids})

    removed = 0
    for f in glob.glob(os.path.join(DESIGN_PHOTOS, "*")):
        if os.path.isfile(f) and not f.endswith(".gitkeep"):
            os.remove(f)
            removed += 1

    with engine.connect() as conn:
        left = {label: count(conn, t) for t, label in plan if count(conn, t)}
    if left:
        print(f"\nSomething wasn't removed: {left}")
        return 1
    print(f"\nDone. All listed data removed, {removed} design photo(s) deleted, order numbers restart at ORD-0001.")
    if keep:
        print(f"Sign in with: {', '.join(keep)}. If that ever fails: python -m scripts.accounts")
    return 0


if __name__ == "__main__":
    sys.exit(main())
