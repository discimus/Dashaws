"""FastAPI routes — same REST API as the Node.js server."""
import time
import json
from fastapi import APIRouter, Request, HTTPException, Body
from fastapi.responses import JSONResponse

from api import state as st
from utils.parse import parse_message_body

router = APIRouter()

# ── Validation constants (aligned with Node.js server limits) ────────
_MAX_SCRIPT_SIZE = 1_000_000      # 1 MB
_MAX_CELL_NAME = 256
_MAX_ENV_KEY = 128
_MAX_ENV_VALUE = 4096
_MAX_SECRETS_VALUE = 4096
_MAX_QUEUE_NAME = 128
_MAX_TOPIC_NAME = 128
_MAX_CRON_NAME = 128
_MAX_CRON_COUNT = 200


def _validate_cell_body(body: dict):
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail={"error": "Body must be a JSON object"})
    if body.get("script") and isinstance(body["script"], str) and len(body["script"]) > _MAX_SCRIPT_SIZE:
        raise HTTPException(status_code=400, detail={"error": "Script exceeds max size ({} KB)".format(_MAX_SCRIPT_SIZE // 1000)})
    if body.get("name") and isinstance(body["name"], str) and len(body["name"]) > _MAX_CELL_NAME:
        raise HTTPException(status_code=400, detail={"error": "Name exceeds max length ({})".format(_MAX_CELL_NAME)})


def _validate_env_body(body: dict):
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail={"error": "Body must be a JSON object"})
    for k, v in body.items():
        if not isinstance(k, str) or len(k) > _MAX_ENV_KEY:
            raise HTTPException(status_code=400, detail={"error": "Env key exceeds max length ({})".format(_MAX_ENV_KEY)})
        if not isinstance(v, str) or len(v) > _MAX_ENV_VALUE:
            raise HTTPException(status_code=400, detail={"error": "Env value exceeds max length ({})".format(_MAX_ENV_VALUE)})


def _validate_secrets_body(body: dict):
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail={"error": "Body must be a JSON object"})
    for k in ("iv", "data", "salt", "hash"):
        if k not in body:
            raise HTTPException(status_code=400, detail={"error": "Missing required field: {}".format(k)})
        if not isinstance(body[k], str) or len(body[k]) > 5_000_000:
            raise HTTPException(status_code=400, detail={"error": "Field '{}' is too large or invalid".format(k)})


@router.get("/health")
async def health():
    return {"ok": True, "timestamp": int(time.time() * 1000)}


@router.get("/languages")
async def languages():
    return st.server_languages


# Cells
@router.get("/cells")
async def list_cells():
    return st.cells


@router.get("/cells/{id}")
async def get_cell(id: str):
    for c in st.cells:
        if c.get("id") == id:
            return c
    raise HTTPException(status_code=404, detail={"error": "Not found"})


@router.put("/cells/{id}")
async def put_cell(id: str, body: dict):
    _validate_cell_body(body)
    allowed = {'name', 'language', 'script', 'intervalMs', 'timeoutMs', 'enabled', 'params', 'status', 'output', 'state', 'createdAt', 'lockedBy', 'lockedAt'}
    cell = {k: body[k] for k in allowed if k in body}
    cell.update({"id": id, "updatedAt": int(time.time() * 1000)})
    if "language" not in cell:
        cell["language"] = "python"
    await st.sync_cell(cell)
    return cell


@router.delete("/cells/{id}")
async def delete_cell(id: str):
    await st.remove_cell(id)
    return {"ok": True}


@router.post("/cells/{id}/run")
async def run_cell(id: str, body: dict = None):
    cell = None
    for c in st.cells:
        if c.get("id") == id:
            cell = c
            break
    if not cell:
        raise HTTPException(status_code=404, detail={"error": "Not found"})
    if not st.scheduler:
        raise HTTPException(status_code=503, detail={"error": "Scheduler not ready"})
    props = body if isinstance(body, dict) else None
    result = await st.scheduler.run_once(id, props)
    return result


@router.post("/cells/{id}/start")
async def start_cell(id: str):
    for c in st.cells:
        if c.get("id") == id:
            c["enabled"] = True
            await st.storage.save(c)
            if st.scheduler:
                await st.scheduler.start(id)
            return {"ok": True}
    raise HTTPException(status_code=404, detail={"error": "Not found"})


@router.post("/cells/{id}/stop")
async def stop_cell(id: str):
    for c in st.cells:
        if c.get("id") == id:
            c["enabled"] = False
            await st.storage.save(c)
            if st.scheduler:
                await st.scheduler.stop(id)
            return {"ok": True}
    raise HTTPException(status_code=404, detail={"error": "Not found"})


# Environment
@router.get("/env")
async def get_env():
    return st.server_env


@router.put("/env")
async def put_env(body: dict):
    _validate_env_body(body)
    st.server_env.clear()
    st.server_env.update(body)
    st.persist_state()
    return st.server_env


# Secrets
@router.get("/secrets/status")
async def secrets_status():
    return {
        "hasBlob": st.server_secrets_blob is not None,
        "unlocked": st.server_secrets_password is not None and len(st.server_secrets) > 0,
    }


@router.post("/secrets/unlock")
async def unlock(body: dict):
    password = body.get("password")
    if not password or not isinstance(password, str):
        raise HTTPException(status_code=400, detail={"error": "Password required"})
    ok = await st.unlock_secrets(password)
    if not ok:
        raise HTTPException(status_code=401, detail={"error": "Invalid password or no blob stored"})
    return {"ok": True}


@router.post("/secrets/lock")
async def lock():
    st.lock_secrets()
    return {"ok": True}


@router.put("/secrets")
async def put_secrets(body: dict):
    _validate_secrets_body(body)
    await st.set_secrets_blob(body)
    return {"ok": True}


@router.delete("/secrets")
async def delete_secrets():
    st.clear_secrets_all()
    return {"ok": True}


# Queues
@router.get("/queues")
async def get_queues():
    return st.server_queues


@router.put("/queues")
async def put_queues(body: dict):
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail={"error": "Body must be a JSON object"})
    for name, queue in body.items():
        if not isinstance(name, str) or len(name) > _MAX_QUEUE_NAME:
            raise HTTPException(status_code=400, detail={"error": "Queue name exceeds max length ({})".format(_MAX_QUEUE_NAME)})
    st.server_queues.clear()
    st.server_queues.update(body)
    st.persist_state()
    return st.server_queues


