"""Tests for file storage backend."""
import os
import json
import tempfile
import pytest
from storage.file_storage import FileStorageBackend, DATA_DIR, CELLS_FILE


@pytest.fixture
def temp_storage(monkeypatch):
    tmp = tempfile.mkdtemp()
    monkeypatch.setattr("storage.file_storage.DATA_DIR", tmp)
    monkeypatch.setattr("storage.file_storage.CELLS_FILE", os.path.join(tmp, "cells.json"))
    storage = FileStorageBackend()
    yield storage
    import shutil
    shutil.rmtree(tmp, ignore_errors=True)


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
