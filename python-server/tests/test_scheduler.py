"""Tests for the async scheduler."""
import asyncio
import pytest
from sandbox.scheduler import ServerScheduler, cron_matches


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
async def test_run_once_executes_cell():
    results = []

    cells = {"cell-1": make_cell("cell-1", script='state["ran"] = True')}

    scheduler = ServerScheduler(
        get_cell=lambda id: cells.get(id),
        on_result=lambda id, result: results.append((id, result)),
        get_env=lambda: {"env": {}, "secrets": set(), "secretsObj": {}},
        get_data=lambda: {"queues": {}, "eventTopics": {}, "crons": []},
        on_emit=lambda name, body: None,
    )

    result = await scheduler.run_once("cell-1")
    assert result is not None
    assert result["success"] is True
    assert len(results) == 1
    await scheduler.shutdown()


@pytest.mark.asyncio
async def test_run_once_nonexistent():
    scheduler = ServerScheduler(
        get_cell=lambda id: None,
        on_result=lambda id, result: None,
        get_env=lambda: {"env": {}, "secrets": set(), "secretsObj": {}},
        get_data=lambda: {"queues": {}, "eventTopics": {}, "crons": []},
        on_emit=lambda name, body: None,
    )

    result = await scheduler.run_once("nonexistent")
    assert result is None
    await scheduler.shutdown()


@pytest.mark.asyncio
async def test_start_and_stop():
    results = []
    cells = {"cell-1": make_cell("cell-1", intervalMs=100, enabled=True,
                                  script='state["counter"] = state.get("counter", 0) + 1',
                                  state={"counter": 0})}

    scheduler = ServerScheduler(
        get_cell=lambda id: cells.get(id),
        on_result=lambda id, result: results.append((id, result)),
        get_env=lambda: {"env": {}, "secrets": set(), "secretsObj": {}},
        get_data=lambda: {"queues": {}, "eventTopics": {}, "crons": []},
        on_emit=lambda name, body: None,
    )

    await scheduler.start("cell-1")
    assert scheduler.is_running("cell-1")
    await asyncio.sleep(0.15)
    await scheduler.stop("cell-1")
    assert not scheduler.is_running("cell-1")

    count_after_stop = len(results)
    await asyncio.sleep(0.2)
    assert len(results) == count_after_stop
    await scheduler.shutdown()


@pytest.mark.asyncio
async def test_stop_all():
    cells = {
        "cell-1": make_cell("cell-1", enabled=True),
        "cell-2": make_cell("cell-2", enabled=True),
    }

    scheduler = ServerScheduler(
        get_cell=lambda id: cells.get(id),
        on_result=lambda id, result: None,
        get_env=lambda: {"env": {}, "secrets": set(), "secretsObj": {}},
        get_data=lambda: {"queues": {}, "eventTopics": {}, "crons": []},
        on_emit=lambda name, body: None,
    )

    await scheduler.start("cell-1")
    await scheduler.start("cell-2")
    assert scheduler.is_running("cell-1")
    assert scheduler.is_running("cell-2")

    await scheduler.stop_all()
    assert not scheduler.is_running("cell-1")
    assert not scheduler.is_running("cell-2")
    await scheduler.shutdown()


@pytest.mark.asyncio
async def test_restart():
    results = []
    cells = {"cell-1": make_cell("cell-1", enabled=True, intervalMs=200)}

    scheduler = ServerScheduler(
        get_cell=lambda id: cells.get(id),
        on_result=lambda id, result: results.append((id, result)),
        get_env=lambda: {"env": {}, "secrets": set(), "secretsObj": {}},
        get_data=lambda: {"queues": {}, "eventTopics": {}, "crons": []},
        on_emit=lambda name, body: None,
    )

    await scheduler.start("cell-1")
    await asyncio.sleep(0.1)
    assert len(results) >= 1

    await scheduler.restart("cell-1")
    assert scheduler.is_running("cell-1")
    await scheduler.shutdown()


def test_cron_matches_wildcard():
    assert cron_matches("* * * * *", 1000000000000) is True


def test_cron_matches_specific_minute():
    # Timestamp where minute=30  (2025-01-01 12:30:00 UTC approx)
    from datetime import datetime, timezone
    dt = datetime(2025, 1, 1, 12, 30, 0, tzinfo=timezone.utc)
    ts = dt.timestamp() * 1000
    assert cron_matches("30 * * * *", ts) is True
    assert cron_matches("31 * * * *", ts) is False


def test_cron_matches_day_of_week():
    # 2025-01-01 was a Wednesday (3)
    from datetime import datetime, timezone
    dt = datetime(2025, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
    ts = dt.timestamp() * 1000
    assert cron_matches("* * * * 3", ts) is True
    assert cron_matches("* * * * 0", ts) is False
