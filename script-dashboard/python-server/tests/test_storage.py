"""Tests for file storage backend — including debounce, flush, and thread I/O."""
import os
import json
import asyncio
import tempfile
import pytest
from storage.file_storage import FileStorageBackend, DATA_DIR, _write_cells_sync, _read_cells_sync


@pytest.fixture(autouse=True)
def _cleanup_storage():
    yield
    # Reset module-level globals to avoid cross-test pollution
    import storage.file_storage as mod
    mod.DATA_DIR = os.environ.get("DASHAWS_DATA_DIR", os.path.join(os.getcwd(), "data-python"))
    mod.CELLS_FILE = os.path.join(mod.DATA_DIR, "cells.json")


@pytest.fixture
def temp_storage(monkeypatch):
    tmp = tempfile.mkdtemp()
    monkeypatch.setattr("storage.file_storage.DATA_DIR", tmp)
    monkeypatch.setattr("storage.file_storage.CELLS_FILE", os.path.join(tmp, "cells.json"))
    storage = FileStorageBackend()
    yield storage
    import shutil
    shutil.rmtree(tmp, ignore_errors=True)


# ── Existing API tests (list/get/save/delete) ──

@pytest.mark.asyncio
async def test_list_empty(temp_storage):
    cells = await temp_storage.list()
    assert cells == []


@pytest.mark.asyncio
async def test_save_and_list(temp_storage):
    cell = {"id": "test-1", "name": "Test", "language": "python", "script": "console.log('hi')"}
    await temp_storage.save(cell)
    cells = await temp_storage.list()
    assert len(cells) == 1
    assert cells[0]["id"] == "test-1"
    assert cells[0]["name"] == "Test"


@pytest.mark.asyncio
async def test_get_existing(temp_storage):
    cell = {"id": "test-2", "name": "Test 2", "language": "python", "script": ""}
    await temp_storage.save(cell)
    result = await temp_storage.get("test-2")
    assert result is not None
    assert result["name"] == "Test 2"


@pytest.mark.asyncio
async def test_get_nonexistent(temp_storage):
    result = await temp_storage.get("nonexistent")
    assert result is None


@pytest.mark.asyncio
async def test_delete(temp_storage):
    cell = {"id": "test-3", "name": "To Delete", "language": "python", "script": ""}
    await temp_storage.save(cell)
    await temp_storage.delete("test-3")
    cells = await temp_storage.list()
    assert len(cells) == 0


@pytest.mark.asyncio
async def test_save_updates_existing(temp_storage):
    cell = {"id": "test-4", "name": "Original", "language": "python", "script": ""}
    await temp_storage.save(cell)
    cell["name"] = "Updated"
    await temp_storage.save(cell)
    result = await temp_storage.get("test-4")
    assert result["name"] == "Updated"


@pytest.mark.asyncio
async def test_migrate_legacy_cells(temp_storage):
    cell = {"id": "test-5", "name": "Legacy", "script": "console.log('old')"}
    await temp_storage.save(cell)
    cells = await temp_storage.list()
    assert cells[0].get("language") == "python"


# ── Debounce and flush tests ──


@pytest.mark.asyncio
async def test_save_debounces_multiple_writes(temp_storage):
    """Multiple rapid saves to the same cell coalesce into one flush."""
    for i in range(5):
        await temp_storage.save({"id": "deb-1", "name": f"v{i}", "language": "python", "script": ""})

    # Before flush, list() returns latest pending version
    cells = await temp_storage.list()
    assert len(cells) == 1
    assert cells[0]["name"] == "v4"

    # Disk should still be empty (or old) — flush hasn't happened yet
    disk_cells = _read_cells_sync()
    assert disk_cells == [] or disk_cells[0].get("name") != "v4"

    # Force flush
    await temp_storage.flush()
    disk_cells = _read_cells_sync()
    assert len(disk_cells) == 1
    assert disk_cells[0]["name"] == "v4"


@pytest.mark.asyncio
async def test_flush_writes_all_pending(temp_storage):
    """Flush persists all pending saves and deletes."""
    await temp_storage.save({"id": "a", "name": "A", "language": "python"})
    await temp_storage.save({"id": "b", "name": "B", "language": "python"})
    await temp_storage.save({"id": "c", "name": "C", "language": "python"})
    await temp_storage.delete("b")

    await temp_storage.flush()

    disk_cells = _read_cells_sync()
    ids = {c["id"] for c in disk_cells}
    assert ids == {"a", "c"}


@pytest.mark.asyncio
async def test_save_then_flush_then_list_consistent(temp_storage):
    """After flush, list() and disk agree."""
    await temp_storage.save({"id": "x", "name": "X", "language": "python"})
    await temp_storage.flush()

    cells = await temp_storage.list()
    disk_cells = _read_cells_sync()
    assert len(cells) == 1
    assert len(disk_cells) == 1
    assert cells[0]["id"] == disk_cells[0]["id"]


@pytest.mark.asyncio
async def test_get_returns_pending_before_flush(temp_storage):
    """get() sees pending saves even before they hit disk."""
    await temp_storage.save({"id": "p1", "name": "Pending", "language": "python"})
    result = await temp_storage.get("p1")
    assert result is not None
    assert result["name"] == "Pending"


