import uuid
import json
from datetime import datetime
from sqlalchemy import (
    Column, String, DateTime, Text, Boolean, Integer, ForeignKey, UniqueConstraint
)
from sqlalchemy.orm import relationship
from database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=_uuid)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="user")  # admin | user
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    subscriptions = relationship("Subscription", back_populates="user")
    sessions_uploaded = relationship("Session", back_populates="uploaded_by_user")


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=False)
    plan = Column(String(50), nullable=False, default="premium")
    status = Column(String(20), nullable=False, default="active")
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="subscriptions")


class Service(Base):
    __tablename__ = "services"

    id = Column(String(36), primary_key=True, default=_uuid)
    slug = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    icon_url = Column(Text, nullable=True)
    target_url = Column(Text, nullable=False)
    cookie_domains = Column(Text, nullable=False, default="[]")  # JSON array
    encryption_key = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    servers = relationship("Server", back_populates="service", cascade="all, delete-orphan")

    def get_cookie_domains(self) -> list:
        try:
            return json.loads(self.cookie_domains or "[]")
        except json.JSONDecodeError:
            return []

    def set_cookie_domains(self, domains: list) -> None:
        self.cookie_domains = json.dumps(domains)


class Server(Base):
    __tablename__ = "servers"
    __table_args__ = (UniqueConstraint("service_id", "label", name="uq_service_label"),)

    id = Column(String(36), primary_key=True, default=_uuid)
    service_id = Column(String(36), ForeignKey("services.id"), nullable=False)
    label = Column(String(50), nullable=False)
    max_concurrent_users = Column(Integer, default=10)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    service = relationship("Service", back_populates="servers")
    sessions = relationship("Session", back_populates="server", cascade="all, delete-orphan")


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=_uuid)
    server_id = Column(String(36), ForeignKey("servers.id"), nullable=False)
    domain = Column(String(255), nullable=False)
    salt = Column(String(255), nullable=False)
    iv = Column(String(255), nullable=False)
    ciphertext = Column(Text, nullable=False)
    status = Column(String(20), nullable=False, default="active")
    health_score = Column(Integer, default=100)
    uploaded_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    last_validated_at = Column(DateTime, nullable=True)

    server = relationship("Server", back_populates="sessions")
    uploaded_by_user = relationship("User", back_populates="sessions_uploaded")


class SessionAccessLog(Base):
    __tablename__ = "session_access_logs"

    id = Column(String(36), primary_key=True, default=_uuid)
    user_id = Column(String(36), ForeignKey("users.id"), nullable=True)
    session_id = Column(String(36), ForeignKey("sessions.id"), nullable=True)
    action = Column(String(30), nullable=False)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class ActiveSession(Base):
    __tablename__ = "active_sessions"

    user_id = Column(String(36), ForeignKey("users.id"), primary_key=True)
    server_id = Column(String(36), ForeignKey("servers.id"), primary_key=True)
    acquired_at = Column(DateTime, default=datetime.utcnow)


# Legacy table kept for backward-compatible /api/v1/cookies/* routes
class EncryptedCookieBlob(Base):
    __tablename__ = "encrypted_cookies"

    id = Column(String(36), primary_key=True, default=_uuid)
    domain = Column(String(255), nullable=False)
    salt = Column(String(255), nullable=False)
    iv = Column(String(255), nullable=False)
    ciphertext = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
