import { createConsoleProxy, createTrackedSetTimeout, createTrackedClearTimeout } from '../../src/shared/globals-factory.js';
import { stripConstructors } from '../../src/shared/strip-constructors.js';
let currentTimerIds = null;
export function cleanupServerTimers() {
    if (currentTimerIds) {
        for (const id of currentTimerIds)
            globalThis.clearTimeout(id);
        currentTimerIds.clear();
        currentTimerIds = null;
    }
}
export function createServerSandboxGlobals(cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog) {
    currentTimerIds = new Set();
    const timerIds = currentTimerIds;
    const consoleProxy = createConsoleProxy(secrets, onLog);
    const stripped = stripConstructors();
    return {
        fetch: globalThis.fetch.bind(globalThis),
        setTimeout: createTrackedSetTimeout(timerIds),
        clearTimeout: createTrackedClearTimeout(timerIds),
        console: consoleProxy,
        $state: cellState,
        $env: { ...env },
        $secrets: { ...secretsObj },
        $props: { ...props },
        $cells: cellsApi,
        $queue: { enqueue: (name, body) => cellsApi.enqueue(name, body) },
        $pubsub: { emit: (name, body) => cellsApi.emitEvent(name, body) },
        signal,
        Math,
        Date: stripped.Date,
        JSON,
        Array: stripped.Array,
        Object: stripped.Object,
        String: stripped.String,
        Number: stripped.Number,
        Boolean: stripped.Boolean,
        RegExp: stripped.RegExp,
        Map: stripped.Map,
        Set: stripped.Set,
        Promise: stripped.Promise,
        parseInt,
        parseFloat,
        isNaN,
        isFinite,
        encodeURI,
        decodeURI,
        btoa: (data) => Buffer.from(data).toString('base64'),
        atob: (data) => Buffer.from(data, 'base64').toString(),
        ErrorConstructor: stripped.ErrorConstructor,
    };
}
//# sourceMappingURL=globals.js.map