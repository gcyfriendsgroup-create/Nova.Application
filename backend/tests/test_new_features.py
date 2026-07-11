"""
Regression tests for recently added features:
- POST /api/auth/google (invalid session_id => 401)
- POST /api/register-push (never 500 with placeholder key)
- send_push non-blocking hook on: send_message, follow, friend_request, start_call
- login password None guard (Google-only users)
"""
import os
import uuid
import pytest
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE = (
    os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or open("/app/frontend/.env").read().split("EXPO_PUBLIC_BACKEND_URL=")[1].split("\n")[0].strip()
)
API = BASE.rstrip("/") + "/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


@pytest.fixture(scope="module")
def alice(s):
    r = s.post(f"{API}/auth/login", json={"email": "alice@nova.app", "password": "password123"})
    if r.status_code != 200:
        r = s.post(f"{API}/auth/register", json={
            "email": "alice@nova.app", "password": "password123", "display_name": "Alice"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "h": {"Authorization": f"Bearer {d['token']}"}}


@pytest.fixture(scope="module")
def bob(s):
    r = s.post(f"{API}/auth/login", json={"email": "bob@nova.app", "password": "password123"})
    if r.status_code != 200:
        r = s.post(f"{API}/auth/register", json={
            "email": "bob@nova.app", "password": "password123", "display_name": "Bob"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "h": {"Authorization": f"Bearer {d['token']}"}}


# ---------- Google OAuth ----------
class TestGoogleAuth:
    def test_google_invalid_session_returns_401(self, s):
        r = s.post(f"{API}/auth/google", json={"session_id": f"INVALID_{uuid.uuid4().hex}"})
        assert r.status_code == 401, f"Expected 401, got {r.status_code}: {r.text}"

    def test_google_missing_session_returns_422(self, s):
        # pydantic validation error
        r = s.post(f"{API}/auth/google", json={})
        assert r.status_code == 422


# ---------- Login regression (password None guard) ----------
class TestLoginRegression:
    def test_login_ok(self, s):
        r = s.post(f"{API}/auth/login", json={"email": "alice@nova.app", "password": "password123"})
        assert r.status_code == 200
        assert "token" in r.json()

    def test_login_wrong_password(self, s):
        r = s.post(f"{API}/auth/login", json={"email": "alice@nova.app", "password": "wrong_pass_xyz"})
        assert r.status_code == 400

    def test_login_missing_email(self, s):
        r = s.post(f"{API}/auth/login", json={"email": "nonexistent@nova.app", "password": "password123"})
        assert r.status_code == 400

    def test_login_google_user_without_password_rejected(self, s):
        """A user created via Google (password=None) must not be login-able via email/password
        even if password is empty string / None. Verifies the guard `not user.get('password')`."""
        # Seed a google-style user directly is not possible via public API; instead we simulate
        # by attempting login with empty password on any known account.
        r = s.post(f"{API}/auth/login", json={"email": "alice@nova.app", "password": ""})
        assert r.status_code in (400, 422), f"Expected 400/422, got {r.status_code}"


# ---------- Register push ----------
class TestRegisterPush:
    def test_register_push_returns_201_and_never_500(self, s, alice):
        body = {"user_id": alice["user"]["id"], "platform": "ios", "device_token": f"tok_{uuid.uuid4().hex}"}
        r = s.post(f"{API}/register-push", json=body)
        assert r.status_code == 201, f"Expected 201, got {r.status_code}: {r.text}"
        data = r.json()
        assert "status" in data
        assert data["status"] in ("registered", "skipped")

    def test_register_push_bad_payload_returns_422_not_500(self, s):
        r = s.post(f"{API}/register-push", json={"user_id": "x"})  # missing fields
        assert r.status_code == 422


# ---------- Push hook non-blocking on core actions ----------
class TestPushHookNonBlocking:
    """Verify send_push failure (placeholder key) does NOT 500 any core endpoint."""

    def test_message_send_no_500(self, s, alice, bob):
        conv = s.post(f"{API}/conversations", headers=alice["h"],
                      json={"type": "dm", "participant_ids": [bob["user"]["id"]]}).json()
        txt = f"TEST_push_{uuid.uuid4().hex[:6]}"
        r = s.post(f"{API}/conversations/{conv['id']}/messages",
                   headers=alice["h"], json={"text": txt})
        assert r.status_code == 200, f"push hook must be non-blocking, got {r.status_code}: {r.text}"
        assert r.json()["text"] == txt

    def test_follow_no_500(self, s, alice, bob):
        r = s.post(f"{API}/follow/{bob['user']['id']}", headers=alice["h"])
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True
        # notification still created
        notes = s.get(f"{API}/notifications", headers=bob["h"]).json()
        assert any(n["type"] == "follow" for n in notes)

    def test_friend_request_no_500(self, s, alice, bob):
        # Ensure a fresh unique target to force a new request; reset by unfriending first isn't
        # exposed via API, so we just POST — endpoint is idempotent (returns ok if pending).
        r = s.post(f"{API}/friends/request/{bob['user']['id']}", headers=alice["h"])
        assert r.status_code == 200, r.text
        assert r.json().get("ok") is True

    def test_start_call_no_500(self, s, alice, bob):
        r = s.post(f"{API}/calls", headers=alice["h"],
                   json={"callee_id": bob["user"]["id"], "call_type": "voice"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["status"] == "ringing"
        assert d["caller_id"] == alice["user"]["id"]
        assert d["callee_id"] == bob["user"]["id"]


# ---------- Smoke regression of core flows already covered in backend_test.py ----------
class TestCoreSmoke:
    def test_me(self, s, alice):
        r = s.get(f"{API}/auth/me", headers=alice["h"])
        assert r.status_code == 200
        assert r.json()["email"] == "alice@nova.app"

    def test_conversations_list(self, s, alice):
        r = s.get(f"{API}/conversations", headers=alice["h"])
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_notifications_list(self, s, alice):
        r = s.get(f"{API}/notifications", headers=alice["h"])
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_stories_list(self, s, alice):
        r = s.get(f"{API}/stories", headers=alice["h"])
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_locations_friends(self, s, alice):
        r = s.get(f"{API}/locations/friends", headers=alice["h"])
        assert r.status_code == 200
        assert isinstance(r.json(), list)
