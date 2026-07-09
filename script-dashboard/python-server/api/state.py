"""Server state management — in-memory data + file persistence (async I/O)."""
import os
import json
import asyncio
import re
import time
from typing import Dict, Any, List, Optional
from pathlib import Path

from storage.file_storage import FileStorageBackend
from sandbox.scheduler import ServerScheduler
from crypto.secrets import encrypt_secrets, decrypt_secrets, hash_password
from utils.parse import parse_message_body


auth_enabled = {"value": False}
valid_tokens: set = set()

DATA_DIR = os.environ.get("DASHAWS_DATA_DIR", os.path.join(os.getcwd(), "data-python"))
Path(DATA_DIR).mkdir(parents=True, exist_ok=True)

storage = FileStorageBackend()

server_env: Dict[str, str] = {}
server_secrets_blob: Optional[dict] = None
server_secrets: Dict[str, str] = {}
server_secrets_password: Optional[str] = None
server_queues: Dict[str, dict] = {}
server_event_topics: Dict[str, dict] = {}
server_crons: List[dict] = []
cells: List[dict] = []
scheduler: Optional[ServerScheduler] = None
auto_disabled_cron_names: set = set()

server_languages: List[str] = ["python"]

# Debounce state for persist_state
_persist_task = None


def _load_json_sync(filename: str) -> dict:
    path = os.path.join(DATA_DIR, filename)
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except (json.JSONDecodeError, IOError):
        pass
    return {}


def _save_json_sync(filename: str, data):
    path = os.path.join(DATA_DIR, filename)
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, separators=(",", ":"), ensure_ascii=False)


async def _load_json(filename: str) -> dict:
    path = os.path.join(DATA_DIR, filename)
    try:
        if os.path.exists(path):
            return await asyncio.to_thread(_load_json_sync, filename)
    except (json.JSONDecodeError, IOError):
        pass
    return {}


async def _save_json(filename: str, data):
    path = os.path.join(DATA_DIR, filename)
    Path(DATA_DIR).mkdir(parents=True, exist_ok=True)
    await asyncio.to_thread(_save_json_sync, filename, data)


async def init_state():
    global server_env, server_secrets_blob, server_queues, server_event_topics, server_crons

    server_env = await _load_json("env.json")
    server_secrets_blob = await _load_json("secrets.enc.json") or None
    server_queues = await _load_json("queues.json")

    crons_data = await _load_json("crons.json")
    server_crons = crons_data if isinstance(crons_data, list) else []

    topics_data = await _load_json("topics.json")
    server_event_topics = topics_data if isinstance(topics_data, dict) else {}


def persist_state():
    """Schedule a debounced persist. Multiple rapid calls coalesce into one write."""
    global _persist_task
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        # No running event loop — write synchronously (startup / testing)
        _save_json_sync("env.json", server_env)
        if server_secrets_blob:
            _save_json_sync("secrets.enc.json", server_secrets_blob)
        _save_json_sync("queues.json", server_queues)
        _save_json_sync("topics.json", server_event_topics)
        _save_json_sync("crons.json", server_crons)
        return

    if _persist_task and not _persist_task.done():
        return  # already scheduled

    _persist_task = loop.create_task(_persist_debounced())


async def _persist_debounced():
    await asyncio.sleep(0.5)  # 500ms coalesce window
    global _persist_task
    _persist_task = None
    await _save_json("env.json", server_env)
    if server_secrets_blob:
        await _save_json("secrets.enc.json", server_secrets_blob)
    await _save_json("queues.json", server_queues)
    await _save_json("topics.json", server_event_topics)
    await _save_json("crons.json", server_crons)


async def flush_all():
    """Flush all pending writes (storage + metadata)."""
    await storage.flush()
    global _persist_task
    if _persist_task and not _persist_task.done():
        _persist_task.cancel()
        try:
            await _persist_task
        except asyncio.CancelledError:
            pass
        _persist_task = None
    # Write metadata immediately
    await _save_json("env.json", server_env)
    if server_secrets_blob:
        await _save_json("secrets.enc.json", server_secrets_blob)
    await _save_json("queues.json", server_queues)
    await _save_json("topics.json", server_event_topics)
    await _save_json("crons.json", server_crons)


async def sync_cell(cell: dict):
    await storage.save(cell)
    global cells
    idx = None
    for i, c in enumerate(cells):
        if c.get("id") == cell.get("id"):
            idx = i
            break
    if idx is not None:
        cells[idx] = cell
    else:
        cells.append(cell)

    if scheduler and cell.get("enabled", False):
        if scheduler.is_running(cell["id"]):
            await scheduler.restart(cell["id"])
        else:
            await scheduler.start(cell["id"])


