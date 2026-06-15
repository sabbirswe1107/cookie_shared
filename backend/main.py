import asyncio
import json
from contextlib import asynccontextmanager
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import os

import auth
import crud
import models
import schemas
from database import engine, SessionLocal, get_db
from config import settings
from seed import seed_database


async def expired_records_cleanup_worker():
    print("[Worker] Started session expiration cleanup worker.")
    while True:
        try:
            await asyncio.sleep(300)
            db = SessionLocal()
            try:
                legacy = crud.delete_expired_cookie_blobs(db)
                platform = crud.delete_expired_sessions(db)
                if legacy or platform:
                    print(f"[Worker] Cleaned up {legacy} legacy blobs, {platform} platform sessions.")
            finally:
                db.close()
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"[Worker] Cleanup error: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("[System] Initializing database tables...")
    try:
        models.Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_database(db)
        finally:
            db.close()
        print("[System] Database initialization complete.")
    except Exception as e:
        print(f"[System] Database connection failed: {e}")

    cleanup_task = asyncio.create_task(expired_records_cleanup_worker())
    yield
    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="Secure Cookie Sharing Platform API",
    version="2.0.0",
    description="Multi-service session provider with client-side encrypted cookie sharing",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=".*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



def _service_to_response(db: Session, svc: models.Service, include_servers: bool = True) -> schemas.ServiceResponse:
    servers = []
    if include_servers:
        for s in svc.servers:
            active = crud.get_active_session_for_server(db, s.id)
            servers.append(
                schemas.ServerResponse(
                    id=s.id,
                    service_id=s.service_id,
                    label=s.label,
                    max_concurrent_users=s.max_concurrent_users,
                    is_active=s.is_active,
                    active_users=crud.count_active_users_on_server(db, s.id),
                    has_active_session=active is not None,
                    session_status=active.status if active else None,
                )
            )
    return schemas.ServiceResponse(
        id=svc.id,
        slug=svc.slug,
        name=svc.name,
        icon_url=svc.icon_url,
        target_url=svc.target_url,
        cookie_domains=svc.get_cookie_domains(),
        encryption_key=svc.encryption_key,
        is_active=svc.is_active,
        servers=servers,
    )



# ── Auth ──────────────────────────────────────────────────

@app.post("/api/v1/auth/login", response_model=schemas.TokenResponse)
def login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()
    user = auth.authenticate_user(db, email, payload.password)
    if not user and auth.is_env_admin(email, payload.password):
        user = auth.authenticate_admin_from_env(db, email, payload.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    return auth.build_token_response(user)


@app.post("/api/v1/auth/register")
def register():
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN, 
        detail="Public registration is disabled. Please contact the administrator."
    )


@app.post("/api/v1/auth/admin/login", response_model=schemas.TokenResponse)
def admin_login(payload: schemas.LoginRequest, db: Session = Depends(get_db)):
    """Admin-only login — validates against .env ADMIN_EMAIL / ADMIN_PASSWORD."""
    email = payload.email.strip().lower()
    user = auth.authenticate_admin_from_env(db, email, payload.password)
    if not user:
        user = auth.authenticate_user(db, email, payload.password)
        if not user or user.role != "admin":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid admin credentials")
    return auth.build_token_response(user)


@app.post("/api/v1/auth/refresh", response_model=schemas.TokenResponse)
def refresh_token(payload: schemas.RefreshRequest, db: Session = Depends(get_db)):
    try:
        data = auth.decode_token(payload.refresh_token)
        if data.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid refresh token")
        user = auth.get_user_by_id(db, data["sub"])
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found")
        return auth.build_token_response(user)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")


@app.get("/api/v1/auth/me", response_model=schemas.UserResponse)
def get_me(user: models.User = Depends(auth.get_current_user)):
    return user


# ── Admin: Dashboard ──────────────────────────────────────

