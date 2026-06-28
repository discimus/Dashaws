import { createConsoleProxy, createTrackedSetTimeout, createTrackedClearTimeout } from '../../src/shared/globals-factory.js';
let timerIds = null;
function getTimerIds() {
    if (!timerIds)
        timerIds = new Set();
    return timerIds;
}
export function clearTimerIds() {
    if (timerIds) {
        for (const id of timerIds)
            globalThis.clearTimeout(id);
        timerIds.clear();
    }
}
export function createServerSandboxGlobals(cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog) {
    const ids = getTimerIds();
    const consoleProxy = createConsoleProxy(secrets, onLog);
    return {
        fetch: globalThis.fetch.bind(globalThis),
        setTimeout: createTrackedSetTimeout(ids),
        clearTimeout: createTrackedClearTimeout(ids),
        console: consoleProxy,
        $state: cellState,
        $env: { ...env },
        $secrets: { ...secretsObj },
        $props: { ...props },
        $cells: cellsApi,
        $queue: { enqueue: (name, body) => cellsApi.enqueue(name, body) },
        $pubsub: { emit: (name, body) => cellsApi.emitEvent(name, body) },
        signal,
        Math, Date, JSON, Array, Object, String, Number, Boolean, RegExp, Map, Set, Promise,
        parseInt, parseFloat, isNaN, isFinite, encodeURI, decodeURI,
        btoa: (data) => Buffer.from(data).toString('base64'),
        atob: (data) => Buffer.from(data, 'base64').toString(),
        ErrorConstructor: Error,
    };
}
//# sourceMappingURL=globals.js.map