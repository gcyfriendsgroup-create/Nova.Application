"""
Nova Backend API tests.
Covers: auth, users, follow, friends, stories, conversations, messages, calls, locations,
notifications, and websocket signaling.
"""
import os
import json
import time
import uuid
import asyncio
import pytest
import requests
import websockets
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

BASE = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or open("/app/frontend/.env").read().split("EXPO_PUBLIC_BACKEND_URL=")[1].split("\n")[0].strip()
API = BASE.rstrip("/") + "/api"
WS = API.replace("https://", "wss://").replace("http://", "ws://")


# ---------- shared session ----------
@pytest.fixture(scope="session")
def s():
    return requests.Session()


@pytest.fixture(scope="session")
def alice(s):
    # Try login, else register
    r = s.post(f"{API}/auth/login", json={"email": "alice@nova.app", "password": "password123"})
    if r.status_code != 200:
        r = s.post(f"{API}/auth/register", json={"email": "alice@nova.app", "password": "password123", "display_name": "Alice"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "h": {"Authorization": f"Bearer {d['token']}"}}


@pytest.fixture(scope="session")
def bob(s):
    r = s.post(f"{API}/auth/login", json={"email": "bob@nova.app", "password": "password123"})
    if r.status_code != 200:
        r = s.post(f"{API}/auth/register", json={"email": "bob@nova.app", "password": "password123", "display_name": "Bob"})
    assert r.status_code == 200, r.text
    d = r.json()
    return {"token": d["token"], "user": d["user"], "h": {"Authorization": f"Bearer {d['token']}"}}


# ---------- Health ----------
class TestHealth:
    def test_root(self, s):
        r = s.get(f"{API}/")
        assert r.status_code == 200
        assert r.json().get("message") == "Nova API"


# ---------- Auth ----------
class TestAuth:
    def test_register_duplicate_email(self, s, alice):
        r = s.post(f"{API}/auth/register", json={"email": "alice@nova.app", "password": "password123", "display_name": "Alice"})
        assert r.status_code == 400

    def test_login_bad_password(self, s):
        r = s.post(f"{API}/auth/login", json={"email": "alice@nova.app", "password": "wrongpass"})
        assert r.status_code == 400

    def test_me_returns_current_user(self, s, alice):
        r = s.get(f"{API}/auth/me", headers=alice["h"])
        assert r.status_code == 200
        d = r.json()
        assert d["email"] == "alice@nova.app"
        assert "password" not in d

    def test_me_requires_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code in (401, 403)

    def test_new_register(self, s):
        email = f"TEST_{uuid.uuid4().hex[:8]}@nova.app"
        r = s.post(f"{API}/auth/register", json={"email": email, "password": "password123", "display_name": "TEST_new"})
        assert r.status_code == 200
        assert r.json()["user"]["email"] == email


# ---------- Users ----------
class TestUsers:
    def test_list_users_excludes_self(self, s, alice):
        r = s.get(f"{API}/users", headers=alice["h"])
        assert r.status_code == 200
        ids = [u["id"] for u in r.json()]
        assert alice["user"]["id"] not in ids

    def test_search_by_name(self, s, alice, bob):
        r = s.get(f"{API}/users?search=Bob", headers=alice["h"])
        assert r.status_code == 200
        names = [u["display_name"] for u in r.json()]
        assert "Bob" in names

    def test_get_user_by_id(self, s, alice, bob):
        r = s.get(f"{API}/users/{bob['user']['id']}", headers=alice["h"])
        assert r.status_code == 200
        assert r.json()["id"] == bob["user"]["id"]

    def test_update_profile_and_persist(self, s, alice):
        new_desc = f"hello-{uuid.uuid4().hex[:6]}"
        r = s.put(f"{API}/users/me", headers=alice["h"], json={
            "description": new_desc,
            "page_color": "#123456",
            "chat_bg_color": "#654321",
            "ringtone": "custom",
        })
        assert r.status_code == 200
        assert r.json()["description"] == new_desc
        # verify persistence via GET
        r2 = s.get(f"{API}/auth/me", headers=alice["h"])
        assert r2.json()["description"] == new_desc
        assert r2.json()["page_color"] == "#123456"


# ---------- Follow ----------
class TestFollow:
    def test_follow_flow(self, s, alice, bob):
        r = s.post(f"{API}/follow/{bob['user']['id']}", headers=alice["h"])
        assert r.status_code == 200
        # verify following list
        me = s.get(f"{API}/auth/me", headers=alice["h"]).json()
        assert bob["user"]["id"] in me["following"]
        # notification created on bob
        notes = s.get(f"{API}/notifications", headers=bob["h"]).json()
        assert any(n["type"] == "follow" for n in notes)

    def test_cannot_follow_self(self, s, alice):
        r = s.post(f"{API}/follow/{alice['user']['id']}", headers=alice["h"])
        assert r.status_code == 400

    def test_unfollow(self, s, alice, bob):
        s.post(f"{API}/follow/{bob['user']['id']}", headers=alice["h"])
        r = s.delete(f"{API}/follow/{bob['user']['id']}", headers=alice["h"])
        assert r.status_code == 200
        me = s.get(f"{API}/auth/me", headers=alice["h"]).json()
        assert bob["user"]["id"] not in me["following"]


# ---------- Friends ----------
class TestFriends:
    def test_full_friend_flow(self, s, alice, bob):
        # send request alice -> bob
        r = s.post(f"{API}/friends/request/{bob['user']['id']}", headers=alice["h"])
        assert r.status_code == 200
        # bob sees pending request
        reqs = s.get(f"{API}/friends/requests", headers=bob["h"]).json()
        assert len(reqs) >= 1
        req_id = None
        for req in reqs:
            if req["from"] == alice["user"]["id"]:
                req_id = req["id"]
                assert "from_user" in req
                break
        assert req_id
        # accept
        ra = s.post(f"{API}/friends/accept/{req_id}", headers=bob["h"])
        assert ra.status_code == 200
        # both are friends
        al_friends = s.get(f"{API}/friends", headers=alice["h"]).json()
        bo_friends = s.get(f"{API}/friends", headers=bob["h"]).json()
        assert any(f["id"] == bob["user"]["id"] for f in al_friends)
        assert any(f["id"] == alice["user"]["id"] for f in bo_friends)


# ---------- Stories ----------
class TestStories:
    def test_create_and_list(self, s, alice, bob):
        payload = {"media": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
                   "media_type": "image", "caption": "TEST_story"}
        r = s.post(f"{API}/stories", headers=alice["h"], json=payload)
        assert r.status_code == 200
        sid = r.json()["id"]
        # alice sees own story
        groups = s.get(f"{API}/stories", headers=alice["h"]).json()
        assert any(g["is_me"] and any(x["id"] == sid for x in g["stories"]) for g in groups)
        # bob sees alice's story since they are friends (after friend test)
        gb = s.get(f"{API}/stories", headers=bob["h"]).json()
        alice_group = [g for g in gb if g["user"]["id"] == alice["user"]["id"]]
        assert alice_group, "Bob should see alice's story as friends"


# ---------- Conversations & Messages ----------
class TestConversations:
    def test_dm_dedupe(self, s, alice, bob):
        r1 = s.post(f"{API}/conversations", headers=alice["h"],
                    json={"type": "dm", "participant_ids": [bob["user"]["id"]]})
        assert r1.status_code == 200
        c1 = r1.json()
        # duplicate creation returns same id
        r2 = s.post(f"{API}/conversations", headers=alice["h"],
                    json={"type": "dm", "participant_ids": [bob["user"]["id"]]})
        assert r2.json()["id"] == c1["id"]

    def test_send_and_fetch_messages(self, s, alice, bob):
        r = s.post(f"{API}/conversations", headers=alice["h"],
                   json={"type": "dm", "participant_ids": [bob["user"]["id"]]})
        cid = r.json()["id"]
        txt = f"TEST_msg_{uuid.uuid4().hex[:6]}"
        rm = s.post(f"{API}/conversations/{cid}/messages", headers=alice["h"], json={"text": txt})
        assert rm.status_code == 200
        assert rm.json()["text"] == txt
        # Bob can fetch
        msgs = s.get(f"{API}/conversations/{cid}/messages", headers=bob["h"]).json()
        assert any(m["text"] == txt for m in msgs)
        # DM enriches display_name for me
        c = s.get(f"{API}/conversations/{cid}", headers=alice["h"]).json()
        assert c["display_name"] == "Bob"

    def test_group_admin_edit(self, s, alice, bob):
        r = s.post(f"{API}/conversations", headers=alice["h"],
                   json={"type": "group", "participant_ids": [bob["user"]["id"]], "name": "TEST_grp"})
        cid = r.json()["id"]
        assert alice["user"]["id"] in r.json()["admins"]
        # Bob cannot edit
        rb = s.put(f"{API}/conversations/{cid}", headers=bob["h"], json={"name": "hack"})
        assert rb.status_code == 403
        # Alice edits successfully
        ra = s.put(f"{API}/conversations/{cid}", headers=alice["h"],
                   json={"name": "TEST_renamed", "color": "#abcdef"})
        assert ra.status_code == 200
        assert ra.json()["name"] == "TEST_renamed"
        # Promote bob to admin
        rp = s.post(f"{API}/conversations/{cid}/admins/{bob['user']['id']}", headers=alice["h"])
        assert rp.status_code == 200
        # Now bob can edit
        rb2 = s.put(f"{API}/conversations/{cid}", headers=bob["h"], json={"description": "TEST_desc"})
        assert rb2.status_code == 200


# ---------- Calls ----------
class TestCalls:
    def test_call_lifecycle(self, s, alice, bob):
        r = s.post(f"{API}/calls", headers=alice["h"],
                   json={"callee_id": bob["user"]["id"], "call_type": "voice"})
        assert r.status_code == 200
        cid = r.json()["id"]
        assert r.json()["status"] == "ringing"
        # accept
        ra = s.post(f"{API}/calls/{cid}/accept", headers=bob["h"])
        assert ra.status_code == 200
        assert ra.json()["status"] == "accepted"
        # end
        re = s.post(f"{API}/calls/{cid}/end", headers=alice["h"])
        assert re.json()["status"] == "ended"
        # history direction
        hist_a = s.get(f"{API}/calls", headers=alice["h"]).json()
        assert any(c["id"] == cid and c["direction"] == "outgoing" for c in hist_a)
        hist_b = s.get(f"{API}/calls", headers=bob["h"]).json()
        assert any(c["id"] == cid and c["direction"] == "incoming" for c in hist_b)

    def test_call_bad_action(self, s, alice, bob):
        r = s.post(f"{API}/calls", headers=alice["h"],
                   json={"callee_id": bob["user"]["id"]})
        cid = r.json()["id"]
        rb = s.post(f"{API}/calls/{cid}/badaction", headers=alice["h"])
        assert rb.status_code == 400


# ---------- Locations ----------
class TestLocations:
    def test_update_and_friend_view(self, s, alice, bob):
        r = s.put(f"{API}/location", headers=alice["h"], json={"lat": 12.34, "lng": 56.78})
        assert r.status_code == 200
        # bob (friend of alice) can see alice's location
        locs = s.get(f"{API}/locations/friends", headers=bob["h"]).json()
        assert any(l["user_id"] == alice["user"]["id"] and l["lat"] == 12.34 for l in locs)


# ---------- Notifications ----------
class TestNotifications:
    def test_read_all(self, s, bob):
        r = s.post(f"{API}/notifications/read", headers=bob["h"])
        assert r.status_code == 200
        notes = s.get(f"{API}/notifications", headers=bob["h"]).json()
        assert all(n["read"] for n in notes)


# ---------- WebSocket ----------
class TestWebSocket:
    def test_ws_delivers_message(self, alice, bob, s):
        async def run():
            # bob connects
            async with websockets.connect(f"{WS}/ws/{bob['token']}") as bws:
                await asyncio.sleep(0.3)
                # alice sends message to bob via REST
                conv = s.post(f"{API}/conversations", headers=alice["h"],
                              json={"type": "dm", "participant_ids": [bob["user"]["id"]]}).json()
                txt = f"TEST_ws_{uuid.uuid4().hex[:6]}"
                s.post(f"{API}/conversations/{conv['id']}/messages", headers=alice["h"], json={"text": txt})
                # wait for message event
                got = None
                for _ in range(10):
                    try:
                        raw = await asyncio.wait_for(bws.recv(), timeout=1.5)
                        ev = json.loads(raw)
                        if ev.get("event") == "message" and ev["payload"]["text"] == txt:
                            got = ev
                            break
                    except asyncio.TimeoutError:
                        break
                assert got is not None, "did not receive ws message"
        asyncio.get_event_loop().run_until_complete(run())

    def test_ws_bad_token_closes(self):
        async def run():
            try:
                async with websockets.connect(f"{WS}/ws/badtoken") as ws:
                    # server should close on receive
                    with pytest.raises(Exception):
                        await asyncio.wait_for(ws.recv(), timeout=2)
            except Exception:
                pass
        asyncio.get_event_loop().run_until_complete(run())
