# Dashaws — Frontend + Node.js Server

React SPA (Vite + Tailwind v4) with optional Express backend for JavaScript runtime.

> See [../README.md](../README.md) for the full project documentation including Python runtime, API endpoints, and architecture.

## Quick Start

```bash
npm install
npm run dev          # Vite HMR (port 5173, JS-only sandbox)
npm run build:all    # Full build (frontend + server)
npm run server       # Express server (port 3456)
```

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Build frontend |
| `npm run build:server` | Build Express server |
| `npm run build:all` | Build both |
| `npm run test:run` | Vitest tests |
| `npm run lint` | oxlint |
| `npm run server` | Start Express server |
| `npm run server:dev` | Express with watch mode |

## Directory Structure

```
src/                    # React SPA
├── components/         # CellCard, CellEditor, CellOutput, CellControls, TopBar, Sidebar, etc.
├── sandbox/            # Browser sandbox: globals.ts, executor.ts, scheduler.ts
├── shared/             # Code shared with server: executor-core.ts, globals-factory.ts, parse.ts
├── store/              # Zustand: useCellsStore.ts, api-client.ts
├── crypto/             # AES secrets encryption
├── types/              # Cell, LogEntry, Queue, EventTopic, etc.
└── utils/              # clipboard.ts, cron.ts, mask.ts

server/                 # Express backend
├── sandbox/            # Server sandbox: globals.ts, executor.ts, scheduler.ts
├── api/                # REST routes
└── storage/            # JSON file persistence
```

## Sandbox Globals (JavaScript)

| Global | Description |
|--------|-------------|
| `$state` | Persisted mutable state |
| `$env` | Environment variables |
| `$secrets` | AES-GCM encrypted secrets |
| `$props` | Params from gear icon, queue, or pubsub |
| `$queue.enqueue(name, body)` | Push to FIFO queue |
| `$pubsub.emit(name, body)` | Broadcast event |
| `console` | `log`, `warn`, `error`, `info`, `table` |
| `fetch` | Web Fetch API |
| `loadPackage(spec)` | Import from esm.sh CDN (cached) |
| `setTimeout` / `clearTimeout` | Tracked timers (auto-cleaned) |
| `signal` | AbortSignal (stopped/timeout) |
