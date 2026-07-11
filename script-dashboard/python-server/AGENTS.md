# AGENTS.md — Dashaws Python Server

FastAPI backend with sandboxed Python script execution.

## Commands

| Purpose   | Command                                                       |
|-----------|---------------------------------------------------------------|
| Lint      | `ruff check script-dashboard/python-server`                   |
| Typecheck | `pyright script-dashboard/python-server`                      |
| Test      | `pytest script-dashboard/python-server/tests/ -q`             |

## CRITICAL RULES

1. **AFTER EVERY CODE CHANGE** — run all applicable checks:
   ```
   ruff check script-dashboard/python-server
   if ($?) { pyright script-dashboard/python-server }
   if ($?) { pytest script-dashboard/python-server/tests/ -q }
   ```

2. **NEVER modify existing test files.** Files never to touch:
   - `tests/test_*.py`
   - `tests/conftest.py`

3. **ALWAYS create new tests** for features or fixes:
   - Naming: `tests/test_feature.py`
   - Use `pytest.mark.asyncio` for async tests
   - Import from `sandbox.*`, `api.*`, `storage.*` as needed

## Key files

| File | Purpose |
|------|---------|
| `sandbox/globals.py` | Sandbox globals: queue, pubsub, console, state, env, secrets, props, print, requests |
| `sandbox/executor.py` | `execute_script()` — runs user code via `exec()` in `asyncio.to_thread()` |
| `sandbox/scheduler.py` | `ServerScheduler` — interval, cron, queue polling, pubsub dispatch |
| `api/routes.py` | FastAPI router: cells, queues, topics, crons, env, secrets, auth |
| `api/state.py` | Shared state: `server_queues`, `server_event_topics`, `server_crons`, `init_server()` |
| `storage/file_storage.py` | JSON file persistence for cells |
| `crypto/secrets.py` | AES encryption for secrets |
| `main.py` | FastAPI app with lifespan, auth middleware, SPA mounting |

## Key patterns

- **Sandbox execution**: `execute_script()` compiles code → `asyncio.to_thread(exec, ...)`.
  User scripts run in a **separate OS thread**. The event loop stays free.
- **Queue enqueue**: Uses **callback** pattern (not HTTP) — `enqueue_fn` directly pushes to `server_queues[name]["messages"]`.
  Defined in `scheduler._make_enqueue_fn()`.
- **PubSub emit**: Uses `loop.call_soon_threadsafe()` to schedule `on_emit` on the event loop.
  Defined in `scheduler._make_emit_fn()`. Necessary because `on_emit` calls `asyncio.create_task()`.
- **State is shared via dict references**: `get_data()` returns `server_queues`, `server_event_topics`, `server_crons` by reference.
  Both the scheduler and route handlers mutate them in-place.
- **Thread safety**: Python GIL makes individual dict operations safe, but avoid iterating while modifying from another thread.
- **Auth**: Optional password via `dashaws.config.json`. Checked by middleware in `main.py`.
  Port defaults to `3456`, tests use `3457`.

## Testing

All tests use `pytest-asyncio` for async endpoint/storage tests.
`conftest.py` sets `DASHAWS_DATA_DIR` to a temp directory and `PORT=3457`.

## Style

- Python 3.12.3+ with modern syntax: `str | None`, `dict[str, Any]` over `typing` equivalents
- f-strings over `.format()`
- No comments unless explicitly asked
