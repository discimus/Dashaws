"""Dashaws Python Server — FastAPI backend with Python script execution."""
import os
import json
import secrets
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, Body
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse

from api.routes import router as api_router
from api.state import init_server, scheduler, cells, server_queues, server_event_topics, server_crons, flush_all, auth_enabled, valid_tokens

COOKIE_NAME = "dashaws_token"
TOKEN_MAX_AGE_S = 24 * 60 * 60

_server_dir = os.path.dirname(os.path.abspath(__file__))
_root_dir = os.path.dirname(_server_dir)
_config_paths = [
    os.path.join(_root_dir, "dashaws.config.json"),
    os.path.join(os.getcwd(), "dashaws.config.json"),
    os.path.join(os.getcwd(), "..", "dashaws.config.json"),
]
_server_password = None

for _p in _config_paths:
    try:
        if os.path.exists(_p):
            with open(_p, "r", encoding="utf-8") as f:
                config = json.load(f)
            _server_password = config.get("password")
            if _server_password:
                auth_enabled["value"] = True
                print("[auth] Password loaded from config file")
                break
    except Exception:
        pass

if not _server_password:
    print("[auth] No password configured — authentication disabled")

_failed_attempts: dict = {}

import asyncio


def _get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"


def _calculate_backoff(count: int) -> float:
    return min(2 ** (count - 1), 300) * 1000


def _check_rate_limit(ip: str) -> float | None:
    entry = _failed_attempts.get(ip)
    if not entry:
        return None

    backoff_ms = _calculate_backoff(entry["count"])
    elapsed = (time.time() * 1000) - entry["lastAttempt"]

    if elapsed < backoff_ms:
        return backoff_ms - elapsed

    return None


def _record_failed_attempt(ip: str) -> None:
    if ip in _failed_attempts:
        _failed_attempts[ip]["count"] += 1
        _failed_attempts[ip]["lastAttempt"] = time.time() * 1000
    else:
        _failed_attempts[ip] = {
            "count": 1,
            "lastAttempt": time.time() * 1000,
            "firstAttempt": time.time() * 1000,
        }


def _clear_failed_attempts(ip: str) -> None:
    _failed_attempts.pop(ip, None)


def _extract_token(request: Request) -> str | None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        return auth_header[7:]

    return request.cookies.get(COOKIE_NAME)


def _set_auth_cookie(response: JSONResponse, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        samesite="strict",
        path="/",
        max_age=TOKEN_MAX_AGE_S,
    )


def _clear_auth_cookie(response: JSONResponse) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")


async def _cleanup_old_attempts():
    while True:
        await asyncio.sleep(60)
        cutoff = time.time() * 1000 - 10 * 60 * 1000
        for ip in list(_failed_attempts.keys()):
            if _failed_attempts[ip]["firstAttempt"] < cutoff:
                del _failed_attempts[ip]


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Initializing server...")
    await init_server()

    PORT = int(os.environ.get("PORT", "3456"))
    print("Server running at http://localhost:{}".format(PORT))
    print("Cells: {}, Queues: {}, Topics: {}, Crons: {}".format(
        len(cells),
        len(server_queues),
        len(server_event_topics),
        len(server_crons),
    ))

    cleanup_task = asyncio.create_task(_cleanup_old_attempts())

    yield

    cleanup_task.cancel()
    try:
        await cleanup_task
    except asyncio.CancelledError:
        pass

    print("Shutting down...")
    if scheduler:
        await scheduler.shutdown()
    await flush_all()
    print("Shutdown complete.")


app = FastAPI(
    title="Dashaws Python Server",
    lifespan=lifespan,
)


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if not request.url.path.startswith("/api/"):
        return await call_next(request)

    if request.url.path in ("/api/health", "/api/auth/login", "/api/auth/status"):
        return await call_next(request)

    if not auth_enabled.get("value", False):
        return await call_next(request)

    token = _extract_token(request)
    if not token or token not in valid_tokens:
        return JSONResponse(status_code=401, content={"error": "Authentication required"})

    return await call_next(request)


@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


app.include_router(api_router, prefix="/api")


@app.post("/api/auth/login")
async def auth_login(body: dict = Body(...), request: Request = None):
    if not auth_enabled.get("value", False):
        return {"token": "no-auth-required"}

    ip = _get_client_ip(request) if request else "127.0.0.1"

    retry_after = _check_rate_limit(ip)
    if retry_after is not None:
        return JSONResponse(
            status_code=429,
            content={
                "error": "Too many attempts. Please wait.",
                "retryAfter": int(retry_after),
                "attempts": _failed_attempts[ip]["count"],
            },
        )

    password = body.get("password")
    if not password or password != _server_password:
        _record_failed_attempt(ip)
        attempts = _failed_attempts[ip]["count"]
        return JSONResponse(
            status_code=401,
            content={"error": "Invalid password", "attempts": attempts},
        )

    _clear_failed_attempts(ip)

    token = secrets.token_hex(32)
    valid_tokens.add(token)

    response = JSONResponse(content={"token": token})
    _set_auth_cookie(response, token)
    return response


@app.get("/api/auth/status")
async def auth_status():
    return {"authEnabled": auth_enabled.get("value", False)}


@app.get("/api/auth/verify")
async def auth_verify():
    return {"authenticated": True}


@app.post("/api/auth/logout")
async def auth_logout(request: Request):
    token = _extract_token(request)
    if token:
        valid_tokens.discard(token)
    response = JSONResponse(content={"ok": True})
    _clear_auth_cookie(response)
    return response


dist_path = os.path.join(os.getcwd(), "dist")
if os.path.exists(dist_path):
    try:
        app.mount("/assets", StaticFiles(directory=os.path.join(dist_path, "assets")), name="assets")
    except RuntimeError:
        pass
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")
else:
    @app.get("/")
    async def no_spa():
        return {"message": "SPA not built. Run: npm run build"}


if __name__ == "__main__":
    import uvicorn
    PORT = int(os.environ.get("PORT", "3456"))
    uvicorn.run(app, host="0.0.0.0", port=PORT)
