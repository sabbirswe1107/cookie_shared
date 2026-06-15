import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ["DATABASE_URL"] = "sqlite:///./test_cookie_share.db"
os.environ["JWT_SECRET"] = "test-secret-key-for-unit-tests"
os.environ["SUPABASE_URL"] = ""
os.environ["SUPABASE_KEY"] = ""
os.environ["ADMIN_EMAIL"] = "admin@example.com"
os.environ["ADMIN_PASSWORD"] = "admin123"
os.environ["USER_EMAIL"] = "user@example.com"
os.environ["USER_PASSWORD"] = "user123"
os.environ["SEED_DEMO_USER"] = "true"

import unittest
from fastapi.testclient import TestClient
from main import app
from database import engine, Base, SessionLocal
from seed import seed_database


class TestCookieSharePlatform(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
        db = SessionLocal()
        try:
            seed_database(db)
        finally:
            db.close()
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        Base.metadata.drop_all(bind=engine)
        if os.path.exists("./test_cookie_share.db"):
            os.remove("./test_cookie_share.db")

    def _admin_token(self):
        res = self.client.post("/api/v1/auth/admin/login", json={
            "email": "admin@example.com",
            "password": "admin123",
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["user"]["role"], "admin")
        return data["access_token"]

    def _user_token(self):
        res = self.client.post("/api/v1/auth/login", json={
            "email": "user@example.com",
            "password": "user123",
        })
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["user"]["role"], "user")
        return data["access_token"]

    def test_health_check(self):
        res = self.client.get("/health")
        self.assertEqual(res.status_code, 200)

    def test_admin_login_from_env(self):
        res = self.client.post("/api/v1/auth/admin/login", json={
            "email": "admin@example.com",
            "password": "admin123",
        })
        self.assertEqual(res.status_code, 200)
        self.assertIn("access_token", res.json())
        self.assertEqual(res.json()["user"]["email"], "admin@example.com")

    def test_user_register_and_login(self):
        res = self.client.post("/api/v1/auth/register", json={
            "email": "newuser@example.com",
            "password": "secret12",
        })
        self.assertEqual(res.status_code, 201)
        self.assertEqual(res.json()["user"]["role"], "user")

        res2 = self.client.post("/api/v1/auth/login", json={
            "email": "newuser@example.com",
            "password": "secret12",
        })
        self.assertEqual(res2.status_code, 200)

    def test_admin_list_services(self):
        token = self._admin_token()
        res = self.client.get("/api/v1/admin/services", headers={
            "Authorization": f"Bearer {token}",
        })
        self.assertEqual(res.status_code, 200)
        self.assertGreater(len(res.json()), 0)

    def test_user_list_services(self):
        token = self._user_token()
        res = self.client.get("/api/v1/user/services", headers={
            "Authorization": f"Bearer {token}",
        })
        self.assertEqual(res.status_code, 200)

    def test_admin_upload_and_user_fetch_session(self):
        admin_token = self._admin_token()
        svc_res = self.client.get("/api/v1/admin/services", headers={
            "Authorization": f"Bearer {admin_token}",
        })
        service = svc_res.json()[0]
        server = service["servers"][0]

        upload_res = self.client.post("/api/v1/admin/upload-session", json={
            "service_id": service["id"],
            "server_id": server["id"],
            "domain": "example.com",
            "salt": "dGVzdF9zYWx0",
            "iv": "dGVzdF9pdg==",
            "ciphertext": "dGVzdF9jaXBoZXJ0ZXh0",
            "expiry_hours": 24,
        }, headers={"Authorization": f"Bearer {admin_token}"})
        self.assertEqual(upload_res.status_code, 201)

        user_token = self._user_token()
        fetch_res = self.client.get(
            f"/api/v1/user/session/{service['id']}/{server['id']}",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        self.assertEqual(fetch_res.status_code, 200)

    def test_legacy_upload_and_fetch(self):
        payload = {
            "domain": "example.com",
            "salt": "dGVzdF9zYWx0",
            "iv": "dGVzdF9pdg==",
            "ciphertext": "dGVzdF9jaXBoZXJ0ZXh0",
            "expiry_minutes": 10,
        }
        res = self.client.post("/api/v1/cookies/upload", json=payload)
        self.assertEqual(res.status_code, 201)
        share_id = res.json()["id"]
        fetch = self.client.get(f"/api/v1/cookies/fetch/{share_id}")
        self.assertEqual(fetch.status_code, 200)


if __name__ == "__main__":
    unittest.main()
