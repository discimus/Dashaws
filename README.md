# Dashaws

ℹ️ Disclosure: This application was developed using AI (vibecoding).

Dual-runtime local script scheduling dashboard — **JavaScript** (Node.js + Browser) and **Python** (FastAPI). React SPA frontend.

> **For AI agents:** read `AGENTS.md` files instead of this document for concise, token-efficient guidance.

## Quick Start

```bash
# JavaScript server (Node.js)
./start-server.sh node

# Python server (FastAPI)
./start-server.sh python

# Frontend only (browser sandbox, JS-only)
cd script-dashboard && npm run dev
```

Port: `3456` (server) or `5173` (Vite dev). The start scripts handle all preflight: Python venv, npm install, frontend build.

---

## JavaScript Runtime

### Sandbox Globals

| Global | Type | Description |
|--------|------|-------------|
| `$state` | `Record<string, unknown>` | Persisted mutable state across runs |
| `$env` | `Record<string, string>` | Environment variables |
| `$secrets` | `Record<string, string>` | AES-GCM encrypted secrets (masked in logs) |
| `$props` | `Record<string, unknown>` | Params from gear icon, queue, or pubsub |
| `$queue` | `{ enqueue }` | Push to FIFO queue → `$queue.enqueue(name, body)` |
| `$pubsub` | `{ emit }` | Broadcast event → `$pubsub.emit(name, body)` |
| `console` | Console API | `log`, `warn`, `error`, `info`, `table` |
| `fetch` | Web Fetch API | HTTP client |
| `loadPackage` | `(spec) => Promise<module>` | Import from esm.sh CDN (cached) |
| `setTimeout` | Tracked timer | Auto-cleaned on script end |
| `signal` | `AbortSignal` | Aborted on stop/timeout |

Blocked: `window`, `document`, `Function`, `eval`, `require`, `process`, `setInterval`, `clearInterval`, `globalThis`.

### Server Mode (Node.js)

```
./start-server.sh node
```

Express server. Data persists in `data-nodejs/` directory. SPA served from `dist/`.

---

## Python Runtime

### Sandbox Globals

| Global | Type | Description |
|--------|------|-------------|
| `state` | `dict` | Persisted mutable state — `state["key"]`, `state.get("key", default)` |
| `env` | `dict[str, str]` | Environment variables |
| `secrets` | `dict[str, str]` | AES-GCM encrypted (masked in logs) |
| `props` | `dict` | From params, queue, or pubsub |
| `queue` | `{ enqueue }` | `queue.enqueue(name, body)` |
| `pubsub` | `{ emit }` | `pubsub.emit(name, body)` |
| `console` | Console API | `log`, `warn`, `error`, `info`, `table` |
| `print` | Builtin | Captured per-script output |
| `requests` | Module | Full Python HTTP client |

Blocked modules: `subprocess`, `shutil`, `socket`, `ctypes`, `multiprocessing`, `pickle`, `tempfile`, and others. `open()` restricted to `/tmp` and data directory.

### Available Python Libraries

| Category | Libraries |
|----------|-----------|
| Web & HTTP | `requests`, `beautifulsoup4`, `feedparser`, `xmltodict`, `lxml` |
| Data | `pandas`, `numpy`, `openpyxl`, `pypdf`, `pyyaml`, `python-dotenv` |
| Databases | `sqlalchemy`, `psycopg2`, `pymssql`, `pyodbc` |
| Charts | `matplotlib`, `pillow` |

### Server Mode (FastAPI)

```
./start-server.sh python
```

Runs on port `3456`. Data persists in `data-python/`. SPA served from `dist/`.

---

## Development

| Command | What it does |
|---------|-------------|
| `npm run dev` | Vite HMR dev server (JS-only, port 5173) |
| `npm run build:all` | Build frontend + server |
| `npm run test:run` | Vitest (JS/TS tests) |
| `pytest python-server/tests/ -q` | Pytest (Python tests) |
| `npx tsc --noEmit --project tsconfig.app.json` | Typecheck app |
| `npx tsc --noEmit -p server/tsconfig.json` | Typecheck server |
| `ruff check script-dashboard/python-server` | Python lint |
| `pyright script-dashboard/python-server` | Python typecheck |

### Data Directories

```
script-dashboard/
├── data-nodejs/       # Node.js runtime data
│   ├── cells.json
│   ├── env.json
│   ├── secrets.enc.json
│   ├── queues.json
│   ├── topics.json
│   └── crons.json
└── data-python/       # Python runtime data
    └── (same layout)
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/cells` | List all cells |
| `POST` | `/api/cells` | Create cell |
| `PUT` | `/api/cells/:id` | Update cell |
| `DELETE` | `/api/cells/:id` | Delete cell |
| `POST` | `/api/cells/:id/run` | Run cell once |
| `POST` | `/api/cells/:id/start` | Start interval loop |
| `POST` | `/api/cells/:id/stop` | Stop interval loop |
| `POST` | `/api/cells/:id/clear` | Clear output |
| `GET` `/PUT` | `/api/env` | Environment variables |
| `GET` `/PUT` | `/api/secrets` | Secrets (encrypted) |
| `POST` | `/api/secrets/unlock` | Unlock secrets with password |
| `GET` `/PUT` | `/api/queues` | Queue management |
| `GET` `/PUT` | `/api/topics` | PubSub topic management |
| `POST` | `/api/topics/:name/emit` | Emit event to topic |
| `GET` `/PUT` | `/api/crons` | Cron job management |
| `POST` | `/api/crons/:name/run` | Run cron now |
| `GET` | `/api/health` | Health check |
| `POST` | `/api/auth/login` | Login |
| `GET` | `/api/auth/status` | Auth status |
| `POST` | `/api/auth/logout` | Logout |

---

## Security

- **JavaScript sandbox**: Blocked globals + constructor chain stripping + secret masking
- **Python sandbox**: Blocked modules + restricted `open()`/`__import__` + secret masking
- **Secrets**: AES-GCM 256-bit + PBKDF2 key derivation (200k iterations)
- **Headers**: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`

## Limitations

- Single-user, no multi-tenancy
- No WebSocket real-time updates (dashboard polls periodically)
- Python execution is single-threaded per script (GIL)
- Queue delivery has ~2s polling latency
- No Python OS-level isolation (relies on import blocking and restricted `open()`)
