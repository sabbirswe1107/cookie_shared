from datetime import datetime, timedelta
from typing import List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

import models
import schemas
from config import settings
import supabase_client


def use_supabase() -> bool:
    return bool(settings.SUPABASE_URL and settings.SUPABASE_KEY)


# ── Users ─────────────────────────────────────────────────

def create_user(db: Session, email: str, password_hash: str, role: str = "user") -> models.User:
    user = models.User(email=email.strip().lower(), password_hash=password_hash, role=role)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_users(db: Session) -> List[models.User]:
    return db.query(models.User).order_by(models.User.created_at.desc()).all()


def update_user_password(db: Session, user_id: str, new_password_hash: str) -> bool:
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        return False
    user.password_hash = new_password_hash
    db.commit()
    return True


def create_subscription(
    db: Session, user_id: str, plan: str = "premium", expires_at: Optional[datetime] = None
) -> models.Subscription:
    sub = models.Subscription(user_id=user_id, plan=plan, expires_at=expires_at)
    db.add(sub)
    db.commit()
    db.refresh(sub)
    return sub


def count_active_subscriptions(db: Session) -> int:
    now = datetime.utcnow()
    return (
        db.query(models.Subscription)
        .filter(
            models.Subscription.status == "active",
            (models.Subscription.expires_at.is_(None)) | (models.Subscription.expires_at > now),
        )
        .count()
    )


# ── Services ──────────────────────────────────────────────

def create_service(db: Session, data: schemas.ServiceCreate) -> models.Service:
    svc = models.Service(
        slug=data.slug,
        name=data.name,
        target_url=data.target_url,
        icon_url=data.icon_url,
        encryption_key=data.encryption_key,
    )
    svc.set_cookie_domains(data.cookie_domains)
    db.add(svc)
    db.commit()
    db.refresh(svc)
    return svc


def list_services(db: Session, active_only: bool = False) -> List[models.Service]:
    q = db.query(models.Service)
    if active_only:
        q = q.filter(models.Service.is_active.is_(True))
    return q.order_by(models.Service.name).all()


def get_service(db: Session, service_id: str) -> Optional[models.Service]:
    return db.query(models.Service).filter(models.Service.id == service_id).first()


def get_service_by_slug(db: Session, slug: str) -> Optional[models.Service]:
    return db.query(models.Service).filter(models.Service.slug == slug).first()


def update_service(db: Session, service: models.Service, data: schemas.ServiceUpdate) -> models.Service:
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "cookie_domains" and value is not None:
            service.set_cookie_domains(value)
        elif value is not None:
            setattr(service, field, value)
    db.commit()
    db.refresh(service)
    return service


def delete_service(db: Session, service_id: str) -> bool:
    svc = get_service(db, service_id)
    if not svc:
        return False
    db.delete(svc)
    db.commit()
    return True


# ── Servers ───────────────────────────────────────────────

def create_server(db: Session, service_id: str, data: schemas.ServerCreate) -> models.Server:
    server = models.Server(
        service_id=service_id,
        label=data.label,
        max_concurrent_users=data.max_concurrent_users,
    )
    db.add(server)
    db.commit()
    db.refresh(server)
    return server


def get_server(db: Session, server_id: str) -> Optional[models.Server]:
    return db.query(models.Server).filter(models.Server.id == server_id).first()


def get_server_for_service(db: Session, service_id: str, server_id: str) -> Optional[models.Server]:
    return (
        db.query(models.Server)
        .filter(models.Server.id == server_id, models.Server.service_id == service_id)
        .first()
    )


def update_server(db: Session, server: models.Server, data: schemas.ServerUpdate) -> models.Server:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(server, field, value)
    db.commit()
    db.refresh(server)
    return server


def count_active_users_on_server(db: Session, server_id: str) -> int:
    return db.query(models.ActiveSession).filter(models.ActiveSession.server_id == server_id).count()


def get_active_session_for_server(db: Session, server_id: str) -> Optional[models.Session]:
    now = datetime.utcnow()
    return (
        db.query(models.Session)
        .filter(
            models.Session.server_id == server_id,
            models.Session.status == "active",
            models.Session.expires_at > now,
        )
        .order_by(models.Session.created_at.desc())
        .first()
    )


# ── Platform Sessions ─────────────────────────────────────

