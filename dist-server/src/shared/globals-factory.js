import { maskArgs } from './mask.js';
export function createConsoleProxy(secrets, onLog) {
    return new Proxy({}, {
        get(_target, prop) {
            return (...args) => {
                const type = prop === 'warn' ? 'warn'
                    : prop === 'error' ? 'error'
                        : prop === 'info' ? 'info'
                            : prop === 'table' ? 'table'
                                : 'log';
                onLog({ timestamp: Date.now(), type, args: maskArgs(args, secrets) });
            };
        },
    });
}
export function createTrackedSetTimeout(timerIds) {
    return (fn, ms, ...args) => {
        const id = globalThis.setTimeout(() => {
            timerIds.delete(id);
            fn();
        }, ms, ...args);
        timerIds.add(id);
        return id;
    };
}
export function createTrackedClearTimeout(timerIds) {
    return (id) => {
        if (id !== undefined)
            timerIds.delete(id);
        globalThis.clearTimeout(id);
    };
}
//# sourceMappingURL=globals-factory.js.map