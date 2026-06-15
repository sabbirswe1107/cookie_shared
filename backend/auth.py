from datetime import datetime, timedelta
from typing import Optional

import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

import models
from config import settings
from database import get_db

security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


def create_access_token(subject: str, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "role": role, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def create_refresh_token(subject: str) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": subject, "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email.strip().lower()).first()


def get_user_by_id(db: Session, user_id: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


def authenticate_user(db: Session, email: str, password: str) -> Optional[models.User]:
    email = email.strip().lower()
    import crud
    if crud.use_supabase():
        import supabase_client
        sb_user = supabase_client.supabase_sign_in(email, password)
        if sb_user:
            user = get_user_by_email(db, email)
            if not user:
                user = crud.create_user(db, email, hash_password(password), role="user")
            if not user.is_active:
                return None
            return user
        
        # Fallback to local db if Supabase login fails (for seeded users or legacy users)
        user = get_user_by_email(db, email)
        if not user or not verify_password(password, user.password_hash):
            return None
        if not user.is_active:
            return None
        return user
    else:
        user = get_user_by_email(db, email)
        if not user or not verify_password(password, user.password_hash):
            return None
        if not user.is_active:
            return None
        return user


def is_env_admin(email: str, password: str) -> bool:
    """Check if credentials match ADMIN_EMAIL / ADMIN_PASSWORD from .env."""
    admin_email = settings.ADMIN_EMAIL.strip().lower()
    return email.strip().lower() == admin_email and password == settings.ADMIN_PASSWORD


def authenticate_admin_from_env(db: Session, email: str, password: str) -> Optional[models.User]:
    """Authenticate admin using .env credentials; ensures DB admin record exists."""
    email = email.strip().lower()
    if not is_env_admin(email, password):
        return None
    user = get_user_by_email(db, email)
    if user:
        if user.role != "admin":
            user.role = "admin"
            user.is_active = True
            db.commit()
            db.refresh(user)
        return user
    import crud
    return crud.create_user(db, email, hash_password(settings.ADMIN_PASSWORD), role="admin")


def user_to_auth_info(user: models.User) -> dict:
    return {"id": user.id, "email": user.email, "role": user.role}


def build_token_response(user: models.User) -> dict:
    return {
        "access_token": create_access_token(user.id, user.role),
        "refresh_token": create_refresh_token(user.id),
        "token_type": "bearer",
        "user": user_to_auth_info(user),
    }


def _user_from_credentials(
    credentials: Optional[HTTPAuthorizationCredentials],
    db: Session,
) -> models.User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token type")
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")

    user = get_user_by_id(db, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db),
) -> models.User:
    return _user_from_credentials(credentials, db)


def get_current_admin(user: models.User = Depends(get_current_user)) -> models.User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def user_has_active_subscription(db: Session, user_id: str) -> bool:
    now = datetime.utcnow()
    sub = (
        db.query(models.Subscription)
        .filter(
            models.Subscription.user_id == user_id,
            models.Subscription.status == "active",
        )
        .first()
    )
    if not sub:
        return False
    if sub.expires_at and sub.expires_at < now:
        return False
    return True


def get_current_subscribed_user(
    user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> models.User:
    if user.role == "admin":
        return user
    if not user_has_active_subscription(db, user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Active subscription required",
        )
    return user
