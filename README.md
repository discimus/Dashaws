# Dashaws

⚠️ Warning: This application was developed using AI (vibecoding).

A local-first dashboard for scheduling and executing user-defined scripts (JavaScript or Python) on intervals, cron expressions, queues, and pub/sub events. Supports standalone browser mode (JS only) and optional server mode with dual-runtime support (Node.js and Python/FastAPI).

## Features

- **Dual runtime** — JavaScript (Node.js / browser) and Python (FastAPI server), each fully isolated
- **Sandboxed execution** — JS runs in `new Function()` with strict mode; Python runs via `exec()` with controlled globals
- **Scheduler** — Configurable intervals (ms), cron expressions, queue consumers, and pub/sub subscribers
- **Inter-script communication** — `$queue.enqueue`, `$pubsub.emit` (JS) / `queue.enqueue`, `pubsub.emit` (Python)
- **Persistent state** — `$state` / `state` survives script restarts and restarts
- **Environment variables** — `$env.KEY` / `env["KEY"]` from the Environment tab
- **Encrypted secrets** — PBKDF2 (200k iterations, SHA-256) + AES-GCM 256-bit encryption at rest
- **CDN package loading** — `await loadPackage("lodash")` imports from esm.sh (JS only)
- **Rich Python libraries** — numpy, pandas, requests, beautifulsoup4, matplotlib, sqlalchemy, and more pre-installed
- **Background execution** — Server runs scripts continuously without a browser tab open
- **Keep-alive** — Wake Lock + silent audio oscillator to prevent browser timer throttling (browser mode)
- **Auto-start scripts** — `start-server.sh` and `start-server.ps1` with preflight checks (deps + build)

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18
- [Python](https://www.python.org/) >= 3.9.2 (only for Python server mode)

### Standalone (browser only, JavaScript)

```bash
cd script-dashboard
npm install
npm run dev
```

Open http://localhost:5173 — no server required. Scripts only run while the browser tab is open.

### With background server

```bash
# Node.js server
./start-server.sh node

# Python server
./start-server.sh python
```

Open http://localhost:3456 — scripts persist and execute continuously on the server.

The start scripts automatically check and install dependencies + build the frontend on first run.

## Project Structure

```
background-workers-v3/
├── start-server.sh          # Unix startup script (node|python)
├── start-server.ps1         # Windows PowerShell startup script
├── data/                    # Shared/gitignored data area
└── script-dashboard/
    ├── src/                 # React frontend (SPA)
    │   ├── components/      # UI components (CellEditor, QueuesView, HelpView, etc.)
    │   ├── sandbox/         # Browser JS sandbox (executor, scheduler, globals)
    │   ├── shared/          # Shared logic (executor core, scheduler base, parsers)
    │   ├── store/           # Zustand state management + storage backends
    │   ├── crypto/          # PBKDF2 + AES-GCM secrets encryption
    │   ├── types/           # TypeScript type definitions
    │   └── utils/           # Cron parsing and utilities
    ├── server/              # Node.js Express backend
    │   ├── api/             # REST API routes + server state
    │   ├── sandbox/         # Server-side JS sandbox
    │   └── storage/         # File-based JSON storage (data-nodejs/)
    ├── python-server/       # Python FastAPI backend
    │   ├── api/             # REST API routes + server state
    │   ├── sandbox/         # Server-side Python sandbox
    │   ├── storage/         # File-based JSON storage (data-python/)
    │   ├── crypto/          # PBKDF2 + AES-GCM secrets encryption
    │   └── requirements.txt # Python dependencies
    └── package.json         # Node.js dependencies + scripts
```

## Running

### Using start scripts (recommended)

```bash
# Unix / macOS / WSL
./start-server.sh python     # Python server on port 3456
./start-server.sh python 4000
./start-server.sh node       # Node.js server on port 3456
./start-server.sh node 4000
```

```powershell
# Windows PowerShell
.\start-server.ps1 -Runtime python
.\start-server.ps1 -Runtime python -Port 4000
.\start-server.ps1 -Runtime node
.\start-server.ps1 -Runtime node -Port 4000
```

The start scripts run preflight checks automatically:

- **Python mode:** verifies `fastapi`/`uvicorn` are installed; installs via `pip install -r python-server/requirements.txt` if missing
- **Node.js mode:** verifies `node_modules` exists; runs `npm install` if missing
- **Both:** verifies `dist/index.html` exists; runs `npm run build:all` if missing

### Manual

```bash
cd script-dashboard
npm install

# Python deps
pip install -r python-server/requirements.txt

# Build frontend
npm run build:all

# Start
node dist-server/server/index.js        # Node.js
python3 python-server/main.py           # Python
```

## Development

```bash
cd script-dashboard
npm install
pip install -r python-server/requirements.txt

# SPA dev server (with HMR, JS-only)
npm run dev

# Node.js API server (with watch)
npm run server:dev

# Python API server (manual restart on changes)
python3 python-server/main.py

# Run tests
npm run test:run                    # 61 JS unit tests
python3 -m pytest python-server/tests/ -q   # 83 Python tests

# Lint
npm run lint

# Production build
npm run build:all
```

## Data Directories

Each runtime maintains its own isolated data directory:

```
data-nodejs/              # Node.js server data
data-python/              # Python server data
├── env.json              # Environment variables
├── secrets.enc.json      # Encrypted secrets blob (PBKDF2 + AES-GCM)
├── queues.json           # Queue definitions and messages
├── topics.json           # Pub/sub topics and subscribers
├── crons.json            # Cron job definitions
└── cells/                # Individual script storage (one JSON file per script)
```

Override: `DASHAWS_DATA_DIR=/custom/path ./start-server.sh python`

## Sandbox Globals

### JavaScript

| Global | Description |
|---|---|
| `$state` | Mutable object persisted across runs |
| `$env` | Environment variables (strings) |
| `$secrets` | Encrypted secrets (masked in console output) |
| `$props` | Run parameters (from UI, queue, or pubsub message) |
| `$queue.enqueue(name, body)` | Send a message to a FIFO queue |
| `$pubsub.emit(name, body)` | Publish an event to a topic |
| `fetch` | Native Fetch API |
| `loadPackage(spec)` | Dynamic import from esm.sh |
| `console.log/warn/error/info/table` | Proxied for output capture and secret masking |
| `signal` | `AbortSignal` — aborted when script stops |

### Python

| Global | Description |
|---|---|
| `state` | Mutable dict persisted across runs |
| `env` | Environment variables (dict) |
| `secrets` | Encrypted secrets (dict, masked in console output) |
| `props` | Run parameters (dict, from UI, queue, or pubsub) |
| `queue.enqueue(name, body)` | Send a message to a FIFO queue |
| `pubsub.emit(name, body)` | Publish an event to a topic |
| `print(...)` | Captured output (like `console.log` in JS) |
| `console.log/warn/error/info(...)` | Output capture with secret masking |
| `requests` | Full `requests` module for HTTP calls |
| `import` | Any installed Python library (numpy, pandas, etc.) |

### Available Python Libraries (server mode)

| Category | Libraries |
|---|---|
| **Web** | requests, feedparser, beautifulsoup4, lxml |
| **Data** | pandas, numpy, openpyxl, xmltodict |
| **Charts** | matplotlib |
| **Config** | pyyaml, python-dotenv |
| **PDF** | pypdf |
| **Databases** | sqlalchemy, psycopg2-binary, pyodbc, pymssql |

### Slow first install? (pip)

If `pip install` downloads `.tar.gz` instead of `.whl` files, packages with C extensions (pandas, numpy, matplotlib, lxml, psycopg2-binary) will compile from source, which can take **many minutes** on low-power CPUs.

**Common cause:** pip configured to use an index/extra-index (e.g. piwheels.org) that serves ARM-compiled wheels. On x86_64, those wheels are incompatible and pip falls back to source tarballs.

Check and fix with:
```bash
# List configured indexes
pip config list

# If you see piwheels.org or other ARM indexes, remove them:
pip config unset global.extra-index-url
pip config unset global.index-url
```

After removing incompatible indexes, `pip install -r python-server/requirements.txt` will download pre-built x86_64 wheels from PyPI instead of compiling from source.

## Server Mode vs Standalone

| Feature | Standalone (browser) | Server (Node.js) | Server (Python) |
|---|---|---|---|
| Script execution | Browser only (tab open) | Background (server) | Background (server) |
| Languages | JavaScript | JavaScript | Python |
| Storage | IndexedDB + localStorage | JSON files (data-nodejs/) | JSON files (data-python/) |
| Secrets sync | Local only | Encrypted blob synced | Encrypted blob synced |
| CDN imports | `loadPackage()` | `loadPackage()` | Not available (use pip) |
| Polling interval | 3s (UI) + 2s (queues) | 3s (UI) + 2s (queues) | 3s (UI) + 2s (queues) |

## Queue Delivery Timing

Queue messages are delivered via polling at a **2-second interval**. After enqueuing a message, the subscriber script will execute within ~0–2 seconds (average ~1s). Only one message is delivered per poll cycle across all queues.

## API Endpoints

Both servers expose identical REST APIs:

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/languages` | Supported languages (`["javascript"]` or `["python"]`) |
| `GET` | `/api/cells` | List all scripts |
| `PUT` | `/api/cells/:id` | Create/update script |
| `DELETE` | `/api/cells/:id` | Delete script |
| `POST` | `/api/cells/:id/run` | Run script once (returns result) |
| `POST` | `/api/cells/:id/start` | Enable interval execution |
| `POST` | `/api/cells/:id/stop` | Disable interval execution |
| `GET` | `/api/env` | Get environment variables |
| `PUT` | `/api/env` | Set environment variables |
| `GET` | `/api/secrets/status` | Check secrets status |
| `PUT` | `/api/secrets` | Upload encrypted secrets blob |
| `POST` | `/api/secrets/unlock` | Decrypt secrets with password |
| `POST` | `/api/secrets/lock` | Clear decrypted secrets |
| `DELETE` | `/api/secrets` | Remove secrets |
| `GET/PUT` | `/api/queues` | Queue CRUD |
| `GET/PUT` | `/api/topics` | Topic CRUD |
| `POST` | `/api/topics/:name/emit` | Publish to topic |
| `GET/PUT` | `/api/crons` | Cron CRUD |

## Security Model

- **JS sandbox:** `new Function(...)` + `"use strict"` with blocked dangerous globals (`eval`, `Function`, `setInterval`, `import`, `process`, etc.)
- **Python sandbox:** `exec()` with controlled `globals_dict`; users can `import` any installed library (no OS-level isolation)
- Constructor chain escapes patched via `stripConstructors()` (JS)
- JS-syntax pre-checks in Python executor (warns on `//`, `===`, `let`, `const`, `var`, `function`)
- Secrets encrypted at rest with PBKDF2 (200k iterations, SHA-256) + AES-GCM 256-bit
- Console output automatically masks secret values
- Server enforces security headers (`X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`)

## Limitations

- **Not a multi-user system** — single local instance, no authentication
- **Server secrets at rest** — encrypted blob stored on disk, decrypted in memory while unlocked
- **No WebSocket real-time updates** — server mode uses 3-second polling for UI, 2-second polling for queues
- **Python sandbox is not isolated** — `import` allows any installed module; use a VM/container for untrusted scripts
- **`eval` not fully blocked in JS** — strict mode prevents parameter shadowing of `eval`; additional mitigations recommended for untrusted scripts
- **Single-threaded** — one script at a time per scheduler instance
- **Queue latency** — up to 2 seconds delivery delay due to polling

## License

MIT
