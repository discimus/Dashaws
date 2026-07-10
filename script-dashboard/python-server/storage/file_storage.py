"""File-based JSON persistence for cells — async I/O with debounced writes."""
import os
import json
import asyncio
import time


DATA_DIR = os.environ.get("DASHAWS_DATA_DIR", os.path.join(os.getcwd(), "data-python"))
CELLS_FILE = os.path.join(DATA_DIR, "cells.json")


def _ensure_dir() -> None:
    os.makedirs(DATA_DIR, exist_ok=True)


def _read_cells_sync() -> list[dict]:
    try:
        if not os.path.exists(CELLS_FILE):
            return []
        with open(CELLS_FILE, "r", encoding="utf-8") as f:
            cells = json.load(f)
        for cell in cells:
            if "language" not in cell:
                cell["language"] = "python"
        return cells
    except (json.JSONDecodeError, IOError):
        return []


def _write_cells_sync(cells: list[dict]) -> None:
    _ensure_dir()
    tmp_path = CELLS_FILE + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(cells, f, separators=(",", ":"), ensure_ascii=False)
    os.replace(tmp_path, CELLS_FILE)


async def _read_cells() -> list[dict]:
    return await asyncio.to_thread(_read_cells_sync)


def _migrate_cell(cell: dict) -> None:
    if cell and "language" not in cell:
        cell["language"] = "python"


async def _write_cells(cells: list[dict]) -> None:
    await asyncio.to_thread(_write_cells_sync, cells)


class FileStorageBackend:
    def __init__(self):
        self._pending: dict[str, dict | None] = {}  # cell_id -> cell (None marks deletion)
        self._flush_task: asyncio.Task[None] | None = None
        self._lock = asyncio.Lock()

    async def list(self) -> list[dict]:
        cells = await _read_cells()
        pending = dict(self._pending)
        for cell_id, cell in pending.items():
            cells = [c for c in cells if c.get("id") != cell_id]
            if cell is not None:
                _migrate_cell(cell)
                cells.append(cell)
        return cells

    async def get(self, id: str) -> dict | None:
        if id in self._pending:
            cell = self._pending[id]
            if cell is not None:
                _migrate_cell(cell)
            return cell
        cells = await _read_cells()
        for c in cells:
            if c.get("id") == id:
                return c
        return None

    async def save(self, cell: dict) -> None:
        cell["updatedAt"] = int(time.time() * 1000)
        self._pending[cell.get("id")] = cell
        self._schedule_flush()

    async def delete(self, id: str) -> None:
        self._pending[id] = None
        self._schedule_flush()

    def _schedule_flush(self) -> None:
        if self._flush_task and not self._flush_task.done():
            return  # already scheduled
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()
        self._flush_task = loop.create_task(self._debounced_flush())

    async def _debounced_flush(self) -> None:
        await asyncio.sleep(0.3)  # 300ms coalesce window
        await self.flush()

    async def flush(self) -> None:
        async with self._lock:
            if not self._pending:
                return
            pending = dict(self._pending)
            self._pending.clear()

        cells = await _read_cells()
        for cell_id in list(pending.keys()):
            cells = [c for c in cells if c.get("id") != cell_id]
        for cell_id, cell in pending.items():
            if cell is not None:
                cells.append(cell)
        await _write_cells(cells)
