"""Tests for the pubsub emit callback mechanism."""
import pytest
from sandbox.executor import execute_script


@pytest.mark.asyncio
async def test_emit_fn_calls_callback():
    emitted: list = []

    def emit(name, body):
        emitted.append({"name": name, "body": body})

    emit("my-topic", '{"event": "deploy"}')
    assert len(emitted) == 1
    assert emitted[0]["name"] == "my-topic"
    assert '"event"' in emitted[0]["body"]


@pytest.mark.asyncio
async def test_pubsub_emit_from_sandbox():
    emitted: list = []

    def emit(name, body):
        emitted.append({"name": name, "body": body})

    result = await execute_script(
        'pubsub.emit("alerts", {"type": "warning", "msg": "disk full"})',
        {}, {}, {}, {}, lambda *a: None, emit,
    )
    assert result["success"] is True
    assert len(emitted) == 1
    assert emitted[0]["name"] == "alerts"
    assert '"type"' in emitted[0]["body"]
