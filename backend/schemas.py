from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


# ── Auth ──────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=128)


class AuthUserInfo(BaseModel):
    id: str
    email: str
    role: str

    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: AuthUserInfo


class UserResponse(BaseModel):
    id: str
    email: str
    role: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class RefreshRequest(BaseModel):
    refresh_token: str


# ── Services & Servers ────────────────────────────────────

class ServiceCreate(BaseModel):
    slug: str = Field(..., min_length=2, max_length=50)
    name: str = Field(..., min_length=2, max_length=100)
    target_url: str
    cookie_domains: List[str] = Field(default_factory=list)
    icon_url: Optional[str] = None
    encryption_key: Optional[str] = None


class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    target_url: Optional[str] = None
    cookie_domains: Optional[List[str]] = None
    icon_url: Optional[str] = None
    encryption_key: Optional[str] = None
    is_active: Optional[bool] = None


class ServerCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=50)
    max_concurrent_users: int = Field(10, ge=1, le=100)


class ServerUpdate(BaseModel):
    label: Optional[str] = None
    max_concurrent_users: Optional[int] = Field(None, ge=1, le=100)
    is_active: Optional[bool] = None


class ServerResponse(BaseModel):
    id: str
    service_id: str
    label: str
    max_concurrent_users: int
    is_active: bool
    active_users: int = 0
    has_active_session: bool = False
    session_status: Optional[str] = None

    class Config:
        from_attributes = True


class ServiceResponse(BaseModel):
    id: str
    slug: str
    name: str
    icon_url: Optional[str]
    target_url: str
    cookie_domains: List[str]
    encryption_key: Optional[str] = None
    is_active: bool
    servers: List[ServerResponse] = []

    class Config:
        from_attributes = True


class ServiceListItem(BaseModel):
    id: str
    slug: str
    name: str
    icon_url: Optional[str]
    target_url: str
    is_active: bool
    server_count: int = 0


# ── Sessions ──────────────────────────────────────────────

class SessionUploadRequest(BaseModel):
    service_id: str
    server_id: str
    domain: str
    salt: str
    iv: str
    ciphertext: str
    expiry_hours: int = Field(876000, description="Payload expiry time in hours (default 100 years)")


class SessionUploadResponse(BaseModel):
    id: str
    server_id: str
    domain: str
    expires_at: datetime
    status: str

    class Config:
        from_attributes = True


class SessionFetchResponse(BaseModel):
    domain: str
    target_url: str
    cookie_domains: List[str]
    salt: str
    iv: str
    ciphertext: str
    encryption_key: Optional[str] = None
    expires_at: datetime


class SessionListItem(BaseModel):
    id: str
    server_id: str
    domain: str
    status: str
    health_score: int
    created_at: datetime
    expires_at: datetime
    server_label: Optional[str] = None
    service_name: Optional[str] = None

    class Config:
        from_attributes = True


class SessionReportRequest(BaseModel):
    reason: Optional[str] = None


# ── Users (Admin) ─────────────────────────────────────────

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    role: str = Field("user", pattern="^(admin|user)$")


class SubscriptionCreate(BaseModel):
    plan: str = "premium"
    expires_at: Optional[datetime] = None


# ── Dashboard ─────────────────────────────────────────────

class DashboardStats(BaseModel):
    total_users: int
    active_subscriptions: int
    total_services: int
    active_sessions: int
    flagged_sessions: int


# ── Legacy cookie API (backward compatible) ───────────────

class CookieUploadRequest(BaseModel):
    domain: str = Field(..., description="Target site domain")
    salt: str = Field(..., description="Base64 encoded salt used for key derivation")
    iv: str = Field(..., description="Base64 encoded initialization vector")
    ciphertext: str = Field(..., description="Base64 encoded encrypted cookie payload")
    expiry_minutes: int = Field(52560000, description="Payload expiry time in minutes (default 100 years)")


class CookieUploadResponse(BaseModel):
    id: str
    domain: str
    expires_at: datetime

    class Config:
        from_attributes = True


class CookieRetrieveResponse(BaseModel):
    domain: str
    salt: str
    iv: str
    ciphertext: str
    expires_at: datetime

    class Config:
        from_attributes = True


class CookieMetadataResponse(BaseModel):
    id: str
    domain: str
    created_at: datetime
    expires_at: datetime

    class Config:
        from_attributes = True
