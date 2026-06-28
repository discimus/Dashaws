"""File-based JSON persistence for cells."""
import os
import json
from typing import List, Optional


DATA_DIR = os.environ.get("DASHAWS_DATA_DIR", os.path.join(os.getcwd(), "data-python"))
CELLS_FILE = os.path.join(DATA_DIR, "cells.json")


def _ensure_dir():
    os.makedirs(DATA_DIR, exist_ok=True)


def _read_cells() -> List[dict]:
    try:
        if not os.path.exists(CELLS_FILE):
            return []
        with open(CELLS_FILE, "r", encoding="utf-8") as f:
            cells = json.load(f)
        # Migrate legacy cells without language field
        for cell in cells:
            if "language" not in cell:
                cell["language"] = "python"
        return cells
    except (json.JSONDecodeError, IOError):
        return []


def _write_cells(cells: List[dict]):
    _ensure_dir()
    with open(CELLS_FILE, "w", encoding="utf-8") as f:
        json.dump(cells, f, indent=2, ensure_ascii=False)


class FileStorageBackend:
    async def list(self) -> List[dict]:
        return _read_cells()

    async def get(self, id: str) -> Optional[dict]:
        cells = _read_cells()
        for c in cells:
            if c.get("id") == id:
                return c
        return None

    async def save(self, cell: dict):
        cells = _read_cells()
        cell["updatedAt"] = int(__import__("time").time() * 1000)
        idx = None
        for i, c in enumerate(cells):
            if c.get("id") == cell.get("id"):
                idx = i
                break
        if idx is not None:
            cells[idx] = cell
        else:
            cells.append(cell)
        _write_cells(cells)

    async def delete(self, id: str):
        cells = _read_cells()
        _write_cells([c for c in cells if c.get("id") != id])
