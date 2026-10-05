import os
"""Run once against a fresh database, after `alembic upgrade head`.

    python -m scripts.seed

Creates the phase-1 permission set, base roles, a Super Admin role with every
permission, default access policy, organization profile, default branch,
and one super admin login. Safe to re-run - existing rows are left alone.
"""
import uuid
from datetime import date, datetime, timezone

from sqlmodel import Session, select

from app.core.database import engine
from app.core.security import hash_password
from app.models.staff import Staff, Role, StaffRole
from app.models.permissions import Permission, RolePermission
from app.models.system import SystemConfig
from app.models.organization import Organization
from app.models.branch import Branch
from app.models.access import AccessPolicy
from app.models.inventory import UnitOfMeasure
from app.services.units import ensure_standard_units
from app.models.catalog import CakeFlavor, CakeFilling, CakeFrosting, CakeShape, CakeSize, Theme, CakeAddon
from app.services.branch_access import grant_full_access_for_all_branches

# Phase 1 permission keys only. Add orders.*, inventory.*, accounting.* keys
# here once those modules are actually being built.
PHASE_1_PERMISSIONS = [
    ("system.config.page.view", "View system setup page"),
    ("system.config.field.processing_date.edit", "Advance the processing date"),
    ("system.config.field.employee_code_format.edit", "Configure the auto-generated employee code format"),
    ("system.config.field.decimals.edit", "Set decimal places for amounts and quantities"),
    ("system.config.field.printer.edit", "Set up kitchen ticket printing"),
    ("organization.page.view", "View organization profile page"),
    ("organization.field.identity.edit", "Edit company name, legal name, registration, tax number, type, industry"),
    ("organization.field.branding.edit", "Edit logo and favicon"),
    ("organization.field.contact.edit", "Edit address, phone, email, website"),
    ("organization.field.hours.edit", "Edit business hours and timezone"),
    ("organization.field.locale.edit", "Edit language, currency, date and number format"),
    ("branches.page.view", "View branches page"),
    ("branches.button.create", "Create a new branch"),
    ("permissions.page.view", "View role and permission management page"),
    ("permissions.role.create", "Create a new role"),
    ("permissions.role.edit", "Edit a role's name or description"),
    ("permissions.role.delete", "Delete a role that has no staff assigned"),
    ("permissions.role.assign_permission", "Attach/detach permissions on a role"),
    ("permissions.staffoverride.edit", "Grant/deny per-user permission overrides"),
    ("staff.page.view", "View staff management page"),
    ("staff.button.create", "Create a new staff account"),
    ("staff.field.profile.edit", "Edit a staff member's profile details"),
    ("staff.field.role.edit", "Assign roles to a staff member"),
    ("staff.field.status.edit", "Activate/deactivate a staff account"),
    ("access_policy.page.view", "View user and access configuration page"),
    ("access_policy.field.edit", "Edit password policy, lockout, session, IP and default role rules"),
    ("login_history.page.view", "View login history"),
    ("audit_trail.page.view", "View the audit trail"),
]

# Order-setup catalogs (phase 2). Generated as page.view/button.create/
# field.edit/button.delete for each of the 7 simple attribute catalogs.
CATALOG_MODULES = [
    ("cake_flavors", "Cake flavours"),
    ("cake_fillings", "Cake fillings"),
    ("cake_frostings", "Cake frostings"),
    ("cake_shapes", "Cake shapes"),
    ("cake_sizes", "Cake sizes"),
    ("themes", "Themes / occasions"),
    ("cake_addons", "Decorations / add-ons"),
    ("cake_boxes", "Cake boxes"),
    ("cake_tiers", "Cake tiers"),
    ("cake_colors", "Cake colors"),
]
for _prefix, _label in CATALOG_MODULES:
    PHASE_1_PERMISSIONS += [
        (f"{_prefix}.page.view", f"View {_label} setup page"),
        (f"{_prefix}.button.create", f"Add a new {_label.lower()} item"),
        (f"{_prefix}.field.edit", f"Edit a {_label.lower()} item"),
        (f"{_prefix}.button.delete", f"Delete a {_label.lower()} item"),
    ]

# Delivery pricing zones - distance-bracket pricing, not a named catalog,
# but follows the same permission shape.
PHASE_1_PERMISSIONS += [
    ("delivery_zones.page.view", "View delivery zones setup page"),
    ("delivery_zones.button.create", "Add a new delivery zone"),
    ("delivery_zones.field.edit", "Edit a delivery zone"),
    ("delivery_zones.button.delete", "Delete a delivery zone"),
]

