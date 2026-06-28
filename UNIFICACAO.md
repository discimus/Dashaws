# Plano de Unificação — Script Dashboard

## Problema

O projeto tem **duplicação significativa** entre o runtime browser (`src/`) e o servidor (`server/`):

| Módulo | Linhas duplicadas | O quê |
|---|---|---|
| `executor.ts` | ~75 (70%) | Lógica central de `new Function()`, try/catch, flatten de globals |
| `globals.ts` | ~110 (63%) | Console proxy, sandbox globals, maskValue/maskArgs |
| `scheduler.ts` | ~100 (54%) | runOnce, start, stop, stopAll, restart, buildCellsAPI |
| `parseParams` / `parseMessageBody` | 100% | 3 ocorrências idênticas em arquivos diferentes |
| `maskValue` / `maskArgs` | 100% | Duplicado nos dois `globals.ts` |

**Total: ~320 linhas de código duplicado** que aumentam o custo de manutenção e o risco de bugs (ex: servidor não mascara state em erro — potencial vazamento de secrets).

---

## Abordagem: `src/shared/` — camada agnóstica com IoC

Criar diretório `src/shared/` com módulos que não dependem de browser ou Node APIs.

Toda dependência de ambiente é injetada via interfaces/config objects (IoC).

```
src/shared/
├── types.ts           → ExecutionResult, CellsAPI, SandboxGlobals
├── executor-core.ts   → executeScript() parametrizado
├── globals-factory.ts → consoleProxy, tracked setTimeout/clearTimeout
├── scheduler-base.ts  → BaseScheduler (runOnce, start, stop)
├── parse.ts           → parseParams(), parseMessageBody()
└── mask.ts            → maskValue(), maskState(), maskArgs()
```

---

## Etapas

### Etapa 1 — Criar `src/shared/mask.ts`

Extrair de ambos `globals.ts`:

```ts
// src/shared/mask.ts
export function maskValue(val: unknown, secrets: Set<string>): unknown
export function maskState(state: Record<string, unknown>, secrets: Set<string>): Record<string, unknown>
export function maskArgs(args: unknown[], secrets: Set<string>): unknown[]
```

**Remove de:**
- `src/sandbox/globals.ts` → importa de `../shared/mask.ts`
- `server/sandbox/globals.ts` → importa de `../../src/shared/mask.js`
- `server/sandbox/executor.ts` → usa `maskState` de `../shared/mask.js` em vez do inline loop

**Impacto:** ~30 linhas de shared eliminam ~60 linhas duplicadas.

---

### Etapa 2 — Criar `src/shared/parse.ts`

```ts
// src/shared/parse.ts
export function parseParams(params: string): Record<string, unknown>
export function parseMessageBody(body: string): Record<string, unknown>
```

**Remove de:**
- `src/sandbox/scheduler.ts`
- `server/sandbox/scheduler.ts`
- `src/store/useCellsStore.ts` (ocorrência de `parseMessageBody`)
- `server/index.ts` (ocorrência de `parseMessageBody`)
- `server/sandbox/scheduler.ts` (ocorrência de `parseMessageBody`)

**Impacto:** ~15 linhas de shared eliminam ~45 linhas duplicadas.

---

### Etapa 3 — Criar `src/shared/types.ts`

Mover `ExecutionResult` e `CellsAPI` (atualmente em ambos `executor.ts`) + `SandboxGlobals` (interface única).

```ts
// src/shared/types.ts
import type { LogEntry } from '../types/cell.js';

export interface ExecutionResult {
  success: boolean;
  error?: string;
  output: LogEntry[];
  state: Record<string, unknown>;
}

export interface CellsAPI {
  run: (id: string, props?: Record<string, unknown>) => void;
  start: (id: string) => void;
  stop: (id: string) => void;
  list: () => { id: string; name: string; status: string }[];
  enqueue: (name: string, body: string) => void;
  emitEvent: (name: string, body: string) => void;
}

export interface SandboxGlobals {
  $state: Record<string, unknown>;
  $env: Record<string, string>;
  $secrets: Record<string, string>;
  $props: Record<string, unknown>;
  $cells: CellsAPI;
  $queue: { enqueue: (name: string, body: string) => void };
  $pubsub: { emit: (name: string, body: string) => void };
  // + setTimeout, clearTimeout, console, signal,
  //   Math, Date, JSON, Array, Object, String,
  //   Number, Boolean, RegExp, Map, Set, Promise,
  //   parseInt, parseFloat, isNaN, isFinite,
  //   encodeURI, decodeURI, btoa, atob, ErrorConstructor
}
```

