"""Get back into Cake Studio when nobody can sign in.

Works straight on the database - no running server or sign-in needed.

    python -m scripts.accounts
        List every account and anything that would stop it signing in.

    python -m scripts.accounts --reset you@example.com
        Set a new password and clear anything blocking that account
        (deactivated, locked after failed attempts, expired password).
        Add --disable-2fa if its two-factor code isn't available, and
        --make-super-admin to give it full access.

    python -m scripts.accounts --create you@example.com --name "Your Name"
        Create a new Super Admin account.

    python -m scripts.accounts --test-login you@example.com
        Try a sign-in exactly as the app does and say precisely why it fails.

    python -m scripts.accounts --clear-ip-allowlist
        Remove the IP restriction from Access policy, if it's locking you out.

Passwords are typed in hidden (not shown on screen) and must follow the
password rules set under Access policy.
"""
from __future__ import annotations

import argparse
import getpass
import os
import sys
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlmodel import Session, select

import app.main  # noqa: F401  - loads every model
from app.core.database import engine
from app.core.security import hash_password
from app.models.staff import Role, Staff, StaffRole
from app.services.access_policy import get_policy, validate_password


def roles_of(session: Session, staff_id) -> list[str]:
    return sorted(session.exec(
        select(Role.name).join(StaffRole, StaffRole.role_id == Role.id).where(StaffRole.staff_id == staff_id)
    ).all())


def blockers(staff: Staff, policy) -> list[str]:
    now = datetime.now(timezone.utc)
    out = []
    if not staff.is_active:
        out.append("deactivated")
    if staff.locked_until and staff.locked_until.replace(tzinfo=staff.locked_until.tzinfo or timezone.utc) > now:
        out.append("locked after failed sign-ins")
    if policy.password_expiry_days and staff.password_updated_at:
        age = (now - staff.password_updated_at.replace(tzinfo=staff.password_updated_at.tzinfo or timezone.utc)).days
        if age > policy.password_expiry_days:
            out.append("password expired")
    if staff.totp_enabled:
        out.append("needs a two-factor code")
    return out


def ask_password(policy) -> str:
    # The Windows installer passes the first admin's password this way (never on
    # the command line, where other programs could see it).
    given = os.environ.pop("CAKESTUDIO_ADMIN_PASSWORD", None)
    if given is not None:
        try:
            validate_password(given, policy)
        except HTTPException as exc:
            sys.exit("Password rejected: " + "; ".join(exc.detail if isinstance(exc.detail, list) else [str(exc.detail)]))
        return given
    while True:
        first = getpass.getpass("New password (hidden): ")
        try:
            validate_password(first, policy)
        except HTTPException as exc:
            print("  " + "; ".join(exc.detail if isinstance(exc.detail, list) else [str(exc.detail)]))
            continue
        if getpass.getpass("Type it again: ") != first:
            print("  The two passwords didn't match - try again.")
            continue
        return first


def make_super_admin(session: Session, staff: Staff) -> None:
    role = session.exec(select(Role).where(Role.name == "Super Admin")).first()
    if not role:
        sys.exit("There's no 'Super Admin' role in this database. Run: python -m scripts.seed")
    if not session.exec(select(StaffRole).where(StaffRole.staff_id == staff.id, StaffRole.role_id == role.id)).first():
        session.add(StaffRole(staff_id=staff.id, role_id=role.id))


def list_accounts(session: Session) -> None:
    policy = get_policy(session)
    staff = session.exec(select(Staff).order_by(Staff.email)).all()
    print(f"\n{len(staff)} account(s):\n")
    admins_ok = 0
    for s in staff:
        r = roles_of(session, s.id)
        b = blockers(s, policy)
        if "Super Admin" in r and not b:
            admins_ok += 1
        print(f"  {s.email:34} {', '.join(r) or '(no role)':28} {'OK' if not b else 'BLOCKED: ' + ', '.join(b)}")
    if policy.ip_allowlist and policy.ip_allowlist.strip():
        print(f"\n  Note: sign-in is limited to these IP addresses: {policy.ip_allowlist}")
    print()
    if not staff:
        print("No accounts at all. Create one with:\n  python -m scripts.accounts --create you@example.com --name \"Your Name\"")
    elif admins_ok == 0:
        print("No Super Admin can sign in right now. Fix one with:\n  python -m scripts.accounts --reset EMAIL --make-super-admin\n"
              "or create a new one with:\n  python -m scripts.accounts --create you@example.com --name \"Your Name\"")
    else:
        print(f"{admins_ok} Super Admin account(s) can sign in.")


