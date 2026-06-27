import { useCellsStore } from '../store/useCellsStore';

export function TopBar() {
  const { cells, startAll, stopAll, runningIds } = useCellsStore();
  const activeCount = runningIds.length;

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
    </header>
  );
}
