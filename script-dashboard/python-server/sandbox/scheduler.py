"""Async scheduler for interval, queue, cron, and pubsub execution."""
import asyncio
import time
import uuid
import re
from typing import Dict, Any, Callable, Optional, List

from sandbox.executor import execute_script
from utils.parse import parse_message_body


def cron_matches(expression: str, now_timestamp: float) -> bool:
    """
    Check if a 5-field cron expression matches the given timestamp.
    Fields: minute hour day-of-month month day-of-week
    """
    from datetime import datetime
    dt = datetime.fromtimestamp(now_timestamp / 1000.0)
    fields = expression.strip().split()
    if len(fields) != 5:
        return False

    values = [dt.minute, dt.hour, dt.day, dt.month, dt.isoweekday() % 7]
    # Convert Sunday from 7 (isoweekday) to 0 for cron
    if values[4] == 7:
        values[4] = 0

    for i, field in enumerate(fields):
        if not _cron_field_matches(field, values[i]):
            return False
    return True


def _cron_field_matches(field: str, value: int) -> bool:
    """Check if a single cron field matches a value."""
    if field == "*":
        return True

    # Handle comma-separated list
    parts = field.split(",")
    for part in parts:
        if _cron_part_matches(part.strip(), value):
            return True
    return False


def _cron_part_matches(part: str, value: int) -> bool:
    """Check if a single cron part (no commas) matches a value."""
    # Step values: */5 or 1-10/2
    step = 1
    if "/" in part:
        part, step_str = part.split("/", 1)
        step = int(step_str)

    # Range: 1-10
    if "-" in part:
        start_str, end_str = part.split("-", 1)
        start = int(start_str)
        end = int(end_str)
        return start <= value <= end and (value - start) % step == 0

    # Single value
    if part == "*":
        return value % step == 0

    return int(part) == value


