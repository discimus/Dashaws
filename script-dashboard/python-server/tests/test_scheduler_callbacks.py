"""Tests for scheduler-created enqueue and emit callbacks."""
import asyncio
import pytest
from sandbox.scheduler import ServerScheduler


def make_cell(id: str, **overrides):
    cell = {
        "id": id,
        "name": "Cell " + id,
        "language": "python",
        "script": 'console.log("ok")',
        "intervalMs": 1000,
        "enabled": False,
        "lastRunAt": None,
        "status": "idle",
        "output": [],
        "state": {},
        "params": "{}",
        "createdAt": 0,
        "updatedAt": 0,
    }
    cell.update(overrides)
    return cell


@pytest.mark.asyncio
async def test_make_enqueue_fn_modifies_shared_dict():
    queues: dict = {}

    def get_data():
        return {"queues": queues, "eventTopics": {}, "crons": []}

    scheduler = ServerScheduler(
        get_cell=lambda id: None,
        on_result=None,
        get_env=lambda: {"env": {}, "secrets": set(), "secretsObj": {}},
        get_data=get_data,
        on_emit=lambda n, b: None,
    )
    enqueue_fn = scheduler._make_enqueue_fn()
    enqueue_fn("test-q", '{"msg": "hello"}')

    assert "test-q" in queues
    assert len(queues["test-q"]["messages"]) == 1
    assert queues["test-q"]["messages"][0]["body"] == '{"msg": "hello"}'
    await scheduler.shutdown()


@pytest.mark.asyncio
async def test_make_emit_fn_schedules_on_loop():
    emitted: list = []

    def on_emit(name, body):
        emitted.append((name, body))

    scheduler = ServerScheduler(
        get_cell=lambda id: None,
        on_result=None,
        get_env=lambda: {"env": {}, "secrets": set(), "secretsObj": {}},
        get_data=lambda: {"queues": {}, "eventTopics": {}, "crons": []},
        on_emit=on_emit,
    )
    emit_fn = scheduler._make_emit_fn()
    emit_fn("topic-x", '{"key": "val"}')

    await asyncio.sleep(0.1)
    assert len(emitted) == 1
    assert emitted[0] == ("topic-x", '{"key": "val"}')
    await scheduler.shutdown()


@pytest.mark.asyncio
async def test_run_once_passes_callbacks_to_executor():
    queues: dict = {
        "my-q": {
            "name": "my-q",
            "messages": [],
            "maxRetries": 3,
            "subscriberIds": [],
        }
    }

    def get_data():
        return {"queues": queues, "eventTopics": {}, "crons": []}

    cells = {
        "cell-1": make_cell("cell-1", script='queue.enqueue("my-q", {"ran": True})')
    }
    scheduler = ServerScheduler(
        get_cell=lambda id: cells.get(id),
        on_result=lambda id, r: None,
        get_env=lambda: {"env": {}, "secrets": set(), "secretsObj": {}},
        get_data=get_data,
        on_emit=lambda n, b: None,
    )
    result = await scheduler.run_once("cell-1")
    assert result["success"] is True
    assert len(queues["my-q"]["messages"]) == 1
    await scheduler.shutdown()
