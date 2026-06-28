import { maskState } from './mask.js';
export async function executeScript(script, cellState, env, secrets, secretsObj, props, cellsApi, signal, config) {
    const output = [];
    const onLog = (entry) => output.push(entry);
    const globals = config.createGlobals(cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog);
    const blockedNames = Object.keys(config.blockedGlobals);
    const blockedValues = Object.values(config.blockedGlobals);
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
        if (signal.aborted) {
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