import { maskState } from './mask.js';
export async function executeScript(script, cellState, env, secrets, secretsObj, props, cellsApi, signal, config) {
    const output = [];
    const onLog = (entry) => output.push(entry);
    const timeoutMs = config.timeoutMs;
    const combinedSignal = timeoutMs && timeoutMs > 0
        ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
        : signal;
    const globals = config.createGlobals(cellState, env, secrets, secretsObj, props, cellsApi, combinedSignal, onLog);
    const blockedNames = Object.keys(config.blockedGlobals).filter(n => n !== 'eval' && n !== 'arguments');
    const blockedValues = blockedNames.map(n => config.blockedGlobals[n]);
    const entries = Object.entries(globals);
    const globalNames = entries.map(([name]) => name);
    const globalValues = entries.map(([, value]) => value);
    const allNames = [...blockedNames, ...globalNames];
    const allValues = [...blockedValues, ...globalValues];
    const wrappedScript = `
    "use strict";
    return (async () => {
      ${script}
    })();
  `;
    const applyMask = config.maskState ?? maskState;
    try {
        const fn = new Function(...allNames, wrappedScript);
        await fn(...allValues);
        return { success: true, output, state: applyMask(cellState, secrets) };
    }
    catch (err) {
        if (combinedSignal.aborted) {
            if (timeoutMs && timeoutMs > 0 && combinedSignal.reason?.name === 'TimeoutError') {
                output.push({ timestamp: Date.now(), type: 'error', args: [`Script timed out after ${timeoutMs / 1000}s`] });
                return { success: false, error: `Timed out after ${timeoutMs / 1000}s`, output, state: applyMask(cellState, secrets) };
            }
            output.push({ timestamp: Date.now(), type: 'warn', args: ['Execution aborted'] });
            return { success: true, output, state: applyMask(cellState, secrets) };
        }
        const errorMessage = err instanceof Error
            ? `${err.name}: ${err.message}`
            : String(err);
        output.push({ timestamp: Date.now(), type: 'error', args: [errorMessage] });
        return { success: false, error: errorMessage, output, state: applyMask(cellState, secrets) };
    }
    finally {
        config.onFinally?.();
    }
}
//# sourceMappingURL=executor-core.js.map