Padronizar `btoa`/`atob` como `(data: string) => string` (servidor já usa assim; browser usa `typeof btoa` que é equivalente).

**Impacto:** interface única substitui 2 interfaces + 2 tipos nomeados diferentes.

---

### Etapa 4 — Criar `src/shared/globals-factory.ts`

Extrair funções que não dependem de ambiente:

```ts
export function createConsoleProxy(
  secrets: Set<string>,
  onLog: (entry: LogEntry) => void
): Console

export function createTrackedSetTimeout(
  timerIds: Set<number>
): typeof globalThis.setTimeout

export function createTrackedClearTimeout(
  timerIds: Set<number>
): typeof globalThis.clearTimeout
```

**Remove de:**
- `src/sandbox/globals.ts`
- `server/sandbox/globals.ts`

Os `globals.ts` específicos ficam apenas com:
- Lista de built-ins + `btoa`/`atob` (varia por ambiente)
- `stripConstructors()` (browser)
- Timer ID set management (local vs module-level)

---

### Etapa 5 — Criar `src/shared/executor-core.ts`

Extrair o núcleo do sandbox, recebendo configuração via IoC:

```ts
interface ExecutorConfig {
  blockedGlobals: Record<string, unknown>;
  createGlobals(params: GlobalsParams): SandboxGlobals;
  maskState(state: Record<string, unknown>, secrets: Set<string>): Record<string, unknown>;
  onFinally?(): void;
}

export async function executeScript(
  script: string,
  cellState: Record<string, unknown>,
  env: Record<string, string>,
  secrets: Set<string>,
  secretsObj: Record<string, string>,
  props: Record<string, unknown>,
  cellsApi: CellsAPI,
  signal: AbortSignal,
  config: ExecutorConfig
): Promise<ExecutionResult>
```

**Config do browser:**
```ts
const browserConfig: ExecutorConfig = {
  blockedGlobals: BROWSER_BLOCKED,
  createGlobals: (p) => createSandboxGlobals(p, stripConstructors()),
  maskState,
  onFinally: clearTimerIds,
};
```

**Config do servidor:**
```ts
const serverConfig: ExecutorConfig = {
  blockedGlobals: NODE_BLOCKED,
  createGlobals: createNodeSandboxGlobals,
  maskState,
};
```

---

### Etapa 6 — Criar `src/shared/scheduler-base.ts`

Classe abstrata com métodos comuns:

```ts
export abstract class BaseScheduler {
  protected intervals = new Map<string, ReturnType<typeof setInterval>>();
  protected controllers = new Map<string, AbortController>();

  protected abstract getCell(id: string): Cell | undefined;
  protected abstract onResult(id: string, result: ExecutionResult): void;
  protected abstract getEnv(): EnvData;
  protected abstract buildCellsAPI(): CellsAPI;

  async runOnce(cellId: string, props?: Record<string, unknown>): Promise<ExecutionResult | null>
  start(cellId: string): void
  stop(cellId: string): void
  stopAll(): void
  restart(cellId: string): void
  isRunning(cellId: string): boolean
  getRunningIds(): string[]
}
```

`Scheduler` (browser) e `ServerScheduler` extendem a base, adicionando apenas lógica específica.

---

### Etapa 7 — Conectar `ApiStorageBackend`

Atualmente o `ApiStorageBackend` existe em `src/store/api-storage.ts` mas não é usado — a UI persiste em localStorage.

Modificar `src/store/storage.ts` para prover um factory:

```ts
export function createStorageBackend(): StorageBackend {
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return new ApiStorageBackend('/api');
  }
  return new LocalStorageBackend();
}
```

Ou uma store toggle que prioriza API e fallback para localStorage.

---

## Testes Unitários

### Setup

Usar `vitest` (já disponível no projeto via Vite). Configurar em `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // para shared/ — código universal
  },
});
```

Testes de browser (`src/sandbox/`) requerem `environment: 'jsdom'` ou `happy-dom`.

### 1. `src/shared/mask.test.ts`

