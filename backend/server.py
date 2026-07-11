from fastapi import FastAPI, APIRouter, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Dict
import uuid
import jwt
import bcrypt
import httpx
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
JWT_SECRET = os.environ['JWT_SECRET']

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("nova")


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return uuid.uuid4().hex


# ---------- Models ----------
class RegisterInput(BaseModel):
    email: EmailStr
    password: str
    display_name: str


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class UpdateProfile(BaseModel):
    display_name: Optional[str] = None
    description: Optional[str] = None
    avatar: Optional[str] = None  # base64 data uri
    page_color: Optional[str] = None
    chat_bg_color: Optional[str] = None
    ringtone: Optional[str] = None


class StoryInput(BaseModel):
    media: str  # base64 data uri
    media_type: str  # image | video
    caption: Optional[str] = ""


class ConversationInput(BaseModel):
    type: str  # dm | group
    participant_ids: List[str]
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None


class MessageInput(BaseModel):
    text: str


class CallInput(BaseModel):
    callee_id: str
    call_type: str = "voice"  # voice | video


class LocationInput(BaseModel):
    lat: float
    lng: float


# ---------- Auth helpers ----------
def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_pw(pw: str, hashed: str) -> bool:
    return bcrypt.checkpw(pw.encode(), hashed.encode())


def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=30)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def get_current_user(cred: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(cred.credentials, JWT_SECRET, algorithms=["HS256"])
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(401, "User not found")
        user.pop("_id", None)
        return user
    except jwt.PyJWTError:
        raise HTTPException(401, "Invalid token")


def public_user(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u.get("email"),
        "display_name": u.get("display_name"),
        "description": u.get("description", ""),
        "avatar": u.get("avatar"),
        "page_color": u.get("page_color", "#05070D"),
        "chat_bg_color": u.get("chat_bg_color", "#05070D"),
        "ringtone": u.get("ringtone", "discord"),
        "followers": u.get("followers", []),
        "following": u.get("following", []),
        "friends": u.get("friends", []),
    }


# ---------- WebSocket manager ----------
class ConnManager:
    def __init__(self):
        self.active: Dict[str, WebSocket] = {}

    async def connect(self, uid: str, ws: WebSocket):
        await ws.accept()
        self.active[uid] = ws

    def disconnect(self, uid: str):
        self.active.pop(uid, None)

    async def send(self, uid: str, data: dict):
        ws = self.active.get(uid)
        if ws:
            try:
                await ws.send_json(data)
            except Exception:
                pass


manager = ConnManager()


# ---------- Push notifications (Emergent managed) ----------
PUSH_BASE_URL = "https://integrations.emergentagent.com"
PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
push_client = httpx.AsyncClient(base_url=PUSH_BASE_URL, headers={"X-Push-Key": PUSH_KEY}, timeout=10.0)


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


@api_router.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody):
    try:
        resp = await push_client.post("/api/v1/push/users/register", json=body.model_dump())
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"register-push failed (non-blocking): {e}")
        return {"status": "skipped"}
    return {"status": "registered"}


