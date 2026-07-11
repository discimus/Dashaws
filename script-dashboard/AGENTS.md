# AGENTS.md — Dashaws Frontend + Node.js Server

React SPA (Vite + Tailwind v4) + Express server with shared codebase.

## Commands

| Purpose | Command | Notes |
|---------|---------|-------|
| Dev server | `npm run dev` | Vite HMR, port 5173 |
| Build frontend | `npm run build` | `tsc -b && vite build` |
| Build server | `npm run build:server` | `tsc -p server/tsconfig.json` |
| Build all | `npm run build:all` | Frontend + server |
| Tests | `npm run test:run` | Vitest, single run |
| Lint | `npm run lint` | oxlint |
| Typecheck app | `npx tsc --noEmit --project tsconfig.app.json` | Frontend types |
| Typecheck server | `npx tsc --noEmit -p server/tsconfig.json` | Server types |

## Key directories

```
src/                    # React SPA
├── components/         # CellCard, CellEditor, CellOutput, CellControls, etc.
├── sandbox/            # globals.ts, executor.ts, scheduler.ts (browser)
├── shared/             # executor-core.ts, globals-factory.ts, scheduler-base.ts, mask.ts, parse.ts
├── store/              # useCellsStore.ts (Zustand), toastStore.ts, api-client.ts
├── crypto/             # secrets.ts (AES encryption)
├── types/              # cell.ts (Cell, LogEntry, Queue, etc.)
└── utils/              # clipboard.ts, cron.ts, id.ts, mask.ts, parse.ts

server/                 # Express (Node.js runtime)
├── sandbox/            # globals.ts, executor.ts, scheduler.ts (server)
├── api/                # routes.ts, state.ts
└── storage/            # file-storage.ts (JSON persistence)
```

## CRITICAL RULES

1. **POST-CHANGE CHECKLIST** — always run in this order:
   ```
   npx tsc --noEmit --project tsconfig.app.json
   if ($?) { npx tsc --noEmit -p server/tsconfig.json }
   if ($?) { npm run test:run }
   if ($?) { npm run build:all }
   ```

2. **NEVER modify existing test files.** Files never to touch:
   - `src/**/*.test.ts`
   - `server/**/*.test.ts`
   - `src/shared/*.test.ts`
   - `src/utils/*.test.ts`

3. **Create new test files** for any feature or fix:
   - Component test: `src/components/ComponentName.test.tsx`
   - Shared logic: `src/shared/feature.test.ts`
   - Server logic: `server/storage/feature.test.ts`
   - Import from `vitest`: `describe`, `it`, `expect`, `vi`, `beforeEach`

## Component patterns

- **Material Design 3**: Use predefined classes from `src/index.css`:
  - Buttons: `md-btn md-btn-filled` (filled), `md-btn md-btn-danger` (red), `md-btn md-btn-success` (green)
  - Inputs: `md-field`
  - Dropdowns: `md-menu` + `md-menu-item`
  - Cards: `md-card`
  - Chips: `md-chip`
- **Tailwind v4**: Use `@import "tailwindcss"` in CSS, `@theme` for tokens
- **CodeMirror 6**: Import from `@codemirror/*` packages. Completion sources use `autocompletion({ override: [...] })`
- **Zustand**: `useCellsStore(s => s.field)` for reading, `useCellsStore.getState()` for imperative access
- **No inline styles** — always use Tailwind classes

## Shared code

`src/shared/` is imported by **both** frontend and server (configured in `server/tsconfig.json`). When modifying shared files, both typechecks MUST pass.

## Test template (Vitest)

```ts
import { describe, it, expect } from 'vitest';

describe('feature name', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
```

Tests run in Node environment (configured in `vitest.config.ts`).
