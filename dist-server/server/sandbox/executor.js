import { executeScript as coreExecuteScript } from '../../src/shared/executor-core.js';
import { createServerSandboxGlobals, clearTimerIds } from './globals.js';
import { maskState } from '../../src/shared/mask.js';
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
const serverConfig = {
    blockedGlobals: BLOCKED_GLOBALS,
    createGlobals(cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog) {
        return createServerSandboxGlobals(cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog);
    },
    maskState,
    onFinally: clearTimerIds,
};
export async function executeScript(script, cellState, env, secrets, secretsObj, props, cellsApi, signal) {
    return coreExecuteScript(script, cellState, env, secrets, secretsObj, props, cellsApi, signal, serverConfig);
}
//# sourceMappingURL=executor.js.map