def create_platform_session(
    db: Session,
    request: schemas.SessionUploadRequest,
    uploaded_by: Optional[str] = None,
) -> models.Session:
    expires_at = datetime.utcnow() + timedelta(hours=request.expiry_hours)

    # Revoke previous active sessions for this server
    db.query(models.Session).filter(
        models.Session.server_id == request.server_id,
        models.Session.status == "active",
    ).update({"status": "revoked"})

    session = models.Session(
        server_id=request.server_id,
        domain=request.domain,
        salt=request.salt,
        iv=request.iv,
        ciphertext=request.ciphertext,
        status="active",
        uploaded_by=uploaded_by,
        expires_at=expires_at,
        last_validated_at=datetime.utcnow(),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_session_by_service_server(
    db: Session, service_id: str, server_id: str
) -> Optional[models.Session]:
    server = get_server_for_service(db, service_id, server_id)
    if not server or not server.is_active:
        return None
    return get_active_session_for_server(db, server_id)


def list_sessions(db: Session, status: Optional[str] = None) -> List[models.Session]:
    q = db.query(models.Session)
    if status:
        q = q.filter(models.Session.status == status)
    return q.order_by(models.Session.created_at.desc()).all()


def revoke_session(db: Session, session_id: str) -> bool:
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        return False
    session.status = "revoked"
    db.commit()
    return True


def report_session_invalid(db: Session, session_id: str) -> Optional[models.Session]:
    session = db.query(models.Session).filter(models.Session.id == session_id).first()
    if not session:
        return None
    session.health_score = max(0, session.health_score - 25)
    if session.health_score < 30:
        session.status = "flagged"
    db.commit()
    db.refresh(session)
    return session


def acquire_server_slot(db: Session, user_id: str, server_id: str, max_users: int) -> bool:
    count = count_active_users_on_server(db, server_id)
    if count >= max_users:
        return False
    existing = (
        db.query(models.ActiveSession)
        .filter(models.ActiveSession.user_id == user_id, models.ActiveSession.server_id == server_id)
        .first()
    )
    if not existing:
        db.add(models.ActiveSession(user_id=user_id, server_id=server_id))
        db.commit()
    return True


def release_server_slot(db: Session, user_id: str, server_id: Optional[str] = None) -> int:
    q = db.query(models.ActiveSession).filter(models.ActiveSession.user_id == user_id)
    if server_id:
        q = q.filter(models.ActiveSession.server_id == server_id)
    count = q.count()
    q.delete(synchronize_session=False)
    db.commit()
    return count


def log_access(
    db: Session,
    user_id: Optional[str],
    session_id: Optional[str],
    action: str,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    log = models.SessionAccessLog(
        user_id=user_id,
        session_id=session_id,
        action=action,
        ip_address=ip_address,
        user_agent=user_agent,
    )
    db.add(log)
    db.commit()


def delete_expired_sessions(db: Session) -> int:
    now = datetime.utcnow()
    expired = (
        db.query(models.Session)
        .filter(models.Session.expires_at < now, models.Session.status.in_(["active", "flagged"]))
        .all()
    )
    count = len(expired)
    for s in expired:
        s.status = "expired"
    db.commit()
    # Hard delete very old expired/revoked sessions (>7 days)
    cutoff = now - timedelta(days=7)
    deleted = (
        db.query(models.Session)
        .filter(
            models.Session.status.in_(["expired", "revoked"]),
            models.Session.created_at < cutoff,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return count + deleted


def get_dashboard_stats(db: Session) -> schemas.DashboardStats:
    return schemas.DashboardStats(
        total_users=db.query(models.User).count(),
        active_subscriptions=count_active_subscriptions(db),
        total_services=db.query(models.Service).filter(models.Service.is_active.is_(True)).count(),
        active_sessions=db.query(models.Session).filter(models.Session.status == "active").count(),
        flagged_sessions=db.query(models.Session).filter(models.Session.status == "flagged").count(),
    )


# ── Legacy encrypted cookie blobs ─────────────────────────

def create_cookie_blob(db: Session, request: schemas.CookieUploadRequest):
    expires_at = datetime.utcnow() + timedelta(minutes=request.expiry_minutes)

    if use_supabase():
        payload = {
            "domain": request.domain,
            "salt": request.salt,
            "iv": request.iv,
            "ciphertext": request.ciphertext,
            "expires_at": expires_at,
        }
        return supabase_client.supabase_create_cookie_blob(payload)

    db_obj = models.EncryptedCookieBlob(
        domain=request.domain,
        salt=request.salt,
        iv=request.iv,
        ciphertext=request.ciphertext,
        expires_at=expires_at,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


def get_cookie_blob(db: Session, blob_id: str):
    if use_supabase():
        return supabase_client.supabase_get_cookie_blob(blob_id)

    db_obj = db.query(models.EncryptedCookieBlob).filter(models.EncryptedCookieBlob.id == blob_id).first()
    if not db_obj:
        return None
    if db_obj.expires_at < datetime.utcnow():
        db.delete(db_obj)
        db.commit()
        return None
    return db_obj


def get_cookie_blob_metadata(db: Session, blob_id: str):
    return get_cookie_blob(db, blob_id)


def delete_cookie_blob(db: Session, blob_id: str) -> bool:
    if use_supabase():
        return supabase_client.supabase_delete_cookie_blob(blob_id)

    db_obj = db.query(models.EncryptedCookieBlob).filter(models.EncryptedCookieBlob.id == blob_id).first()
    if not db_obj:
        return False
    db.delete(db_obj)
    db.commit()
    return True


def delete_expired_cookie_blobs(db: Session) -> int:
    if use_supabase():
        return supabase_client.supabase_delete_expired_cookie_blobs()

    now = datetime.utcnow()
    deleted_count = (
        db.query(models.EncryptedCookieBlob)
        .filter(models.EncryptedCookieBlob.expires_at < now)
        .delete(synchronize_session=False)
    )
    db.commit()
    return deleted_count
