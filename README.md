# Cake Studio

Internal-first business management system. Stack: FastAPI + PostgreSQL (backend), React + Vite (frontend).

## Structure

```
backend/
  app/
    core/         # config, db session, security, permission dependency
    models/        # SQLModel tables (system, staff, permissions, orders, inventory, accounting)
    services/       # processing_date.py, permission_service.py - the two core patterns
    api/v1/endpoints/  # route handlers
frontend/
  src/
    store/authStore.ts   # holds token + permission set after login
    components/Can.tsx    # wraps any page/field/button, hides it if not permitted
    api/client.ts          # axios instance, attaches auth token
```

## The two core patterns

### 1. Processing date, not server date
Never call `datetime.now()`/`date.today()` for business logic. Always go through
`app/services/processing_date.py`. The admin config page (permission gated)
lets an authorized role advance the date, and every change is logged in
`ProcessingDateLog`.

### 2. Field/button-level permissions
Permission keys follow `{module}.{page}.{element_type}.{element_name}.{action}`.
- Backend: `Depends(require_permission("orders.button.delete"))` on any route.
- Frontend: `<Can permission="orders.button.delete"><DeleteButton/></Can>`.
- Role-based by default, with `StaffPermissionOverride` for per-user grant/deny
  exceptions (denies win over grants, both win over role permissions).

**Important:** frontend `Can` hiding is UX only. The backend independently
checks the same permission key on the API — never trust the client alone.

## Running locally

```bash
cp backend/.env.example backend/.env
docker compose up -d db
cd backend
pip install -r requirements.txt
alembic upgrade head        # creates all tables
python -m scripts.seed      # creates phase-1 roles, permissions, and an owner login
uvicorn app.main:app --reload
```

Then in another terminal:
```bash
cd frontend && npm install && npm run dev
```

Log in with `owner@cakestudio.local` / `change-me` — change this password before using
the system with real data. This account has the Super Admin role with every phase-1
permission. Other roles (Administrator, Manager, Employee, Accountant, Sales User,
Customer/Client, Delivery Boy) are created empty; assign them permissions from the
Roles and permissions page.

## Current phase (phase 1)
Login, system setup, organization profile, branches, permission management, staff
management, and user/access security configuration (password policy, lockout,
session timeout, 2FA, IP restrictions, login history, audit trail). Order, inventory,
and accounting tables exist in the schema (so foreign keys resolve cleanly) but have
no endpoints or UI yet — those come in later phases.

## Next steps
- Role edit UI (rename/describe an existing role) and role deletion
- Repurpose or remove the legacy Baker/Cashier roles from earlier seeding, if unused
- Only after phase 1 is solid: start on orders, then inventory, then accounting