```ts
describe('maskValue')
  ✓ mascara string com segredo exato
    maskValue('helloSecretWorld', new Set(['Secret'])) → 'hello••••••World'
  ✓ múltiplas ocorrências no mesmo string
    maskValue('abab', new Set(['a'])) → '••••b••••b'
  ✓ percorre array recursivamente
    maskValue(['secret', { key: 'secret' }], new Set(['secret']))
    → ['••••••', { key: '••••••' }]
  ✓ percorre objeto recursivamente
    maskValue({ a: 'prefix_secret', b: { c: 'secret_suffix' } }, new Set(['secret']))
    → { a: 'prefix_••••••', b: { c: '••••••_suffix' } }
  ✓ retorna primitivos sem alterar
    maskValue(42, new Set(['x'])) → 42
    maskValue(null, new Set(['x'])) → null
    maskValue(true, new Set(['x'])) → true
  ✓ segredo vazio não altera
  ✓ não modifica o objeto original

describe('maskState')
  ✓ retorna novo objeto, não muta original
  ✓ mascara todos os valores do state
  ✓ retorna cópia rasa se secrets vazio
```

### 2. `src/shared/parse.test.ts`

```ts
describe('parseParams')
  ✓ retorna objeto vazio para string vazia
  ✓ faz parse de JSON válido
    parseParams('{"key":"val"}') → { key: 'val' }
  ✓ retorna vazio para JSON inválido
  ✓ retorna vazio para array JSON (não objeto)

describe('parseMessageBody')
  ✓ parse de objeto JSON → mesmo objeto
  ✓ string simples → { message: body }
  ✓ string inválida → { message: body }
```

### 3. `src/shared/executor-core.test.ts`

```ts
describe('executeScript')
  ✓ executa script simples → success: true
  ✓ captura console.log no output
  ✓ retorna state atualizado via $state mutation
  ✓ retorna error + output para exceção
  ✓ globals bloqueados lançam ReferenceError
  ✓ AbortSignal abortado → 'Execution aborted'
  ✓ mascara state com maskState injetado
  ✓ chama onFinally mesmo em erro
  ✓ $env.KEY injetado corretamente
  ✓ $props injetado corretamente
  ✓ $cells.run / start / stop / list injetados
  ✓ $queue.enqueue injetado
  ✓ $pubsub.emit injetado
```

### 4. `src/shared/scheduler-base.test.ts`

```ts
describe('BaseScheduler')
  ✓ runOnce executa célula e chama onResult
  ✓ runOnce retorna null para cellId inexistente
  ✓ start executa imediatamente + inicia intervalo
  ✓ stop cancela intervalo + aborta execução
  ✓ stopAll para todas as células ativas
  ✓ restart para e reinicia
  ✓ isRunning true após start, false após stop
  ✓ múltiplos start não criam múltiplos intervalos
  ✓ buildCellsAPI.$cells.run → runOnce
  ✓ buildCellsAPI.$cells.stop → stop
```

### 5. Integração — segurança (executor + mask)

```ts
describe('maskState integração')
  ✓ valores secretos não persistem no state após execução
  ✓ segredo aninhado em objeto profundo é mascarado
  ✓ segredo em array dentro do state é mascarado
  ✓ state vazio não quebra
```

---

## Cronograma estimado

| Etapa | Descrição | Esforço |
|---|---|---|
| 1 | `mask.ts` | 1h |
| 2 | `parse.ts` | 30min |
| 3 | `types.ts` | 30min |
| 4 | `globals-factory.ts` | 2h |
| 5 | `executor-core.ts` | 3h |
| 6 | `scheduler-base.ts` | 3h |
| 7 | Conectar `ApiStorageBackend` | 4h |
| — | Testes (todos os cenários) | 4h |

**Total: ~18h de trabalho sequencial.**

Obs: a Etapa 7 (ApiStorageBackend) é independente das anteriores — pode ser feita em paralelo ou ignorada se a UI continuar rodando offline.

---

## Riscos e ressalvas

1. **`stripConstructors()` server-side**: o browser faz hardening dos construtores; o servidor não. Decidir: aplicar também no servidor (consistente) ou documentar como diferença intencional.

2. **Timer ID management**: browser usa Set local retornado da factory; servidor usa singleton no módulo. Unificar para uma abordagem (Set local é mais seguro — não vaza entre execuções).

3. **Imports com `.js`**: o servidor exige extensão `.js` em imports relativos. Módulos em `src/shared/` precisarão de `.js` nos imports de server e sem extensão nos imports de src. Isso é resolvido com um path alias no tsconfig do servidor ou mantendo a convenção `.js` em todos os imports (Vite aceita `.js`).

4. **`shared/` não resolve no servidor sem tsconfig ajustado**: o `server/tsconfig.json` precisa incluir `"../src/shared/**/*.ts"` no `include`, ou criar um path alias.
