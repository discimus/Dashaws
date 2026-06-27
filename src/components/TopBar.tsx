import { useCellsStore } from '../store/useCellsStore';

export function TopBar() {
  const { cells, startAll, stopAll, runningIds, secretsBlob, keepUnlocked, toggleKeepUnlocked } = useCellsStore();
  const activeCount = runningIds.length;
  const hasSecrets = secretsBlob !== null;

  return (
    <header className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-700 h-12 flex items-center z-30">
      <div className="flex items-center justify-between w-full px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold tracking-tight">Script Dashboard</h1>
          <span className="text-xs text-gray-500">
            {cells.length} cell{cells.length !== 1 ? 's' : ''}
          </span>
          {activeCount > 0 && (
            <span className="text-xs text-yellow-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
              {activeCount} running
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {hasSecrets && (
            <button
              onClick={toggleKeepUnlocked}
              title={keepUnlocked ? 'Auto-unlock enabled — click to disable' : 'Auto-unlock disabled — click to enable'}
              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors border ${
                keepUnlocked
                  ? 'bg-yellow-600/20 border-yellow-600/30 text-yellow-400'
                  : 'bg-gray-800 border-gray-600 text-gray-500 hover:text-gray-300'
              }`}
            >
              <span>{keepUnlocked ? '\u{1F513}' : '\u{1F512}'}</span>
              Keep unlocked
            </button>
          )}
          <div className="flex items-center gap-2">
            {activeCount > 0 && (
              <button
                onClick={stopAll}
                className="px-4 py-1.5 rounded text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                Stop All
              </button>
            )}
            {activeCount === 0 && cells.length > 0 && (
              <button
                onClick={startAll}
                className="px-4 py-1.5 rounded text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors"
              >
                Start All
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
