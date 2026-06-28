"""Dashaws Python Server — FastAPI backend with Python script execution."""
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from api.routes import router as api_router
from api.state import init_server, scheduler, cells, server_queues, server_event_topics, server_crons


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
    yield
    print("Shutting down...")
    if scheduler:
        await scheduler.shutdown()


app = FastAPI(
    title="Dashaws Python Server",
    lifespan=lifespan,
)

# Security headers
@app.middleware("http")
async def add_security_headers(request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


# API routes
app.include_router(api_router, prefix="/api")

# Serve SPA static files
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