@app.get("/api/v1/admin/dashboard", response_model=schemas.DashboardStats)
def admin_dashboard(
    admin: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    return crud.get_dashboard_stats(db)


# ── Admin: Services ───────────────────────────────────────

@app.get("/api/v1/admin/services", response_model=List[schemas.ServiceResponse])
def admin_list_services(
    admin: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    services = crud.list_services(db)
    return [_service_to_response(db, s) for s in services]


@app.post("/api/v1/admin/services", response_model=schemas.ServiceResponse, status_code=201)
def admin_create_service(
    payload: schemas.ServiceCreate,
    admin: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    if crud.get_service_by_slug(db, payload.slug):
        raise HTTPException(status_code=400, detail="Service slug already exists")
    svc = crud.create_service(db, payload)
    return _service_to_response(db, svc, include_servers=False)


@app.put("/api/v1/admin/services/{service_id}", response_model=schemas.ServiceResponse)
def admin_update_service(
    service_id: str,
    payload: schemas.ServiceUpdate,
    admin: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    svc = crud.get_service(db, service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    svc = crud.update_service(db, svc, payload)
    return _service_to_response(db, svc)


@app.delete("/api/v1/admin/services/{service_id}", status_code=200)
def admin_delete_service(
    service_id: str,
    admin: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    if not crud.delete_service(db, service_id):
        raise HTTPException(status_code=404, detail="Service not found")
    return {"message": "Service deleted"}


@app.post("/api/v1/admin/services/{service_id}/servers", response_model=schemas.ServerResponse, status_code=201)
def admin_create_server(
    service_id: str,
    payload: schemas.ServerCreate,
    admin: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    if not crud.get_service(db, service_id):
        raise HTTPException(status_code=404, detail="Service not found")
    server = crud.create_server(db, service_id, payload)
    return schemas.ServerResponse(
        id=server.id,
        service_id=server.service_id,
        label=server.label,
        max_concurrent_users=server.max_concurrent_users,
        is_active=server.is_active,
        active_users=0,
        has_active_session=False,
    )


@app.put("/api/v1/admin/servers/{server_id}", response_model=schemas.ServerResponse)
def admin_update_server(
    server_id: str,
    payload: schemas.ServerUpdate,
    admin: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    server = crud.get_server(db, server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    server = crud.update_server(db, server, payload)
    active = crud.get_active_session_for_server(db, server.id)
    return schemas.ServerResponse(
        id=server.id,
        service_id=server.service_id,
        label=server.label,
        max_concurrent_users=server.max_concurrent_users,
        is_active=server.is_active,
        active_users=crud.count_active_users_on_server(db, server.id),
        has_active_session=active is not None,
        session_status=active.status if active else None,
    )


# ── Admin: Sessions ───────────────────────────────────────

@app.post(
    "/api/v1/admin/upload-session",
    response_model=schemas.SessionUploadResponse,
    status_code=201,
)
def admin_upload_session(
    payload: schemas.SessionUploadRequest,
    request: Request,
    admin: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    server = crud.get_server_for_service(db, payload.service_id, payload.server_id)
    if not server:
        raise HTTPException(status_code=404, detail="Server not found for this service")
    session = crud.create_platform_session(db, payload, uploaded_by=admin.id)
    crud.log_access(db, admin.id, session.id, "upload", request.client.host if request.client else None)
    return session


@app.get("/api/v1/admin/sessions", response_model=List[schemas.SessionListItem])
def admin_list_sessions(
    status_filter: Optional[str] = None,
    admin: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    sessions = crud.list_sessions(db, status=status_filter)
    result = []
    for s in sessions:
        server = crud.get_server(db, s.server_id)
        svc = crud.get_service(db, server.service_id) if server else None
        result.append(
            schemas.SessionListItem(
                id=s.id,
                server_id=s.server_id,
                domain=s.domain,
                status=s.status,
                health_score=s.health_score,
                created_at=s.created_at,
                expires_at=s.expires_at,
                server_label=server.label if server else None,
                service_name=svc.name if svc else None,
            )
        )
    return result


@app.put("/api/v1/admin/sessions/{session_id}/revoke", status_code=200)
def admin_revoke_session(
    session_id: str,
    admin: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    if not crud.revoke_session(db, session_id):
        raise HTTPException(status_code=404, detail="Session not found")
    return {"message": "Session revoked", "id": session_id}


# ── Admin: Users ──────────────────────────────────────────

@app.get("/api/v1/admin/users", response_model=List[schemas.UserResponse])
def admin_list_users(
    admin: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    return crud.list_users(db)


@app.post("/api/v1/admin/users", response_model=schemas.UserResponse, status_code=201)
def admin_create_user(
    payload: schemas.UserCreate,
    admin: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    if auth.get_user_by_email(db, payload.email):
        raise HTTPException(status_code=400, detail="Email already registered")
        
    if crud.use_supabase():
        import supabase_client
        sb_user = supabase_client.supabase_sign_up(payload.email, payload.password)
        if not sb_user:
            raise HTTPException(status_code=500, detail="Failed to create user in Supabase Auth. Email might be invalid or already taken in Auth.")

    user = crud.create_user(db, payload.email, auth.hash_password(payload.password), payload.role)
    return user


@app.post("/api/v1/admin/users/{user_id}/subscription", status_code=201)
def admin_grant_subscription(
    user_id: str,
    payload: schemas.SubscriptionCreate,
    admin: models.User = Depends(auth.get_current_admin),
    db: Session = Depends(get_db),
):
    if not auth.get_user_by_id(db, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    sub = crud.create_subscription(db, user_id, payload.plan, payload.expires_at)
    return {"message": "Subscription granted", "id": sub.id}


# ── User: Services & Sessions ─────────────────────────────

@app.get("/api/v1/user/services", response_model=List[schemas.ServiceResponse])
def user_list_services(
    user: models.User = Depends(auth.get_current_subscribed_user),
    db: Session = Depends(get_db),
):
    services = crud.list_services(db, active_only=True)
    return [_service_to_response(db, s) for s in services]


@app.get("/api/v1/user/session/{service_id}/{server_id}", response_model=schemas.SessionFetchResponse)
def user_fetch_session(
    service_id: str,
    server_id: str,
    request: Request,
    user: models.User = Depends(auth.get_current_subscribed_user),
    db: Session = Depends(get_db),
):
    svc = crud.get_service(db, service_id)
    if not svc or not svc.is_active:
        raise HTTPException(status_code=404, detail="Service not found")

    server = crud.get_server_for_service(db, service_id, server_id)
    if not server or not server.is_active:
        raise HTTPException(status_code=404, detail="Server not found")

    session = crud.get_active_session_for_server(db, server_id)
    if not session:
        raise HTTPException(status_code=404, detail="No active session available for this server")

    if not crud.acquire_server_slot(db, user.id, server_id, server.max_concurrent_users):
        raise HTTPException(status_code=429, detail="Server at capacity. Try another server.")

    crud.log_access(
        db,
        user.id,
        session.id,
        "fetch",
        request.client.host if request.client else None,
        request.headers.get("user-agent"),
    )

    return schemas.SessionFetchResponse(
        domain=session.domain,
        target_url=svc.target_url,
        cookie_domains=svc.get_cookie_domains(),
        salt=session.salt,
        iv=session.iv,
        ciphertext=session.ciphertext,
        encryption_key=svc.encryption_key,
        expires_at=session.expires_at,
    )


@app.post("/api/v1/user/session/{service_id}/{server_id}/report", status_code=200)
def user_report_session(
    service_id: str,
    server_id: str,
    payload: schemas.SessionReportRequest,
    user: models.User = Depends(auth.get_current_subscribed_user),
    db: Session = Depends(get_db),
):
    session = crud.get_session_by_service_server(db, service_id, server_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    updated = crud.report_session_invalid(db, session.id)
    crud.log_access(db, user.id, session.id, "report_invalid")
    return {"message": "Report submitted", "health_score": updated.health_score if updated else 0}


@app.post("/api/v1/user/session/release", status_code=200)
def user_release_session(
    server_id: Optional[str] = None,
    user: models.User = Depends(auth.get_current_subscribed_user),
    db: Session = Depends(get_db),
):
    count = crud.release_server_slot(db, user.id, server_id)
    return {"message": "Session slot released", "released": count}


# ── Legacy Cookie API (backward compatible) ───────────────

@app.post(
    "/api/v1/cookies/upload",
    response_model=schemas.CookieUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_cookies(payload: schemas.CookieUploadRequest, db: Session = Depends(get_db)):
    try:
        return crud.create_cookie_blob(db, payload)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to store cookie payload: {str(e)}")


@app.get("/api/v1/cookies/fetch/{blob_id}", response_model=schemas.CookieRetrieveResponse)
def fetch_cookies(blob_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_cookie_blob(db, blob_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Encrypted cookie session not found or has expired.")
    return db_obj


@app.get("/api/v1/cookies/metadata/{blob_id}", response_model=schemas.CookieMetadataResponse)
def get_cookie_metadata(blob_id: str, db: Session = Depends(get_db)):
    db_obj = crud.get_cookie_blob_metadata(db, blob_id)
    if not db_obj:
        raise HTTPException(status_code=404, detail="Session not found or has expired.")
    return db_obj


@app.delete("/api/v1/cookies/revoke/{blob_id}", status_code=200)
def revoke_cookie_session(blob_id: str, db: Session = Depends(get_db)):
    if not crud.delete_cookie_blob(db, blob_id):
        raise HTTPException(status_code=404, detail="Session not found.")
    return {"message": "Session successfully revoked.", "id": blob_id}


@app.get("/health", status_code=200)
def health_check():
    return {"status": "healthy", "version": "2.0.0"}
