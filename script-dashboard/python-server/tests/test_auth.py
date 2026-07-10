"""Integration tests for authentication endpoints."""
import os
import tempfile
import pytest
import asyncio

os.environ.setdefault("DASHAWS_DATA_DIR", tempfile.mkdtemp())
os.environ.setdefault("PORT", "3457")

TEST_PASSWORD = "test-secret-123"

import main as main_module
from api.state import auth_enabled, valid_tokens


@pytest.fixture(autouse=True)
def enable_auth():
    main_module._server_password = TEST_PASSWORD
    auth_enabled["value"] = True
    main_module._failed_attempts.clear()
    valid_tokens.clear()
    yield
    auth_enabled["value"] = False
    main_module._failed_attempts.clear()
    valid_tokens.clear()


from httpx import ASGITransport, AsyncClient
from main import app


@pytest.fixture(scope="module")
def init_module():
    from api.state import init_server
    loop = asyncio.new_event_loop()
    loop.run_until_complete(init_server())
    yield
    from api.state import scheduler
    if scheduler:
        loop.run_until_complete(scheduler.shutdown())
    loop.close()


@pytest.mark.asyncio
async def test_health(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True


@pytest.mark.asyncio
async def test_auth_status(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/auth/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["authEnabled"] is True


@pytest.mark.asyncio
async def test_login_success(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/login",
            json={"password": TEST_PASSWORD},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert len(data["token"]) == 64

        cookies = resp.cookies
        assert "dashaws_token" in cookies


@pytest.mark.asyncio
async def test_login_wrong_password(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/login",
            json={"password": "wrong-password"},
        )
        assert resp.status_code == 401
        data = resp.json()
        assert "Invalid password" in data["error"]


@pytest.mark.asyncio
async def test_login_no_password(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/login",
            json={},
        )
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_verify_without_auth(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/auth/verify")
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_verify_with_token(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_resp = await client.post(
            "/api/auth/login",
            json={"password": TEST_PASSWORD},
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]

        resp = await client.get(
            "/api/auth/verify",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["authenticated"] is True


@pytest.mark.asyncio
async def test_verify_with_cookie(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_resp = await client.post(
            "/api/auth/login",
            json={"password": TEST_PASSWORD},
        )
        cookie_token = login_resp.cookies.get("dashaws_token")
        assert cookie_token is not None

        transport2 = ASGITransport(app=app)
        async with AsyncClient(transport=transport2, base_url="http://test",
                              cookies={"dashaws_token": cookie_token}) as client2:
            resp = await client2.get("/api/auth/verify")
            assert resp.status_code == 200


@pytest.mark.asyncio
async def test_verify_invalid_token(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get(
            "/api/auth/verify",
            headers={"Authorization": "Bearer fake-token-12345678"},
        )
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_invalidates_token(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_resp = await client.post(
            "/api/auth/login",
            json={"password": TEST_PASSWORD},
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]

        logout_resp = await client.post(
            "/api/auth/logout",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert logout_resp.status_code == 200
        assert logout_resp.json()["ok"] is True

        set_cookie = logout_resp.headers.get("set-cookie", "")
        assert "dashaws_token=" in set_cookie

        verify_resp = await client.get(
            "/api/auth/verify",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert verify_resp.status_code == 401


@pytest.mark.asyncio
async def test_logout_with_cookie(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_resp = await client.post(
            "/api/auth/login",
            json={"password": TEST_PASSWORD},
        )
        cookie_token = login_resp.cookies.get("dashaws_token")
        assert cookie_token is not None

        transport2 = ASGITransport(app=app)
        async with AsyncClient(transport=transport2, base_url="http://test",
                              cookies={"dashaws_token": cookie_token}) as client2:
            logout_resp = await client2.post("/api/auth/logout")
            assert logout_resp.status_code == 200


@pytest.mark.asyncio
async def test_protected_endpoint_without_auth(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.get("/api/cells")
        assert resp.status_code == 401


@pytest.mark.asyncio
async def test_protected_endpoint_with_token(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        login_resp = await client.post(
            "/api/auth/login",
            json={"password": TEST_PASSWORD},
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["token"]

        resp = await client.get(
            "/api/cells",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_rate_limiting(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp1 = await client.post(
            "/api/auth/login",
            json={"password": "wrong"},
        )
        assert resp1.status_code == 401

        resp2 = await client.post(
            "/api/auth/login",
            json={"password": TEST_PASSWORD},
        )
        assert resp2.status_code == 429
        data = resp2.json()
        assert data["retryAfter"] > 0
        assert data["attempts"] == 1


@pytest.mark.asyncio
async def test_login_clears_rate_limit(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/api/auth/login",
            json={"password": "wrong"},
        )
        await asyncio.sleep(1.1)

        resp = await client.post(
            "/api/auth/login",
            json={"password": TEST_PASSWORD},
        )
        assert resp.status_code == 200


@pytest.mark.asyncio
async def test_cookie_httponly(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/login",
            json={"password": TEST_PASSWORD},
        )
        set_cookie = resp.headers.get("set-cookie", "")
        assert "httponly" in set_cookie.lower()


@pytest.mark.asyncio
async def test_cookie_samesite_strict(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/login",
            json={"password": TEST_PASSWORD},
        )
        set_cookie = resp.headers.get("set-cookie", "")
        assert "samesite=strict" in set_cookie.lower()


@pytest.mark.asyncio
async def test_cookie_max_age(init_module):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        resp = await client.post(
            "/api/auth/login",
            json={"password": TEST_PASSWORD},
        )
        set_cookie = resp.headers.get("set-cookie", "")
        assert "max-age=86400" in set_cookie.lower()
