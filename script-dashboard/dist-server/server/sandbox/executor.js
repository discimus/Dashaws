import { executeScript as coreExecuteScript } from '../../src/shared/executor-core.js';
import { createServerSandboxGlobals, cleanupServerTimers } from './globals.js';
import { maskState } from '../../src/shared/mask.js';
import { SERVER_BLOCKED_GLOBALS } from '../../src/shared/blocked-globals.js';
const serverConfig = {
    blockedGlobals: SERVER_BLOCKED_GLOBALS,
    createGlobals(cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog) {
        return createServerSandboxGlobals(cellState, env, secrets, secretsObj, props, cellsApi, signal, onLog);
    },
    maskState,
    onFinally: cleanupServerTimers,
};
export async function executeScript(script, cellState, env, secrets, secretsObj, props, cellsApi, signal) {
    return coreExecuteScript(script, cellState, env, secrets, secretsObj, props, cellsApi, signal, serverConfig);
}
//# sourceMappingURL=executor.js.map