# AGENTS.md — Dashaws

Dual-runtime (JS + Python) local script scheduling dashboard with React SPA frontend.

## Architecture

```
background-workers-v3/
├── script-dashboard/                 # Frontend + servers
│   ├── src/                          # React SPA (Vite)
│   │   ├── components/               # UI (MD3 + Tailwind v4)
│   │   ├── sandbox/                  # Browser sandbox globals + executor
│   │   ├── shared/                   # Shared frontend ↔ Node server
│   │   ├── store/                    # Zustand stores
│   │   ├── crypto/                   # AES secrets encryption
│   │   ├── types/                    # TS type definitions
│   │   └── utils/                    # Utilities (clipboard, cron, mask, parse)
│   ├── server/                       # Express server (JS runtime)
│   │   ├── sandbox/                  # Node sandbox globals + executor + scheduler
│   │   ├── api/                      # REST routes + state
│   │   └── storage/                  # File persistence
│   ├── python-server/                # FastAPI server (Python runtime)
│   │   ├── sandbox/                  # Python sandbox globals + executor + scheduler
│   │   ├── api/                      # REST routes + state
│   │   └── tests/                    # Pytest + pytest-asyncio
│   └── package.json
├── start-server.sh                   # Unix/macOS startup
├── start-server.ps1                  # Windows PowerShell startup
└── dashaws.config.json               # Auth password (gitignored)
```

## Quick commands

| Action | Command | CWD |
|--------|---------|-----|
| Start Python server | `./start-server.sh python` or `.\start-server.ps1 -Runtime python` | Root |
| Start Node.js server | `./start-server.sh node` or `.\start-server.ps1 -Runtime node` | Root |
| Frontend dev only | `npm run dev` | `script-dashboard/` |
| JS/TS tests | `npm run test:run` | `script-dashboard/` |
| Python tests | `pytest python-server/tests/ -q` | `script-dashboard/` |
| JS/TS typecheck (app) | `npx tsc --noEmit --project tsconfig.app.json` | `script-dashboard/` |
| JS/TS typecheck (server) | `npx tsc --noEmit -p server/tsconfig.json` | `script-dashboard/` |
| Frontend build | `npm run build:all` | `script-dashboard/` |

## CRITICAL RULES

1. **AFTER EVERY CODE CHANGE** — run ALL applicable checks:
   - JS/TS changed → `tsc --noEmit` (app) AND `tsc --noEmit` (server) AND `npm run test:run`
   - Python changed → `pytest python-server/tests/ -q`
   - Both changed → run both

2. **NEVER modify existing test files** (`*.test.ts`, `test_*.py`, `conftest.py`).
   If a test breaks because of your change, the test is correct — fix your code.

3. **ALWAYS create new tests** for any new feature or bug fix:
   - TS: `src/.../feature.test.ts` or `server/.../feature.test.ts` (Vitest)
   - Python: `tests/test_feature.py` (Pytest + pytest-asyncio)

## Token-saving conventions

- **Skip README.md** — AGENTS.md files are the authoritative AI guides
- **Key files** (read these first when exploring):
  - Types: `src/types/cell.ts`, `src/shared/types.ts`
  - Store: `src/store/useCellsStore.ts`
  - Sandbox globals: `src/sandbox/globals.ts` (browser), `server/sandbox/globals.ts` (Node), `python-server/sandbox/globals.py` (Python)
  - Executors: `src/sandbox/executor.ts`, `server/sandbox/executor.ts`, `python-server/sandbox/executor.py`
  - Schedulers: `server/sandbox/scheduler.ts`, `python-server/sandbox/scheduler.py`
  - API: `server/api/routes.ts`, `python-server/api/routes.py`
  - State: `python-server/api/state.py`
  - Storage: `server/storage/file-storage.ts`, `python-server/storage/file_storage.py`
  - CSS: `src/index.css`
- **Use `glob` + `grep`** to find files/patterns, not recursive reads
- **Read files in chunks** — use `offset` + `limit` for large files

## Coding conventions

| Layer | Convention |
|-------|-----------|
| TypeScript | `verbatimModuleSyntax`, `noUnusedLocals`, `noUnusedParameters` |
| Tailwind | v4 `@import "tailwindcss"` syntax, Material Design 3 dark theme tokens |
| Components | Classes: `md-btn`, `md-btn-filled`, `md-field`, `md-menu`, `md-menu-item` (see `src/index.css`) |
| Python | 3.12.3+, `str \| None` over `typing.Optional`, f-strings, `dict[str, Any]` |
| CSS | No inline styles — use Tailwind or add rules to `src/index.css` |
| React | Functional components, Zustand for state, CodeMirror 6 for editors |
| No comments | Code should be self-documenting — no comments unless explicitly asked |

## Sub-project guides

- **JS/TS changes** → read `script-dashboard/AGENTS.md`
- **Python changes** → read `script-dashboard/python-server/AGENTS.md`