class ServerScheduler:
    def __init__(
        self,
        get_cell: Callable[[str], Optional[dict]],
        on_result: Callable[[str, dict], Any],
        get_env: Callable[[], Dict[str, Any]],
        get_data: Callable[[], Dict[str, Any]],
        on_emit: Callable[[str, str], Any],
        api_base: str = "http://localhost:3456/api",
    ):
        self._get_cell = get_cell
        self._on_result = on_result
        self._get_env = get_env
        self._get_data = get_data
        self._on_emit = on_emit
        self._api_base = api_base

        self._tasks: Dict[str, asyncio.Task] = {}
        self._running = True
        self._queue_task: Optional[asyncio.Task] = None
        self._cron_task: Optional[asyncio.Task] = None

    async def run_once(self, cell_id: str, props: Optional[Dict[str, Any]] = None) -> Optional[dict]:
        cell = self._get_cell(cell_id)
        if not cell:
            return None

        env_data = self._get_env()
        resolved_props = props if props is not None else parse_message_body(cell.get("params", "{}"))

        result = await execute_script(
            cell.get("script", ""),
            cell.get("state", {}) or {},
            env_data.get("env", {}),
            env_data.get("secretsObj", {}),
            resolved_props,
            self._api_base,
            timeout=float(cell.get("timeoutMs", 0) or 0) / 1000.0 if cell.get("timeoutMs") else 0.0,
        )

        if self._on_result:
            if asyncio.iscoroutinefunction(self._on_result):
                await self._on_result(cell_id, result)
            else:
                self._on_result(cell_id, result)

        return result

    async def start(self, cell_id: str):
        await self.stop(cell_id)

        cell = self._get_cell(cell_id)
        if not cell:
            return

        interval_ms = cell.get("intervalMs", 10000)
        interval_sec = max(1, interval_ms / 1000.0)

        async def _loop():
            while self._running:
                try:
                    await self.run_once(cell_id)
                except Exception:
                    pass
                try:
                    await asyncio.sleep(interval_sec)
                except asyncio.CancelledError:
                    break

        self._tasks[cell_id] = asyncio.create_task(_loop())

    async def stop(self, cell_id: str):
        task = self._tasks.pop(cell_id, None)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    async def stop_all(self):
        for cell_id in list(self._tasks.keys()):
            await self.stop(cell_id)

    def is_running(self, cell_id: str) -> bool:
        return cell_id in self._tasks

    def get_running_ids(self) -> List[str]:
        return list(self._tasks.keys())

    async def restart(self, cell_id: str):
        cell = self._get_cell(cell_id)
        await self.stop(cell_id)
        if cell and cell.get("enabled", False):
            await self.start(cell_id)

    async def start_queue_polling(self):
        if self._queue_task:
            return

        async def _poll():
            while self._running:
                try:
                    data = self._get_data()
                    queues = data.get("queues", {})
                    for q in list(queues.values()):
                        if not q.get("messages", []):
                            continue
                        for sub_id in q.get("subscriberIds", []):
                            cell = self._get_cell(sub_id)
                            if not cell:
                                continue
                            msg = q["messages"][0]
                            try:
                                await self.run_once(sub_id, parse_message_body(msg.get("body", "")))
                                q["messages"] = q["messages"][1:]
                            except Exception:
                                msg["retries"] = msg.get("retries", 0) + 1
                                max_retries = q.get("maxRetries", 3)
                                if msg["retries"] >= max_retries:
                                    q["messages"] = q["messages"][1:]
                            break
                except Exception:
                    pass
                try:
                    await asyncio.sleep(2)
                except asyncio.CancelledError:
                    break

        self._queue_task = asyncio.create_task(_poll())

    async def stop_queue_polling(self):
        if self._queue_task:
            self._queue_task.cancel()
            try:
                await self._queue_task
            except asyncio.CancelledError:
                pass
            self._queue_task = None

    async def start_cron_polling(self):
        if self._cron_task:
            return

        async def _poll():
            last_checked_minute = 0
            while self._running:
                try:
                    data = self._get_data()
                    crons = data.get("crons", [])
                    now = time.time() * 1000
                    current_minute = int(now / 60000)
                    if current_minute > last_checked_minute:
                        last_checked_minute = current_minute
                        for cron in crons:
                            if not cron.get("enabled", False):
                                continue
                            if cron.get("lastRunAt"):
                                last_minute = int(cron["lastRunAt"] / 60000)
                                if last_minute >= current_minute:
                                    continue
                            if not cron_matches(cron.get("expression", "* * * * *"), now):
                                continue
                            await self._dispatch_cron(cron)
                            cron["lastRunAt"] = now
                except Exception:
                    pass
                try:
                    await asyncio.sleep(15)
                except asyncio.CancelledError:
                    break

        self._cron_task = asyncio.create_task(_poll())

    async def stop_cron_polling(self):
        if self._cron_task:
            self._cron_task.cancel()
            try:
                await self._cron_task
            except asyncio.CancelledError:
                pass
            self._cron_task = None

    async def _dispatch_cron(self, cron: dict):
        payload = cron.get("payload", "{}")
        props = parse_message_body(payload)
        target = cron.get("target", {})

        if target.get("type") == "cell":
            cell = self._get_cell(target.get("name", ""))
            if cell:
                await self.run_once(cell["id"], props)
        elif target.get("type") == "pubsub":
            self._on_emit(target.get("name", ""), payload)
        elif target.get("type") == "queue":
            data = self._get_data()
            queues = data.get("queues", {})
            queue = queues.get(target.get("name", ""))
            if queue:
                msg = {
                    "id": str(uuid.uuid4()),
                    "body": payload,
                    "timestamp": int(time.time() * 1000),
                    "retries": 0,
                }
                queue.setdefault("messages", []).append(msg)

    async def run_cron_now(self, cron: dict):
        await self._dispatch_cron(cron)

    async def shutdown(self):
        self._running = False
        await self.stop_all()
        await self.stop_queue_polling()
        await self.stop_cron_polling()
