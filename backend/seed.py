"""Seed admin (from .env), optional demo user, and default services."""

from sqlalchemy.orm import Session

import auth
import crud
import models
from config import settings


DEFAULT_SERVICES = [
    {
        "slug": "chatgpt",
        "name": "ChatGPT",
        "target_url": "https://chat.openai.com",
        "cookie_domains": [".openai.com", "chat.openai.com"],
        "icon_url": "https://cdn.oaistatic.com/assets/favicon-o20kmmos.svg",
        "encryption_key": "chatgpt-session-key",
        "servers": ["Server 1", "Server 2", "Server 3"],
    },
    {
        "slug": "grammarly",
        "name": "Grammarly",
        "target_url": "https://app.grammarly.com",
        "cookie_domains": [".grammarly.com"],
        "icon_url": "https://static-web.grammarly.com/cms/master/public/favicon.ico",
        "encryption_key": "grammarly-session-key",
        "servers": ["Server 1", "Server 2"],
    },
    {
        "slug": "perplexity",
        "name": "Perplexity",
        "target_url": "https://www.perplexity.ai",
        "cookie_domains": [".perplexity.ai"],
        "icon_url": "https://www.perplexity.ai/favicon.ico",
        "encryption_key": "perplexity-session-key",
        "servers": ["Server 1", "Server 2", "Server 3"],
    },
]


def sync_admin_from_env(db: Session) -> models.User:
    """Create or update admin user from ADMIN_EMAIL / ADMIN_PASSWORD in .env."""
    email = settings.ADMIN_EMAIL.strip().lower()
    password = settings.ADMIN_PASSWORD

    if not email or not password:
        raise ValueError("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env")

    password_hash = auth.hash_password(password)
    user = auth.get_user_by_email(db, email)

    if user:
        user.password_hash = password_hash
        user.role = "admin"
        user.is_active = True
        db.commit()
        db.refresh(user)
        print(f"[Seed] Admin synced from .env: {email}")
        return user

    user = crud.create_user(db, email, password_hash, role="admin")
    print(f"[Seed] Admin created from .env: {email}")
    return user


def seed_demo_user(db: Session) -> None:
    if not settings.SEED_DEMO_USER:
        return

    email = settings.USER_EMAIL.strip().lower()
    password = settings.USER_PASSWORD
    if not email or not password:
        return

    existing = auth.get_user_by_email(db, email)
    if existing:
        return

    user = crud.create_user(db, email, auth.hash_password(password), role="user")
    crud.create_subscription(db, user.id, plan="premium", expires_at=None)
    print(f"[Seed] Demo user created: {email}")


def seed_database(db: Session) -> None:
    sync_admin_from_env(db)
    seed_demo_user(db)

    if db.query(models.Service).count() == 0:
        from schemas import ServiceCreate, ServerCreate

        for svc_data in DEFAULT_SERVICES:
            data = dict(svc_data)
            servers = data.pop("servers")
            svc = crud.create_service(
                db,
                ServiceCreate(
                    slug=data["slug"],
                    name=data["name"],
                    target_url=data["target_url"],
                    cookie_domains=data["cookie_domains"],
                    icon_url=data.get("icon_url"),
                    encryption_key=data.get("encryption_key"),
                ),
            )
            for label in servers:
                crud.create_server(db, svc.id, ServerCreate(label=label, max_concurrent_users=10))
        print(f"[Seed] Created {len(DEFAULT_SERVICES)} default services with servers")