async def remove_cell(id: str):
    await storage.delete(id)
    global cells
    if scheduler:
        await scheduler.stop(id)
    cells = [c for c in cells if c.get("id") != id]


def cell_uses_secrets(script: str) -> bool:
    return bool(re.search(r'\$secrets[\.\[]\s*[\'"\w]', script) or re.search(r'secrets[\.\[]\s*[\'"\w]', script))


def auto_disable_secret_crons():
    global auto_disabled_cron_names
    secret_names = set()
    for cell in cells:
        if cell_uses_secrets(cell.get("script", "")):
            secret_names.add(cell.get("id"))
            secret_names.add(cell.get("name"))
    for cron in server_crons:
        if cron.get("target", {}).get("type") != "cell":
            continue
        if cron["target"]["name"] in secret_names and cron.get("enabled", False):
            cron["enabled"] = False
            auto_disabled_cron_names.add(cron.get("name", ""))
    persist_state()


def re_enable_auto_disabled_crons():
    global auto_disabled_cron_names
    for cron in server_crons:
        if cron.get("name") in auto_disabled_cron_names:
            cron["enabled"] = True
    auto_disabled_cron_names.clear()
    persist_state()


async def unlock_secrets(password: str) -> bool:
    global server_secrets, server_secrets_password
    if not server_secrets_blob:
        return False
    try:
        server_secrets = decrypt_secrets(server_secrets_blob, password)
        server_secrets_password = password
        re_enable_auto_disabled_crons()
        return True
    except Exception:
        return False


def lock_secrets():
    global server_secrets, server_secrets_password
    server_secrets = {}
    server_secrets_password = None
    auto_disable_secret_crons()


async def set_secrets_blob(blob: dict):
    global server_secrets_blob, server_secrets
    server_secrets_blob = blob
    persist_state()
    if server_secrets_password:
        try:
            server_secrets = decrypt_secrets(blob, server_secrets_password)
        except Exception:
            pass


def clear_secrets_all():
    global server_secrets_blob, server_secrets, server_secrets_password, auto_disabled_cron_names
    server_secrets_blob = None
    server_secrets = {}
    server_secrets_password = None
    auto_disabled_cron_names.clear()
    path = os.path.join(DATA_DIR, "secrets.enc.json")
    try:
        if os.path.exists(path):
            os.unlink(path)
    except OSError:
        pass


async def init_server():
    global cells, scheduler

    await init_state()
    cells = await storage.list()
    # Migrate legacy cells
    for cell in cells:
        if "language" not in cell:
            cell["language"] = "python"

    PORT = int(os.environ.get("PORT", "3456"))
    api_base = os.environ.get("DASHAWS_API_BASE", "http://localhost:{}/api".format(PORT))

    def get_cell(id: str):
        for c in cells:
            if c.get("id") == id:
                return c
        return None

    async def on_result(id: str, result: dict):
        for cell in cells:
            if cell.get("id") == id:
                cell["status"] = "success" if result.get("success") else "error"
                cell["lastRunAt"] = int(time.time() * 1000)
                cell["output"] = (cell.get("output", []) + result.get("output", []))[-200:]
                cell["state"] = result.get("state", {})
                await storage.save(cell)
                break

    def get_env():
        return {
            "env": {**server_env},
            "secrets": set(server_secrets.values()),
            "secretsObj": {**server_secrets},
        }

    def get_data():
        return {
            "queues": server_queues,
            "eventTopics": server_event_topics,
            "crons": server_crons,
        }

    def on_emit(name: str, body: str):
        topic = server_event_topics.get(name)
        if not topic:
            return
        for cell_id in topic.get("subscriberIds", []):
            cell = get_cell(cell_id)
            if cell:
                asyncio.create_task(scheduler.run_once(cell_id, parse_message_body(body)))

    scheduler = ServerScheduler(
        get_cell=get_cell,
        on_result=on_result,
        get_env=get_env,
        get_data=get_data,
        on_emit=on_emit,
        api_base=api_base,
    )

    running = [c for c in cells if c.get("enabled", False)]
    for cell in running:
        await scheduler.start(cell["id"])

    await scheduler.start_queue_polling()
    await scheduler.start_cron_polling()

    if server_secrets_blob and not server_secrets_password:
        auto_disable_secret_crons()