async def send_push(recipients, data, idempotency_key=None):
    if not recipients:
        return
    payload = {"recipients": recipients[:100], "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    try:
        resp = await push_client.post("/api/v1/push/trigger", json=payload)
        resp.raise_for_status()
    except Exception as e:
        logger.warning(f"send_push failed (non-blocking): {e}")


async def notify(user_id: str, ntype: str, text: str, data: dict = None):
    n = {"id": new_id(), "user_id": user_id, "type": ntype, "text": text,
         "data": data or {}, "read": False, "created_at": now_iso()}
    await db.notifications.insert_one(n)
    n.pop("_id", None)
    await manager.send(user_id, {"event": "notification", "payload": n})


# ---------- Auth routes ----------
@api_router.post("/auth/register")
async def register(inp: RegisterInput):
    if await db.users.find_one({"email": inp.email}):
        raise HTTPException(400, "Email already registered")
    uid = new_id()
    user = {
        "id": uid, "email": inp.email, "password": hash_pw(inp.password),
        "display_name": inp.display_name, "description": "", "avatar": None,
        "page_color": "#05070D", "chat_bg_color": "#05070D", "ringtone": "discord",
        "followers": [], "following": [], "friends": [], "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    return {"token": make_token(uid), "user": public_user(user)}


@api_router.post("/auth/login")
async def login(inp: LoginInput):
    user = await db.users.find_one({"email": inp.email})
    if not user or not user.get("password") or not verify_pw(inp.password, user["password"]):
        raise HTTPException(400, "Invalid credentials")
    return {"token": make_token(user["id"]), "user": public_user(user)}


class GoogleAuthInput(BaseModel):
    session_id: str


@api_router.post("/auth/google")
async def google_auth(inp: GoogleAuthInput):
    async with httpx.AsyncClient() as http:
        resp = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": inp.session_id},
            timeout=15,
        )
    if resp.status_code != 200:
        raise HTTPException(401, "Invalid Google session")
    data = resp.json()
    email = data.get("email")
    if not email:
        raise HTTPException(400, "No email returned from Google")
    user = await db.users.find_one({"email": email})
    if not user:
        uid = new_id()
        user = {
            "id": uid, "email": email, "password": None,
            "display_name": data.get("name") or email.split("@")[0],
            "description": "", "avatar": data.get("picture"),
            "page_color": "#05070D", "chat_bg_color": "#05070D", "ringtone": "discord",
            "followers": [], "following": [], "friends": [],
            "auth_provider": "google", "created_at": now_iso(),
        }
        await db.users.insert_one(user)
    return {"token": make_token(user["id"]), "user": public_user(user)}


@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return public_user(user)


# ---------- User routes ----------
@api_router.put("/users/me")
async def update_me(inp: UpdateProfile, user=Depends(get_current_user)):
    updates = {k: v for k, v in inp.dict().items() if v is not None}
    if updates:
        await db.users.update_one({"id": user["id"]}, {"$set": updates})
    u = await db.users.find_one({"id": user["id"]})
    return public_user(u)


@api_router.get("/users")
async def list_users(search: str = "", user=Depends(get_current_user)):
    q = {"id": {"$ne": user["id"]}}
    if search:
        q["display_name"] = {"$regex": search, "$options": "i"}
    users = await db.users.find(q).to_list(100)
    return [public_user(u) for u in users]


@api_router.get("/users/{uid}")
async def get_user(uid: str, user=Depends(get_current_user)):
    u = await db.users.find_one({"id": uid})
    if not u:
        raise HTTPException(404, "Not found")
    return public_user(u)


# ---------- Follow ----------
@api_router.post("/follow/{uid}")
async def follow(uid: str, user=Depends(get_current_user)):
    if uid == user["id"]:
        raise HTTPException(400, "Cannot follow yourself")
    await db.users.update_one({"id": user["id"]}, {"$addToSet": {"following": uid}})
    await db.users.update_one({"id": uid}, {"$addToSet": {"followers": user["id"]}})
    await notify(uid, "follow", f"{user['display_name']} started following you",
                 {"from": public_user(user)})
    await send_push([uid], {"title": "New follower", "message": f"{user['display_name']} started following you", "action_url": "/notifications"})
    return {"ok": True}


@api_router.delete("/follow/{uid}")
async def unfollow(uid: str, user=Depends(get_current_user)):
    await db.users.update_one({"id": user["id"]}, {"$pull": {"following": uid}})
    await db.users.update_one({"id": uid}, {"$pull": {"followers": user["id"]}})
    return {"ok": True}


# ---------- Friends ----------
@api_router.post("/friends/request/{uid}")
async def friend_request(uid: str, user=Depends(get_current_user)):
    if uid == user["id"]:
        raise HTTPException(400, "Invalid")
    existing = await db.friend_requests.find_one({"from": user["id"], "to": uid, "status": "pending"})
    if existing:
        return {"ok": True}
    fr = {"id": new_id(), "from": user["id"], "to": uid, "status": "pending", "created_at": now_iso()}
    await db.friend_requests.insert_one(fr)
    await notify(uid, "friend_request", f"{user['display_name']} sent you a friend request",
                 {"from": public_user(user), "request_id": fr["id"]})
    await send_push([uid], {"title": "Friend request", "message": f"{user['display_name']} wants to be your friend", "action_url": "/people"})
    return {"ok": True}


@api_router.post("/friends/accept/{request_id}")
async def friend_accept(request_id: str, user=Depends(get_current_user)):
    fr = await db.friend_requests.find_one({"id": request_id})
    if not fr or fr["to"] != user["id"]:
        raise HTTPException(404, "Request not found")
    await db.friend_requests.update_one({"id": request_id}, {"$set": {"status": "accepted"}})
    await db.users.update_one({"id": fr["from"]}, {"$addToSet": {"friends": fr["to"]}})
    await db.users.update_one({"id": fr["to"]}, {"$addToSet": {"friends": fr["from"]}})
    await notify(fr["from"], "friend_accept", f"{user['display_name']} accepted your friend request",
                 {"from": public_user(user)})
    return {"ok": True}


@api_router.get("/friends/requests")
async def friend_requests(user=Depends(get_current_user)):
    reqs = await db.friend_requests.find({"to": user["id"], "status": "pending"}).to_list(100)
    from_ids = list({r["from"] for r in reqs})
    fusers = await db.users.find({"id": {"$in": from_ids}}).to_list(100) if from_ids else []
    umap = {u2["id"]: u2 for u2 in fusers}
    out = []
    for r in reqs:
        r.pop("_id", None)
        fu = umap.get(r["from"])
        if fu:
            r["from_user"] = public_user(fu)
        out.append(r)
    return out


@api_router.get("/friends")
async def get_friends(user=Depends(get_current_user)):
    u = await db.users.find_one({"id": user["id"]})
    friends = await db.users.find({"id": {"$in": u.get("friends", [])}}).to_list(200)
    return [public_user(f) for f in friends]


# ---------- Stories ----------
@api_router.post("/stories")
async def create_story(inp: StoryInput, user=Depends(get_current_user)):
    s = {"id": new_id(), "user_id": user["id"], "media": inp.media,
         "media_type": inp.media_type, "caption": inp.caption,
         "viewers": [], "created_at": now_iso()}
    await db.stories.insert_one(s)
    s.pop("_id", None)
    return s


@api_router.get("/stories")
async def get_stories(user=Depends(get_current_user)):
    u = await db.users.find_one({"id": user["id"]})
    allowed = list(set(u.get("friends", []) + [user["id"]]))
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    stories = await db.stories.find({"user_id": {"$in": allowed}, "created_at": {"$gte": cutoff}}).to_list(500)
    grouped = {}
    for s in stories:
        s.pop("_id", None)
        grouped.setdefault(s["user_id"], []).append(s)
    result = []
    if grouped:
        gusers = await db.users.find({"id": {"$in": list(grouped.keys())}}).to_list(500)
        umap = {u2["id"]: u2 for u2 in gusers}
    else:
        umap = {}
    for uid, items in grouped.items():
        su = umap.get(uid)
        if not su:
            continue
        items.sort(key=lambda x: x["created_at"])
        result.append({"user": public_user(su), "stories": items,
                       "is_me": uid == user["id"]})
    result.sort(key=lambda x: (not x["is_me"]))
    return result


# ---------- Conversations & Messages ----------
@api_router.post("/conversations")
async def create_conversation(inp: ConversationInput, user=Depends(get_current_user)):
    participants = list(set(inp.participant_ids + [user["id"]]))
    if inp.type == "dm" and len(participants) == 2:
        existing = await db.conversations.find_one(
            {"type": "dm", "participants": {"$all": participants, "$size": 2}})
        if existing:
            existing.pop("_id", None)
            return existing
    conv = {"id": new_id(), "type": inp.type, "participants": participants,
            "name": inp.name, "description": inp.description or "",
            "color": inp.color or "#05070D", "admins": [user["id"]],
            "owner": user["id"], "created_at": now_iso(),
            "last_message": None, "updated_at": now_iso()}
    await db.conversations.insert_one(conv)
    conv.pop("_id", None)
    return conv


async def enrich_conv(conv: dict, me_id: str):
    conv.pop("_id", None)
    users = await db.users.find({"id": {"$in": conv["participants"]}}).to_list(100)
    conv["participant_users"] = [public_user(u) for u in users]
    if conv["type"] == "dm":
        other = next((u for u in users if u["id"] != me_id), None)
        if other:
            conv["display_name"] = other["display_name"]
            conv["display_avatar"] = other.get("avatar")
            conv["other_id"] = other["id"]
    else:
        conv["display_name"] = conv.get("name") or "Group"
    return conv


@api_router.get("/conversations")
async def list_conversations(user=Depends(get_current_user)):
    convs = await db.conversations.find({"participants": user["id"]}).sort("updated_at", -1).to_list(200)
    return [await enrich_conv(c, user["id"]) for c in convs]


@api_router.get("/conversations/{cid}")
async def get_conversation(cid: str, user=Depends(get_current_user)):
    c = await db.conversations.find_one({"id": cid})
    if not c or user["id"] not in c["participants"]:
        raise HTTPException(404, "Not found")
    return await enrich_conv(c, user["id"])


@api_router.get("/conversations/{cid}/messages")
async def get_messages(cid: str, user=Depends(get_current_user)):
    msgs = await db.messages.find({"conversation_id": cid}).sort("created_at", 1).to_list(1000)
    for m in msgs:
        m.pop("_id", None)
    return msgs


@api_router.post("/conversations/{cid}/messages")
async def send_message(cid: str, inp: MessageInput, user=Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": cid})
    if not conv or user["id"] not in conv["participants"]:
        raise HTTPException(404, "Not found")
    msg = {"id": new_id(), "conversation_id": cid, "sender_id": user["id"],
           "sender_name": user["display_name"], "sender_avatar": user.get("avatar"),
           "text": inp.text, "created_at": now_iso()}
    await db.messages.insert_one(msg)
    msg.pop("_id", None)
    await db.conversations.update_one({"id": cid},
        {"$set": {"last_message": inp.text, "updated_at": now_iso()}})
    for pid in conv["participants"]:
        if pid != user["id"]:
            await manager.send(pid, {"event": "message", "payload": msg})
    recipients = [p for p in conv["participants"] if p != user["id"]]
    await send_push(recipients, {"title": user["display_name"], "message": inp.text, "action_url": f"/chat/{cid}"})
    return msg


@api_router.post("/conversations/{cid}/admins/{uid}")
async def add_admin(cid: str, uid: str, user=Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": cid})
    if not conv or user["id"] not in conv.get("admins", []):
        raise HTTPException(403, "Only admins can promote")
    await db.conversations.update_one({"id": cid}, {"$addToSet": {"admins": uid}})
    return {"ok": True}


@api_router.put("/conversations/{cid}")
async def update_conversation(cid: str, body: dict, user=Depends(get_current_user)):
    conv = await db.conversations.find_one({"id": cid})
    if not conv or user["id"] not in conv.get("admins", []):
        raise HTTPException(403, "Only admins can edit")
    allowed = {k: v for k, v in body.items() if k in ["name", "description", "color"]}
    await db.conversations.update_one({"id": cid}, {"$set": allowed})
    c = await db.conversations.find_one({"id": cid})
    return await enrich_conv(c, user["id"])


# ---------- Calls ----------
@api_router.post("/calls")
async def start_call(inp: CallInput, user=Depends(get_current_user)):
    call = {"id": new_id(), "caller_id": user["id"], "callee_id": inp.callee_id,
            "call_type": inp.call_type, "status": "ringing", "created_at": now_iso()}
    await db.calls.insert_one(call)
    call.pop("_id", None)
    await manager.send(inp.callee_id, {"event": "call_incoming",
        "payload": {"call": call, "caller": public_user(user)}})
    await send_push([inp.callee_id], {"title": "Incoming call", "message": f"{user['display_name']} is calling you", "action_url": "/(tabs)/calls"})
    return call


@api_router.post("/calls/{cid}/{action}")
async def call_action(cid: str, action: str, user=Depends(get_current_user)):
    call = await db.calls.find_one({"id": cid})
    if not call:
        raise HTTPException(404, "Not found")
    status_map = {"accept": "accepted", "decline": "declined", "end": "ended"}
    st = status_map.get(action)
    if not st:
        raise HTTPException(400, "Bad action")
    await db.calls.update_one({"id": cid}, {"$set": {"status": st}})
    other = call["caller_id"] if user["id"] == call["callee_id"] else call["callee_id"]
    await manager.send(other, {"event": f"call_{st}", "payload": {"call_id": cid}})
    return {"ok": True, "status": st}


@api_router.get("/calls")
async def call_history(user=Depends(get_current_user)):
    calls = await db.calls.find(
        {"$or": [{"caller_id": user["id"]}, {"callee_id": user["id"]}]}
    ).sort("created_at", -1).to_list(100)
    other_ids = list({(c["callee_id"] if c["caller_id"] == user["id"] else c["caller_id"]) for c in calls})
    ousers = await db.users.find({"id": {"$in": other_ids}}).to_list(200) if other_ids else []
    umap = {u2["id"]: u2 for u2 in ousers}
    out = []
    for c in calls:
        c.pop("_id", None)
        other_id = c["callee_id"] if c["caller_id"] == user["id"] else c["caller_id"]
        ou = umap.get(other_id)
        c["other_user"] = public_user(ou) if ou else None
        c["direction"] = "outgoing" if c["caller_id"] == user["id"] else "incoming"
        out.append(c)
    return out


# ---------- Locations ----------
@api_router.put("/location")
async def update_location(inp: LocationInput, user=Depends(get_current_user)):
    await db.locations.update_one({"user_id": user["id"]},
        {"$set": {"user_id": user["id"], "lat": inp.lat, "lng": inp.lng,
                  "updated_at": now_iso()}}, upsert=True)
    return {"ok": True}


@api_router.get("/locations/friends")
async def friend_locations(user=Depends(get_current_user)):
    u = await db.users.find_one({"id": user["id"]})
    ids = u.get("friends", [])
    locs = await db.locations.find({"user_id": {"$in": ids}}).to_list(200)
    luser_ids = list({l["user_id"] for l in locs})
    lusers = await db.users.find({"id": {"$in": luser_ids}}).to_list(200) if luser_ids else []
    umap = {u2["id"]: u2 for u2 in lusers}
    out = []
    for l in locs:
        l.pop("_id", None)
        fu = umap.get(l["user_id"])
        l["user"] = public_user(fu) if fu else None
        out.append(l)
    return out


# ---------- Notifications ----------
@api_router.get("/notifications")
async def get_notifications(user=Depends(get_current_user)):
    notes = await db.notifications.find({"user_id": user["id"]}).sort("created_at", -1).to_list(100)
    for n in notes:
        n.pop("_id", None)
    return notes


@api_router.post("/notifications/read")
async def read_notifications(user=Depends(get_current_user)):
    await db.notifications.update_many({"user_id": user["id"]}, {"$set": {"read": True}})
    return {"ok": True}


@api_router.get("/")
async def root():
    return {"message": "Nova API"}


# ---------- WebSocket ----------
@app.websocket("/api/ws/{token}")
async def websocket_endpoint(ws: WebSocket, token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        uid = payload["sub"]
    except jwt.PyJWTError:
        await ws.close(code=1008)
        return
    await manager.connect(uid, ws)
    try:
        while True:
            data = await ws.receive_json()
            # relay signaling events directly (e.g. call ICE / typing)
            target = data.get("target")
            if target:
                await manager.send(target, data)
    except WebSocketDisconnect:
        manager.disconnect(uid)
    except Exception:
        manager.disconnect(uid)


app.include_router(api_router)
_cors_origins = os.environ.get("CORS_ORIGINS", "*")
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"] if _cors_origins == "*" else [o.strip() for o in _cors_origins.split(",")],
    allow_methods=["*"], allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
    await push_client.aclose()
