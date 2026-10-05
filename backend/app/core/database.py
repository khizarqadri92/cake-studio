from sqlmodel import SQLModel, create_engine, Session
from app.core.config import settings

# pool_pre_ping: check a connection is alive before using it, so the app
# reconnects by itself after the database restarts (restore, Windows update...).
engine = create_engine(settings.DATABASE_URL, echo=False, pool_pre_ping=True)


def init_db() -> None:
    # In production, use Alembic migrations instead of create_all.
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
