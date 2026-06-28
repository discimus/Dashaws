import { useCellsStore } from '../store/useCellsStore';

export function TopBar() {
  const { cells, stopAll, runningIds, secretsBlob, keepUnlocked, toggleKeepUnlocked, keepAlive, toggleKeepAlive } = useCellsStore();
  const activeCount = runningIds.length;
  const hasSecrets = secretsBlob !== null;

  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-700 h-12 flex items-center z-30">
      <div className="flex items-center justify-between w-full px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold tracking-tight">Script Dashboard</h1>
          <span className="text-xs text-gray-500">
            {cells.length} script{cells.length !== 1 ? 's' : ''}
          </span>
          {activeCount > 0 && (
            <span className="text-xs text-yellow-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              {activeCount} running
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <button
              onClick={toggleKeepAlive}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors border ${
                keepAlive
                  ? 'bg-green-600/20 border-green-600/30 text-green-400'
                  : 'bg-gray-800 border-gray-600 text-gray-500 hover:text-gray-300'
              }`}
            >
              <span>{keepAlive ? '⏳' : '⌛'}</span>
              Keep alive
            </button>
            <span
              className="text-gray-400 hover:text-gray-200 cursor-help text-xs"
              title="Keep-alive prevents the browser from sleeping or throttling script timers. It uses the Wake Lock API (keeps screen on) and a silent audio loop (prevents timer throttling in background tabs). Enable this for long-running scripts that need consistent interval timing."
            >
              &#9432;
            </span>
          </span>

          {hasSecrets && (
            <span className="inline-flex items-center gap-1.5">
              <button
                onClick={toggleKeepUnlocked}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors border ${
                  keepUnlocked
                    ? 'bg-yellow-600/20 border-yellow-600/30 text-yellow-400'
                    : 'bg-gray-800 border-gray-600 text-gray-500 hover:text-gray-300'
                }`}
              >
                <span>{keepUnlocked ? '\u{1F513}' : '\u{1F512}'}</span>
                Keep unlocked
              </button>
              <span
                className="text-gray-400 hover:text-gray-200 cursor-help text-xs"
                title="Auto-unlock keeps your secrets password in session storage, so you don't have to re-enter it on every page refresh. Secrets are decrypted automatically on load when this is active. Disable if you want to manually enter the password each time for extra security."
              >
                &#9432;
              </span>
            </span>
          )}

          {activeCount > 0 && (
            <button
              onClick={stopAll}
              className="px-4 py-1.5 rounded text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
            >
              Stop All
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
