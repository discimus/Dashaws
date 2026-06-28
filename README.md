# Dashaws

A local-first dashboard for scheduling and executing user-defined JavaScript scripts on intervals, cron expressions, queues, and pub/sub events. Supports standalone browser mode and optional server mode for background execution.

## Features

- **Sandboxed execution** — Scripts run in isolated `new Function()` contexts with strict mode, blocked dangerous globals, and console output masking against secrets
- **Scheduler** — Configurable intervals (ms), cron expressions, queue consumers, and pub/sub subscribers
- **Inter-script communication** — `$cells` API (run/start/stop other scripts), `$queue.enqueue`, `$pubsub.emit`
- **Persistent state** — `$state` survives script restarts and page reloads
- **Environment variables** — `$env.KEY` from the Environment tab
- **Encrypted secrets** — `$secrets.KEY` with PBKDF2 (200k iterations, SHA-256) + AES-GCM 256-bit encryption at rest
- **CDN package loading** — `await loadPackage("lodash")` imports from esm.sh at runtime
- **Background execution** — Optional Express server for running scripts continuously without a browser tab open
- **Keep-alive** — Wake Lock + silent audio oscillator to prevent browser timer throttling
- **Security** — `setInterval`/`clearInterval` blocked, constructor chain escapes patched, CSP-compatible security headers on server

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) >= 18 (tested on 24)

### Standalone (browser only)

```bash
npm install
npm run dev
```

Open http://localhost:5173 — no server required. Scripts only run while the browser tab is open.

### With background server

```bash
npm install
npm run build:all
npm run start:server
```

Open http://localhost:3456 — scripts persist and execute continuously via the Express server.

## Development

```bash
npm install

# SPA dev server (with HMR)
npm run dev

# API server (dev, with tsx watch)
npm run server:dev

# Run tests (63 unit tests)
npm run test:run

# Lint
npm run lint

# Production build (SPA + server)
npm run build:all
```

## Scripts

| Command | Description |
|---|---|
| `dev` | Vite dev server (SPA only, port 5173) |
| `build` | TypeScript check + Vite production build → `dist/` |
| `build:server` | TypeScript check → `dist-server/` |
| `build:all` | Both SPA and server builds |
| `server` | Run API server with tsx (dev) |
| `server:dev` | Run API server with tsx watch (auto-restart) |
| `start:server` | Run compiled server (needs `build:all` first) |
| `test` | Vitest in watch mode |
| `test:run` | Vitest single run |
| `lint` | Oxlint |
| `preview` | Vite preview of production SPA build |

## Architecture

```
src/
├── components/     React UI components
├── sandbox/        Browser sandbox (executor, scheduler, globals)
├── shared/         Shared logic (executor core, scheduler base, mask, parse, etc.)
├── store/          Zustand state management + storage backends
├── crypto/         PBKDF2 + AES-GCM secrets encryption
├── types/          TypeScript type definitions
└── utils/          Cron parsing and utilities

server/
├── index.ts        Express entry point
├── api/            REST API routes + shared server state
├── sandbox/        Server sandbox (executor, scheduler, globals)
└── storage/        File-based JSON storage backend
```

### Sandbox globals

| Global | Description |
|---|---|
| `$state` | Mutable object persisted across runs |
| `$env` | Environment variables (strings) |
| `$secrets` | Encrypted secrets (masked in console output) |
| `$props` | Run parameters (from UI gear icon or `$cells.run`) |
| `$cells` | API to run/start/stop/list other scripts |
| `$queue.enqueue(name, body)` | Send a message to a queue |
| `$pubsub.emit(name, body)` | Publish an event to a topic |
| `fetch` | Native Fetch API |
| `loadPackage(spec)` | Dynamic import from esm.sh |
| `console.log/warn/error/info/table` | Proxied for output capture and secret masking |
| `signal` | `AbortSignal` — aborted when script stops |
| `Math`, `Date`, `JSON`, `Promise`, etc. | Safe standard globals |

### Server mode vs standalone

| Feature | Standalone | Server |
|---|---|---|
| Script execution | Browser only (tab must be open) | Background (server process) |
| Storage | IndexedDB + localStorage | JSON files in `data/` |
| Secrets sync | Local only | Encrypted blob synced to server |
| Cron auto-disable | N/A | Crons targeting secret-using scripts auto-disabled when locked |
| SPA delivery | Vite dev server | Express serves `dist/` |
| Keep-alive | Wake Lock recommended | Not needed |

### Server data directory

```
data/
├── env.json          Environment variables
├── secrets.enc.json  Encrypted secrets blob (PBKDF2 + AES-GCM)
├── queues.json        Queue definitions and messages
├── topics.json        Pub/sub topics and subscribers
├── crons.json         Cron job definitions
└── cells/             Individual script storage (one JSON file per script)
```

Override the data directory: `DASHAWS_DATA_DIR=/custom/path npm run start:server`

## API Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/cells` | List all scripts |
| `PUT` | `/api/cells/:id` | Create/update script |
| `DELETE` | `/api/cells/:id` | Delete script |
| `POST` | `/api/cells/:id/run` | Run script once (returns result) |
| `POST` | `/api/cells/:id/start` | Enable interval execution |
| `POST` | `/api/cells/:id/stop` | Disable interval execution |
| `GET` | `/api/env` | Get environment variables |
| `PUT` | `/api/env` | Set environment variables |
| `GET` | `/api/secrets/status` | Check if secrets blob exists and is unlocked |
| `PUT` | `/api/secrets` | Upload encrypted secrets blob |
| `POST` | `/api/secrets/unlock` | Decrypt secrets with password |
| `POST` | `/api/secrets/lock` | Clear decrypted secrets from memory |
| `DELETE` | `/api/secrets` | Remove secrets entirely |
| `GET/PUT` | `/api/queues` | Queue CRUD |
| `GET/PUT` | `/api/topics` | Topic CRUD |
| `POST` | `/api/topics/:name/emit` | Publish to topic |
| `GET/PUT` | `/api/crons` | Cron CRUD |

## Security model

- Scripts execute in `new Function(...)` sandbox with `"use strict"`
- Dangerous globals (`eval`, `Function`, `setInterval`, `clearInterval`, `setImmediate`, `clearImmediate`, `import`, `importScripts`, `Worker`, `process`, `global`) shadowed to `undefined`
- Constructor chain escapes patched via `stripConstructors()` on all safe constructors
- Secrets encrypted at rest with PBKDF2 (200k iterations, SHA-256) + AES-GCM 256-bit
- Console output automatically masks secret values
- `eval` cannot be fully blocked via parameter shadowing in strict mode — alternative mitigations in place
- Server enforces security headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`

## Limitations

- **Not a multi-user system** — single local instance, no authentication
- **Server secrets at rest** — encrypted blob stored on disk, decrypted in memory while unlocked
- **No WebSocket real-time updates** — server mode uses 3-second polling
- **Single-threaded JavaScript** — one script at a time per scheduler instance
- **`eval` not fully blocked** — strict mode prevents parameter shadowing of `eval`; additional mitigations recommended for untrusted scripts

## License

MIT