# Order taking - draft -> confirmed -> sent to baker workflow
PHASE_1_PERMISSIONS += [
    ("orders.page.view", "View the order list and order details"),
    ("orders.button.create", "Create a new order and search/add customers"),
    ("orders.field.edit", "Edit a draft order"),
    ("orders.button.confirm", "Confirm a draft order"),
    ("orders.button.send_to_baker", "Send a confirmed order to the baker"),
    ("orders.button.accept_baking", "Accept or decline an order assigned to you for baking"),
    ("orders.button.start_baking", "Log ingredient usage and start production on an order"),
    ("orders.button.mark_ready", "Mark an order ready for delivery/pickup"),
    ("orders.button.assign_rider", "Assign a delivery rider to a ready order"),
    ("orders.button.print", "Print or reprint an order's kitchen ticket"),
    ("inventory.button.edit_purchase", "Edit a recorded purchase (stock is corrected automatically)"),
    ("customers.page.view", "Open the Customers page"),
    ("customers.field.edit", "Edit customer details"),
    ("reports.page.view", "Open the Reports section"),
    ("reports.orders.view", "Reports: orders, best sellers, money outstanding"),
    ("reports.inventory.view", "Reports: ingredients used, purchases, stock value and wastage"),
    ("reports.profit.view", "Reports: cake cost and profit"),
    ("reports.staff.view", "Reports: baker and rider performance"),
    ("reports.customers.view", "Reports: customers"),
    ("orders.button.start_delivery", "Rider: start the delivery trip for an order assigned to you"),
    ("orders.button.mark_delivered", "Rider: mark your delivery done and enter the amount collected"),
    ("orders.button.handover", "Record payment and complete pickup/delivery handover"),
    ("orders.button.cancel", "Cancel an order"),
    ("inventory.page.view", "View the ingredient inventory list"),
    ("inventory.button.create", "Add a new ingredient to inventory"),
    ("inventory.field.edit", "Edit an ingredient's stock details"),
    ("inventory.button.delete", "Delete an inventory item or supplier"),
    ("inventory.button.adjust_stock", "Record a manual stock adjustment (purchase, wastage, correction)"),
]

# Standard role set. "Owner" is renamed to "Super Admin" in place if it
# already exists, so an existing super-admin account keeps its permissions
# and login history instead of ending up split across two roles.
BASE_ROLES = [
    "Super Admin",
    "Administrator",
    "Manager",
    "Employee",
    "Baker",
    "Accountant",
    "Sales User",
    "Customer/Client",
    "Delivery Boy",
]
LEGACY_ROLE_RENAMES = {"Owner": "Super Admin"}


