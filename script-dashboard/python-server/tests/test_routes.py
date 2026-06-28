"""Integration tests for API routes."""
import os
import tempfile
import pytest
import asyncio
from httpx import ASGITransport, AsyncClient

os.environ.setdefault("DASHAWS_DATA_DIR", tempfile.mkdtemp())
os.environ.setdefault("PORT", "3457")


@pytest.fixture(scope="module")
def init_module():
    """Initialize the server before any tests in this module."""
    from api.state import init_server
    loop = asyncio.new_event_loop()
    loop.run_until_complete(init_server())
    yield
    from api.state import scheduler
    if scheduler:
        loop.run_until_complete(scheduler.shutdown())
    loop.close()


from main import app


@pytest.mark.asyncio
async def test_health(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True


@pytest.mark.asyncio
async def test_languages(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/languages")
        assert resp.status_code == 200
        assert "python" in resp.json()


@pytest.mark.asyncio
async def test_crud_cell(init_module):
    cell_id = "test-crud-001"
    cell = {
        "id": cell_id, "name": "Test", "language": "python",
        "script": 'console.log("ok")', "intervalMs": 10000, "enabled": False,
        "lastRunAt": None, "status": "idle", "output": [], "state": {},
        "params": "{}", "createdAt": 0, "updatedAt": 0,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put("/api/cells/{}".format(cell_id), json=cell)
        assert resp.status_code == 200

        resp = await client.get("/api/cells/{}".format(cell_id))
        assert resp.status_code == 200
        assert resp.json()["name"] == "Test"

        resp = await client.delete("/api/cells/{}".format(cell_id))
        assert resp.status_code == 200

        resp = await client.get("/api/cells/{}".format(cell_id))
        assert resp.status_code == 404


@pytest.mark.asyncio
async def test_run_cell(init_module):
    cell_id = "test-run-001"
    cell = {
        "id": cell_id, "name": "RunTest", "language": "python",
        "script": 'state["x"] = 42', "intervalMs": 10000, "enabled": False,
        "lastRunAt": None, "status": "idle", "output": [], "state": {},
        "params": "{}", "createdAt": 0, "updatedAt": 0,
    }

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.put("/api/cells/{}".format(cell_id), json=cell)
        assert resp.status_code == 200

        resp = await client.post("/api/cells/{}/run".format(cell_id))
        assert resp.status_code == 200
        result = resp.json()
        assert result["success"] is True
        assert result["state"]["x"] == 42

        await client.delete("/api/cells/{}".format(cell_id))


@pytest.mark.asyncio
async def test_env(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.put("/api/env", json={"KEY": "val"})
        resp = await client.get("/api/env")
        assert resp.json()["KEY"] == "val"


@pytest.mark.asyncio
async def test_queues_topics_crons(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.put("/api/queues", json={"q1": {"name": "q1", "maxRetries": 3, "subscriberIds": [], "messages": []}})
        resp = await client.get("/api/queues")
        assert "q1" in resp.json()

        await client.put("/api/topics", json={"t1": {"name": "t1", "subscriberIds": []}})
        resp = await client.get("/api/topics")
        assert "t1" in resp.json()

        resp = await client.put("/api/crons", json=[{"name": "c1", "expression": "* * * * *", "target": {"type": "queue", "name": "q1"}, "payload": "{}", "enabled": False, "lastRunAt": None}])
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_secrets(init_module):
    from crypto.secrets import encrypt_secrets

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        blob = encrypt_secrets({"K": "v"}, "pw")
        await client.put("/api/secrets", json=blob)
        resp = await client.get("/api/secrets/status")
        assert resp.json()["hasBlob"] is True

        resp = await client.post("/api/secrets/unlock", json={"password": "pw"})
        assert resp.status_code == 200

        resp = await client.get("/api/secrets/status")
        assert resp.json()["unlocked"] is True