# Topics
@router.get("/topics")
async def get_topics():
    return st.server_event_topics


@router.put("/topics")
async def put_topics(body: dict):
    if not isinstance(body, dict):
        raise HTTPException(status_code=400, detail={"error": "Body must be a JSON object"})
    for name, topic in body.items():
        if not isinstance(name, str) or len(name) > _MAX_TOPIC_NAME:
            raise HTTPException(status_code=400, detail={"error": "Topic name exceeds max length ({})".format(_MAX_TOPIC_NAME)})
    st.server_event_topics.clear()
    st.server_event_topics.update(body)
    st.persist_state()
    return st.server_event_topics


@router.post("/topics/{name}/emit")
async def emit_topic(name: str, body, request: Request = None):
    topic = st.server_event_topics.get(name)
    if not topic:
        raise HTTPException(status_code=404, detail={"error": "Topic not found"})
    payload = body if isinstance(body, str) else json.dumps(body)
    for cell_id in topic.get("subscriberIds", []):
        cell = None
        for c in st.cells:
            if c.get("id") == cell_id:
                cell = c
                break
        if cell and st.scheduler:
            import asyncio
            asyncio.create_task(st.scheduler.run_once(cell_id, parse_message_body(payload)))
    return {"ok": True}


# Crons
@router.get("/crons")
async def get_crons():
    return st.server_crons


@router.put("/crons")
async def put_crons(body: list = Body(...)):
    if not isinstance(body, list):
        raise HTTPException(status_code=400, detail={"error": "Body must be a JSON array"})
    if len(body) > _MAX_CRON_COUNT:
        raise HTTPException(status_code=400, detail={"error": "Too many cronjobs (max {})".format(_MAX_CRON_COUNT)})
    for cron in body:
        if not isinstance(cron, dict):
            raise HTTPException(status_code=400, detail={"error": "Each cron must be an object"})
        name = cron.get("name", "")
        if not isinstance(name, str) or len(name) > _MAX_CRON_NAME:
            raise HTTPException(status_code=400, detail={"error": "Cron name exceeds max length ({})".format(_MAX_CRON_NAME)})
    st.server_crons.clear()
    st.server_crons.extend(body or [])
    if st.server_secrets_blob and not st.server_secrets_password:
        st.lock_secrets()
    else:
        st.persist_state()
    return st.server_crons
