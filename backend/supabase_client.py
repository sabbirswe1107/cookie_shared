import os
import uuid
from datetime import datetime, timezone
from supabase import create_client, Client
from config import settings

# Initialize Supabase client
_client = None

def get_supabase_client() -> Client:
    global _client
    if _client is not None:
        return _client
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        raise RuntimeError("Supabase URL and KEY must be set in environment variables")
    _client = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
    return _client

# Table name for storing encrypted cookie blobs
TABLE_NAME = "encrypted_cookies"

def supabase_sign_up(email: str, password: str):
    client = get_supabase_client()
    try:
        response = client.auth.sign_up({"email": email, "password": password})
        return response.user
    except Exception as e:
        print(f"Supabase signup failed: {e}")
        return None

def supabase_sign_in(email: str, password: str):
    client = get_supabase_client()
    try:
        response = client.auth.sign_in_with_password({"email": email, "password": password})
        return response.user
    except Exception as e:
        print(f"Supabase login failed: {e}")
        return None

def supabase_create_cookie_blob(blob: dict) -> dict:
    """Insert a new cookie blob into Supabase.
    Expected keys in blob: id, domain, salt, iv, ciphertext, expires_at (datetime).
    """
    client = get_supabase_client()
    
    # Generate UUID if not provided
    if "id" not in blob:
        blob["id"] = str(uuid.uuid4())
        
    # Ensure expires_at is ISO string
    if isinstance(blob.get("expires_at"), datetime):
        blob["expires_at"] = blob["expires_at"].replace(tzinfo=timezone.utc).isoformat()
        
    # We must also provide a dummy/empty revocation_key if the DB table has it as NOT NULL
    if "revocation_key" not in blob:
        blob["revocation_key"] = "default"

    try:
        response = client.table(TABLE_NAME).insert(blob).execute()
        # In supabase-py v2, execute() returns APIResponse.
        # If there's an API error, it raises an exception instead of returning response.error.
        if hasattr(response, "data") and len(response.data) > 0:
            return response.data[0]
        raise RuntimeError("No data returned from Supabase insert")
    except Exception as e:
        raise RuntimeError(f"Supabase insert failed: {str(e)}")

def supabase_get_cookie_blob(blob_id: str) -> dict | None:
    client = get_supabase_client()
    try:
        response = client.table(TABLE_NAME).select("*").eq("id", blob_id).execute()
        if hasattr(response, "data") and len(response.data) > 0:
            row = response.data[0]
            # Ensure expires_at matches the timezone-aware comparison
            expires_at_str = row.get("expires_at")
            if expires_at_str:
                # Convert ISO timestamp string back to datetime object
                # SQLite datetimes might have been text, PostgreSQL has timezone offset (e.g. 2026-06-13T09:47:00+00:00)
                # Let's parse it safely
                try:
                    # Remove timezone offset if present for naive comparison or parse appropriately
                    # Python 3.11+ datetime.fromisoformat supports timezone offsets
                    expires_at = datetime.fromisoformat(expires_at_str.replace("Z", "+00:00"))
                    
                    # If expired, delete immediately
                    now = datetime.now(timezone.utc)
                    if expires_at < now:
                        supabase_delete_cookie_blob(blob_id)
                        return None
                except Exception as parse_err:
                    print(f"Error parsing expires_at: {parse_err}")
            return row
        return None
    except Exception as e:
        print(f"Supabase fetch failed for {blob_id}: {e}")
        return None

def supabase_delete_cookie_blob(blob_id: str) -> bool:
    client = get_supabase_client()
    try:
        response = client.table(TABLE_NAME).delete().eq("id", blob_id).execute()
        return hasattr(response, "data") and len(response.data) > 0
    except Exception as e:
        print(f"Supabase delete failed for {blob_id}: {e}")
        return False

def supabase_delete_expired_cookie_blobs() -> int:
    client = get_supabase_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    try:
        response = client.table(TABLE_NAME).delete().lt("expires_at", now_iso).execute()
        if hasattr(response, "data"):
            return len(response.data)
        return 0
    except Exception as e:
        raise RuntimeError(f"Supabase delete expired failed: {str(e)}")