def run() -> None:
    with Session(engine) as session:
        # --- rename legacy role names in place, if present ---
        for old_name, new_name in LEGACY_ROLE_RENAMES.items():
            legacy = session.exec(select(Role).where(Role.name == old_name)).first()
            if legacy and not session.exec(select(Role).where(Role.name == new_name)).first():
                legacy.name = new_name
                session.add(legacy)
                session.commit()
                print(f"Renamed role '{old_name}' to '{new_name}'.")

        # --- permissions ---
        perm_by_key: dict[str, Permission] = {}
        for key, description in PHASE_1_PERMISSIONS:
            existing = session.exec(select(Permission).where(Permission.key == key)).first()
            if existing:
                perm_by_key[key] = existing
                continue
            perm = Permission(id=uuid.uuid4(), key=key, description=description)
            session.add(perm)
            perm_by_key[key] = perm
        session.commit()

        # --- roles ---
        role_by_name: dict[str, Role] = {}
        for name in BASE_ROLES:
            existing = session.exec(select(Role).where(Role.name == name)).first()
            if existing:
                role_by_name[name] = existing
                continue
            role = Role(id=uuid.uuid4(), name=name)
            session.add(role)
            role_by_name[name] = role
        session.commit()

        # --- Super Admin gets every phase-1 permission; other roles start
        # empty and get configured later from the permission management page ---
        super_admin_role = role_by_name["Super Admin"]
        for perm in perm_by_key.values():
            exists = session.exec(
                select(RolePermission).where(
                    RolePermission.role_id == super_admin_role.id,
                    RolePermission.permission_id == perm.id,
                )
            ).first()
            if not exists:
                session.add(RolePermission(role_id=super_admin_role.id, permission_id=perm.id))
        session.commit()

        # --- Baker gets the minimum needed to see their queue and do their
        # job, without any of the admin/manager actions (confirm, send to
        # baker, assign rider, handover, etc.) ---
        BAKER_DEFAULT_PERMISSIONS = [
            "orders.page.view",
            "orders.button.accept_baking",
            "orders.button.start_baking",
            "orders.button.mark_ready",
            "inventory.page.view",
        ]
        baker_role = role_by_name.get("Baker")
        if baker_role:
            for key in BAKER_DEFAULT_PERMISSIONS:
                perm = perm_by_key.get(key)
                if not perm:
                    continue
                exists = session.exec(
                    select(RolePermission).where(
                        RolePermission.role_id == baker_role.id,
                        RolePermission.permission_id == perm.id,
                    )
                ).first()
                if not exists:
                    session.add(RolePermission(role_id=baker_role.id, permission_id=perm.id))
            session.commit()

        # --- Manager runs the order desk: take and confirm orders, send them
        # to a baker, then assign a rider or complete the pickup/delivery.
        # Applied only while the Manager role has no permissions at all, so
        # anything you've configured by hand in Roles & permissions is never
        # overwritten by re-running the seed. ---
        MANAGER_DEFAULT_PERMISSIONS = [
            "orders.page.view",
            "orders.button.create",
            "orders.field.edit",
            "orders.button.confirm",
            "orders.button.send_to_baker",
            "orders.button.assign_rider",
            "orders.button.handover",
            "orders.button.cancel",
            "orders.button.print",
            "customers.page.view", "customers.field.edit",
            # reports, except profit (kept for owners unless you grant it)
            "reports.page.view", "reports.orders.view", "reports.inventory.view",
            "reports.staff.view", "reports.customers.view",
            "inventory.page.view",
            # needed to fill the New order form's dropdowns
            "cake_flavors.page.view", "cake_fillings.page.view", "cake_frostings.page.view",
            "cake_shapes.page.view", "cake_sizes.page.view", "cake_tiers.page.view",
            "cake_colors.page.view", "themes.page.view", "cake_addons.page.view",
            "cake_boxes.page.view", "delivery_zones.page.view",
        ]
        manager_role = role_by_name.get("Manager")
        if manager_role:
            already_configured = session.exec(
                select(RolePermission).where(RolePermission.role_id == manager_role.id)
            ).first()
            if not already_configured:
                for key in MANAGER_DEFAULT_PERMISSIONS:
                    perm = perm_by_key.get(key)
                    if perm:
                        session.add(RolePermission(role_id=manager_role.id, permission_id=perm.id))
                session.commit()
                print("Gave the Manager role its default order-desk permissions.")

        # --- Delivery Boy: see their delivery queue and run their own trips.
        # Like the Baker defaults, these are the role's core job, so they're
        # always ensured. ---
        RIDER_DEFAULT_PERMISSIONS = [
            "orders.page.view",
            "orders.button.start_delivery",
            "orders.button.mark_delivered",
        ]
        rider_role = role_by_name.get("Delivery Boy")
        if rider_role:
            for key in RIDER_DEFAULT_PERMISSIONS:
                perm = perm_by_key.get(key)
                if perm and not session.exec(
                    select(RolePermission).where(
                        RolePermission.role_id == rider_role.id, RolePermission.permission_id == perm.id
                    )
                ).first():
                    session.add(RolePermission(role_id=rider_role.id, permission_id=perm.id))
            session.commit()

        # --- Units: kg always has g, litre has ml, dozen has pieces ---
        filled, added = ensure_standard_units(session)
        if filled or added:
            print(f"Units: set the type on {filled} unit(s); added {', '.join(added) or 'none'}.")

        # --- system config row ---
        config = session.exec(select(SystemConfig).where(SystemConfig.id == 1)).first()
        if not config:
            session.add(SystemConfig(id=1, current_processing_date=date.today()))
            session.commit()

        # --- organization profile row ---
        org = session.exec(select(Organization).where(Organization.id == 1)).first()
        if not org:
            session.add(Organization(id=1))
            session.commit()

        # --- default branch ---
        existing_branch = session.exec(select(Branch)).first()
        if not existing_branch:
            session.add(Branch(id=uuid.uuid4(), name="Main branch", code="MAIN", is_default=True))
            session.commit()

        # --- Super Admin gets full per-branch field access on every branch,
        # so it's never accidentally locked out of branch data ---
        grant_full_access_for_all_branches(session, "Super Admin")

        # --- access policy row ---
        policy = session.exec(select(AccessPolicy).where(AccessPolicy.id == 1)).first()
        if not policy:
            session.add(AccessPolicy(id=1, default_role_id=role_by_name["Employee"].id))
            session.commit()

        # --- initial super admin login ---
        owner_email = "owner@cakestudio.local"
        # The Windows installer creates the client's own admin instead, so it
        # skips this well-known default login.
        skip_default_admin = os.environ.get("CAKESTUDIO_SKIP_DEFAULT_ADMIN") == "1"
        existing_staff = session.exec(select(Staff).where(Staff.email == owner_email)).first()
        if skip_default_admin:
            print("Skipping the default owner login (using the accounts already in the database).")
        elif not existing_staff:
            owner = Staff(
                id=uuid.uuid4(),
                full_name="Studio Owner",
                email=owner_email,
                hashed_password=hash_password("change-me"),
                is_active=True,
                created_at=datetime.now(timezone.utc),
                password_updated_at=datetime.now(timezone.utc),
            )
            session.add(owner)
            session.commit()
            session.add(StaffRole(staff_id=owner.id, role_id=super_admin_role.id))
            session.commit()
            print(f"Created super admin login: {owner_email} / change-me  (change this password immediately)")
        else:
            print("Super admin account already exists, skipped.")

        # --- starter catalog data, so the order-setup pages aren't empty on first run ---
        def _seed_named(model, items: list[tuple]):
            for idx, (name, desc, price) in enumerate(items):
                if not session.exec(select(model).where(model.name == name)).first():
                    session.add(model(name=name, description=desc, price_modifier=price, sort_order=idx))
            session.commit()

        _seed_named(CakeFlavor, [
            ("Vanilla", "Classic vanilla sponge", 0),
            ("Chocolate", "Rich cocoa sponge", 0),
            ("Red Velvet", "Cocoa sponge with a hint of buttermilk tang", 300),
            ("Lemon", "Light sponge with fresh lemon zest", 200),
        ])
        _seed_named(CakeFilling, [
            ("Buttercream", "Classic vanilla buttercream", 0),
            ("Fresh Cream", "Light whipped cream", 0),
            ("Chocolate Ganache", "Rich dark chocolate ganache", 250),
            ("Fruit Compote", "Mixed berry compote", 300),
        ])
        _seed_named(CakeFrosting, [
            ("Buttercream", "Smooth classic buttercream finish", 0),
            ("Fondant", "Smooth rolled fondant finish", 500),
            ("Whipped Cream", "Light whipped cream finish", 0),
            ("Ganache", "Glossy chocolate ganache finish", 300),
        ])
        _seed_named(CakeShape, [
            ("Round", "Classic round cake", 0),
            ("Square", "Classic square cake", 0),
            ("Heart", "Heart-shaped cake", 400),
            ("Number", "Number-shaped cake", 800),
        ])

        for idx, (name, servings, price) in enumerate([
            ("6 inch", 8, 0),
            ("8 inch", 15, 800),
            ("10 inch", 25, 1500),
            ("12 inch", 40, 2500),
        ]):
            if not session.exec(select(CakeSize).where(CakeSize.name == name)).first():
                session.add(CakeSize(name=name, servings=servings, price_modifier=price, sort_order=idx))
        session.commit()

        for idx, (name, desc) in enumerate([
            ("Birthday", "Birthday celebrations"),
            ("Wedding", "Wedding cakes"),
            ("Baby Shower", "Baby shower celebrations"),
            ("Anniversary", "Anniversary celebrations"),
        ]):
            if not session.exec(select(Theme).where(Theme.name == name)).first():
                session.add(Theme(name=name, description=desc, sort_order=idx))
        session.commit()

        for idx, (name, desc, price, max_qty) in enumerate([
            ("Fondant Topper", "Custom fondant topper", 500, 1),
            ("Edible Flowers", "Edible sugar flowers", 300, 5),
            ("Sprinkles", "Colorful sprinkle mix", 100, 1),
            ("Personalized Message", "Custom message in icing", 150, 1),
        ]):
            if not session.exec(select(CakeAddon).where(CakeAddon.name == name)).first():
                session.add(CakeAddon(name=name, description=desc, price=price, max_qty=max_qty, sort_order=idx))
        session.commit()

        print(f"Seeded {len(perm_by_key)} permissions and {len(role_by_name)} roles.")


if __name__ == "__main__":
    run()