@pytest.mark.asyncio
async def test_delete_without_flush_returns_none(temp_storage):
    """get() returns None after delete(), even before flush."""
    await temp_storage.save({"id": "d1", "name": "Gone", "language": "python"})
    await temp_storage.delete("d1")
    result = await temp_storage.get("d1")
    assert result is None


@pytest.mark.asyncio
async def test_debounce_timer_coalesces(monkeypatch):
    """The debounce timer fires only once for multiple rapid saves."""
    tmp = tempfile.mkdtemp()
    monkeypatch.setattr("storage.file_storage.DATA_DIR", tmp)
    monkeypatch.setattr("storage.file_storage.CELLS_FILE", os.path.join(tmp, "cells.json"))
    storage = FileStorageBackend()

    call_count = 0
    original = storage.flush

    async def counting_flush():
        nonlocal call_count
        call_count += 1
        await original()

    monkeypatch.setattr(storage, "flush", counting_flush)

    # Rapid saves — all within the 300ms window
    for i in range(20):
        await storage.save({"id": f"c{i}", "name": f"Cell {i}", "language": "python"})

    # Wait for debounce + flush
    await asyncio.sleep(0.5)

    # All 20 saves should produce exactly 1 flush call
    assert call_count == 1

    import shutil
    shutil.rmtree(tmp, ignore_errors=True)


@pytest.mark.asyncio
async def test_save_adds_updatedat(temp_storage):
    """save() stamps updatedAt even before flush."""
    cell = {"id": "ts", "name": "TS", "language": "python"}
    await temp_storage.save(cell)
    result = await temp_storage.get("ts")
    assert "updatedAt" in result
    assert result["updatedAt"] > 0


# ── Compact JSON tests ──


@pytest.mark.asyncio
async def test_json_compact_format(temp_storage):
    """Flushed JSON uses compact format (no indent, separators)."""
    import storage.file_storage as mod
    await temp_storage.save({"id": "compact", "name": "Compact Test", "language": "python", "script": "a=1"})
    await temp_storage.flush()

    with open(mod.CELLS_FILE, "r", encoding="utf-8") as f:
        raw = f.read()

    assert "\n  " not in raw  # no indentation
    assert ": " not in raw     # no space after colon (compact)
    assert raw.startswith("[")  # valid JSON array


@pytest.mark.asyncio
async def test_compact_json_is_valid_json(temp_storage):
    """Compact output is still valid, parseable JSON."""
    import storage.file_storage as mod
    await temp_storage.save({"id": "j1", "name": "JSON", "language": "python"})
    await temp_storage.flush()

    with open(mod.CELLS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    assert isinstance(data, list)
    assert data[0]["id"] == "j1"


# ── Concurrency tests ──


@pytest.mark.asyncio
async def test_concurrent_saves_all_persisted(temp_storage):
    """All concurrent saves across different cells are persisted after flush."""
    async def save_cell(i):
        await temp_storage.save({"id": f"concurrent-{i}", "name": f"C{i}", "language": "python"})

    await asyncio.gather(*(save_cell(i) for i in range(50)))

    await temp_storage.flush()
    disk_cells = _read_cells_sync()
    assert len(disk_cells) == 50


@pytest.mark.asyncio
async def test_save_and_delete_race_resolves_to_delete(temp_storage):
    """When save and delete race, the last operation (delete) wins."""
    await temp_storage.save({"id": "race", "name": "Racer", "language": "python"})
    await temp_storage.delete("race")

    result = await temp_storage.get("race")
    assert result is None

    await temp_storage.flush()
    disk_cells = _read_cells_sync()
    assert len(disk_cells) == 0


@pytest.mark.asyncio
async def test_delete_then_save_same_cell(temp_storage):
    """Delete followed by save of the same cell keeps it."""
    await temp_storage.save({"id": "reborn", "name": "First", "language": "python"})
    await temp_storage.delete("reborn")
    await temp_storage.save({"id": "reborn", "name": "Second", "language": "python"})

    result = await temp_storage.get("reborn")
    assert result is not None
    assert result["name"] == "Second"


# ── Sync helper tests ──


def test_read_cells_sync_empty_dir(monkeypatch, tmp_path):
    import storage.file_storage as mod
    monkeypatch.setattr(mod, "CELLS_FILE", str(tmp_path / "nonexistent.json"))
    cells = mod._read_cells_sync()
    assert cells == []


def test_write_read_roundtrip_sync(monkeypatch, tmp_path):
    import storage.file_storage as mod
    cell_file = str(tmp_path / "cells.json")
    monkeypatch.setattr(mod, "CELLS_FILE", cell_file)
    monkeypatch.setattr(mod, "DATA_DIR", str(tmp_path))

    cells = [{"id": "rt", "name": "Roundtrip", "language": "python"}]
    mod._write_cells_sync(cells)

    read_back = mod._read_cells_sync()
    assert len(read_back) == 1
    assert read_back[0]["id"] == "rt"