def test_login(email: str) -> int:
    """Check an email and password exactly as the sign-in page does, straight
    from the database (no extra packages), then check the running server."""
    import urllib.error
    import urllib.parse
    import urllib.request

    from app.core.config import settings
    from app.core.security import verify_password
    from app.services.access_policy import is_ip_allowed

    password = getpass.getpass(f"Password for {email} (hidden): ")
    with Session(engine) as session:
        policy = get_policy(session)
        print(f"\nDatabase in use: {settings.DATABASE_URL.rsplit('@', 1)[-1]}")
        everyone = session.exec(select(Staff)).all()
        staff = next((s for s in everyone if s.email.strip().lower() == email.strip().lower()), None)
        if not staff:
            print(f"No account {email!r} in this database. Accounts that exist:")
            for s in everyone:
                print(f"  {s.email}")
            if not everyone:
                print('  (none) - create one: python -m scripts.accounts --create you@example.com --name "Your Name"')
            return 1

        problems = []
        if not is_ip_allowed("127.0.0.1", policy):
            problems.append("The IP restriction in Access policy blocks this computer -> python -m scripts.accounts --clear-ip-allowlist")
        b = blockers(staff, policy)
        if "locked after failed sign-ins" in b:
            problems.append(f"Locked after too many failed attempts -> python -m scripts.accounts --reset {staff.email}")
        if "deactivated" in b:
            problems.append(f"The account is deactivated -> python -m scripts.accounts --reset {staff.email}")
        if not verify_password(password, staff.hashed_password):
            problems.append(f"Wrong password -> set a new one: python -m scripts.accounts --reset {staff.email}")
        if staff.totp_enabled:
            problems.append(f"Needs a two-factor code from an authenticator app -> if you don't have it: "
                            f"python -m scripts.accounts --reset {staff.email} --disable-2fa")

        if problems:
            print(f"\n{staff.email} can't sign in:")
            for p_ in problems:
                print(f"  - {p_}")
            return 1
        print(f"\nOK - {staff.email} and this password are correct"
              + (" (the password has expired, so you'll be asked to change it)." if "password expired" in b else "."))

    # The account is fine - now check the server the browser talks to.
    body = urllib.parse.urlencode({"username": email, "password": password}).encode()
    try:
        with urllib.request.urlopen(urllib.request.Request("http://localhost:8000/api/v1/auth/login", data=body), timeout=5) as resp:
            print(f"The running server at http://localhost:8000 accepts it too ({resp.status}).")
            print("So sign-in works. In the browser: open http://localhost:5173, press Ctrl+Shift+R, and type the email carefully.")
    except urllib.error.HTTPError as exc:
        msg = exc.read().decode(errors="replace")[:200]
        print(f"But the running server at http://localhost:8000 answered {exc.code}: {msg}\n"
              "  -> It's using a different database or old code. Stop it (Ctrl+C) and start it again from this folder:\n"
              "     uvicorn app.main:app --reload")
    except Exception as exc:  # not running / not reachable
        print(f"The server at http://localhost:8000 isn't reachable ({exc.__class__.__name__}).\n"
              "  -> Start it from this folder: uvicorn app.main:app --reload")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description="List, unlock, reset or create Cake Studio sign-in accounts.")
    ap.add_argument("--reset", metavar="EMAIL", help="set a new password and clear anything blocking this account")
    ap.add_argument("--create", metavar="EMAIL", help="create a new Super Admin account")
    ap.add_argument("--name", help="full name for --create")
    ap.add_argument("--make-super-admin", action="store_true", help="with --reset: also give the account the Super Admin role")
    ap.add_argument("--disable-2fa", action="store_true", help="with --reset: turn off two-factor sign-in for the account")
    ap.add_argument("--clear-ip-allowlist", action="store_true", help="remove the IP restriction from Access policy")
    ap.add_argument("--test-login", metavar="EMAIL", help="try signing in exactly as the app does and explain any failure")
    args = ap.parse_args()

    if args.test_login:
        return test_login(args.test_login)

    with Session(engine) as session:
        policy = get_policy(session)

        if args.clear_ip_allowlist:
            policy.ip_allowlist = None
            session.add(policy)
            session.commit()
            print("IP restriction removed - any computer can reach the sign-in page again.")

        if args.create:
            email = args.create.strip().lower()
            if session.exec(select(Staff).where(Staff.email == email)).first():
                sys.exit(f"{email} already exists. Use --reset {email} instead.")
            name = (args.name or "").strip() or (input("Full name: ").strip() if sys.stdin.isatty() else "")
            if not name:
                sys.exit("A name is needed.")
            staff = Staff(full_name=name, email=email, hashed_password=hash_password(ask_password(policy)),
                          is_active=True, password_updated_at=datetime.now(timezone.utc))
            session.add(staff)
            session.flush()
            make_super_admin(session, staff)
            session.commit()
            print(f"\nCreated Super Admin {email}. You can sign in now.")

        elif args.reset:
            email = args.reset.strip().lower()
            staff = session.exec(select(Staff).where(Staff.email == email)).first()
            if not staff:
                sys.exit(f"No account with email {email}. See who exists with: python -m scripts.accounts")
            print(f"Resetting {staff.full_name} <{email}> ({', '.join(roles_of(session, staff.id)) or 'no role'})")
            staff.hashed_password = hash_password(ask_password(policy))
            staff.password_updated_at = datetime.now(timezone.utc)
            staff.is_active = True
            staff.failed_login_attempts = 0
            staff.locked_until = None
            if args.disable_2fa:
                staff.totp_enabled = False
                staff.totp_secret = None
            if args.make_super_admin:
                make_super_admin(session, staff)
            session.add(staff)
            session.commit()
            left = blockers(staff, policy)
            print(f"\nDone. {email} can sign in now." if not left else f"\nPassword set, but still: {', '.join(left)} "
                  "(use --disable-2fa if the two-factor code isn't available).")

        if not (args.create or args.reset or args.clear_ip_allowlist) or args.create or args.reset:
            list_accounts(session)
    return 0


if __name__ == "__main__":
    sys.exit(main())
