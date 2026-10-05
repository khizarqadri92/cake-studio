import os

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    PROJECT_NAME: str = "Cake Studio"
    DATABASE_URL: str = "postgresql+psycopg://cake:cake@localhost:5432/cake_studio"
    SECRET_KEY: str = "change-me-in-env"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 8  # 8 hour shift
    TIMEZONE: str = "Asia/Karachi"
    # Extra browser origins allowed to call the API (comma separated). Only
    # needed in development; in production the app and API share one address.
    CORS_ORIGINS: str = "http://localhost:5173"
    # Built web app to serve (frontend/dist). Empty = look next to the backend.
    FRONTEND_DIST: str = ""
    # "production" refuses to start with the default secret key.
    ENVIRONMENT: str = "development"
    # Folder for uploaded files (logo, design photos). Empty = backend/static.
    # The Windows installer keeps it under C:\ProgramData\CakeStudio so updates
    # never touch it.
    STATIC_DIR: str = ""

    class Config:
        # The installed service keeps its settings (with secrets) outside
        # Program Files and points here with CAKESTUDIO_ENV_FILE.
        env_file = os.environ.get("CAKESTUDIO_ENV_FILE", ".env")


settings = Settings()
