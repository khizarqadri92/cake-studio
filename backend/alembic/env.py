from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

from sqlmodel import SQLModel

# Import every model module so its table is registered on SQLModel.metadata
# before Alembic compares against it. Add new model files here as they're created.
from app.models import system, staff, permissions, orders, inventory, accounting, organization, branch, access, audit, branch_access, employee_code, catalog, delivery, customer, printing  # noqa: F401
from app.core.config import settings

config = context.config
# Alembic's config reader treats "%" as special, so escape it. Passwords with
# characters like @ or % are stored URL-encoded (e.g. %40) and must survive.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
