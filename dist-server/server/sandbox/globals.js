export function maskValue(val, secrets) {
    if (typeof val === 'string') {
        let result = val;
        for (const secret of secrets) {
            if (secret.length > 0) {
                while (result.includes(secret)) {
                    result = result.replace(secret, '\u2022'.repeat(6));
                }
            }
        }
        return result;
    }
    if (Array.isArray(val))
        return val.map(v => maskValue(v, secrets));
    if (val !== null && typeof val === 'object') {
        const masked = {};
        for (const [k, v] of Object.entries(val)) {
            masked[k] = maskValue(v, secrets);
        }
        return masked;
    }
    return val;
}
function maskArgs(args, secrets) {
    if (secrets.size === 0)
        return args;
    return args.map(a => maskValue(a, secrets));
}
let timerIds = null;
export function getTimerIds() {
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
    const consoleProxy = new Proxy({}, {
        get(_target, prop) {
            return (...args) => {
                const type = prop === 'warn' ? 'warn' :
                    prop === 'error' ? 'error' :
                        prop === 'info' ? 'info' :
                            prop === 'table' ? 'table' : 'log';
                onLog({ timestamp: Date.now(), type, args: maskArgs(args, secrets) });
            };
        },
    });
    return {
        fetch: globalThis.fetch.bind(globalThis),
        setTimeout: (fn, ms, ...args) => {
            const id = globalThis.setTimeout(() => {
                ids.delete(id);
                fn();
            }, ms, ...args);
            ids.add(id);
            return id;
        },
        clearTimeout: (id) => {
            if (id !== undefined)
                ids.delete(id);
            globalThis.clearTimeout(id);
        },
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