import { createServerSandboxGlobals, maskValue, clearTimerIds } from './globals.js';
const BLOCKED_GLOBALS = {
    globalThis: undefined,
    global: undefined,
    window: undefined,
    self: undefined,
    document: undefined,
    localStorage: undefined,
    sessionStorage: undefined,
    require: undefined,
    module: undefined,
    exports: undefined,
    __dirname: undefined,
    __filename: undefined,
    process: undefined,
    Function: undefined,
};
export async function executeScript(script, cellState, env, secrets, secretsObj, props, cellsApi, signal) {
    const output = [];
    const onLog = (entry) => output.push(entry);
    const globals = createServerSandboxGlobals(cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog);
    const blockedNames = Object.keys(BLOCKED_GLOBALS);
    const blockedValues = Object.values(BLOCKED_GLOBALS);
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
    try {
        const fn = new Function(...allNames, wrappedScript);
        await fn(...allValues);
        const maskedState = {};
        for (const [k, v] of Object.entries(cellState)) {
            maskedState[k] = maskValue(v, secrets);
        }
        return { success: true, output, state: maskedState };
    }
    catch (err) {
        if (signal.aborted) {
            output.push({ timestamp: Date.now(), type: 'warn', args: ['Execution aborted'] });
            return { success: true, output, state: { ...cellState } };
        }
        const errorMessage = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
        output.push({ timestamp: Date.now(), type: 'error', args: [errorMessage] });
        return { success: false, error: errorMessage, output, state: { ...cellState } };
    }
    finally {
        clearTimerIds();
    }
}
//# sourceMappingURL=executor.js.map