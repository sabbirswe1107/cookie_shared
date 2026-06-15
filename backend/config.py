import os
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./cookie_share.db"
    ALLOWED_ORIGINS: str = "http://localhost:8000 http://127.0.0.1:8000 chrome-extension://*"
    SUPABASE_URL: str = ""
    SUPABASE_KEY: str = ""

    JWT_SECRET: str = "change-me-in-production-use-a-long-random-string"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Admin credentials — set in .env; used for admin login & auto-synced to DB on startup
    ADMIN_EMAIL: str = "admin@example.com"
    ADMIN_PASSWORD: str = "admin123"

    # Optional demo user seeded on first run (for testing the user portal)
    USER_EMAIL: str = "user@example.com"
    USER_PASSWORD: str = "user123"
    SEED_DEMO_USER: bool = True

    model_config = SettingsConfigDict(
        env_file=os.path.join(os.path.dirname(__file__), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins(self) -> List[str]:
        return [origin for origin in self.ALLOWED_ORIGINS.split() if origin.strip()]
        
    @property
    def get_database_url(self) -> str:
        if self.DATABASE_URL.startswith("postgres://"):
            return self.DATABASE_URL.replace("postgres://", "postgresql://", 1)
        return self.DATABASE_URL


settings = Settings()
