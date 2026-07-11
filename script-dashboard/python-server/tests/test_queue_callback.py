"""Tests for the queue enqueue callback mechanism."""
import pytest
from sandbox.executor import execute_script


@pytest.mark.asyncio
async def test_enqueue_fn_adds_to_queue():
    queues: dict = {}

    def enqueue(name, body):
        if name not in queues:
            queues[name] = {"name": name, "messages": []}
        queues[name]["messages"].append({"body": body})

    enqueue("my-queue", '{"task": "send"}')
    assert "my-queue" in queues
    assert len(queues["my-queue"]["messages"]) == 1
    assert queues["my-queue"]["messages"][0]["body"] == '{"task": "send"}'


@pytest.mark.asyncio
async def test_enqueue_fn_creates_queue():
    queues: dict = {}

    def enqueue(name, body):
        if name not in queues:
            queues[name] = {"name": name, "messages": []}
        queues[name]["messages"].append({"body": body})

    enqueue("new-queue", "test message")
    assert "new-queue" in queues


@pytest.mark.asyncio
async def test_queue_enqueue_from_sandbox():
    queue_messages: list = []

    def enqueue(name, body):
        queue_messages.append({"name": name, "body": body})

    result = await execute_script(
        'queue.enqueue("orders", {"item": "widget", "qty": 5})',
        {}, {}, {}, {}, enqueue, lambda *a: None,
    )
    assert result["success"] is True
    assert len(queue_messages) == 1
    assert queue_messages[0]["name"] == "orders"
    assert '"item"' in queue_messages[0]["body"]


@pytest.mark.asyncio
async def test_queue_enqueue_string_body():
    queue_messages: list = []

    def enqueue(name, body):
        queue_messages.append(body)

    result = await execute_script(
        'queue.enqueue("logs", "raw log text")',
        {}, {}, {}, {}, enqueue, lambda *a: None,
    )
    assert result["success"] is True
    assert queue_messages[0] == "raw log text"
