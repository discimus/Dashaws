import { useCellsStore } from '../store/useCellsStore';
import { formatTimeAgo } from '../utils/id';
import type { View } from '../App';

interface Props {
  view: View;
  onViewChange: (v: View) => void;
  onEditCell: (cellId: string) => void;
}

export function Sidebar({ view, onViewChange, onEditCell }: Props) {
  const { cells, addCell, runningIds } = useCellsStore();

  return (
    <aside className="flex-shrink-0 w-56 bg-gray-950 border-r border-gray-800 flex flex-col min-h-0">
      <nav className="flex-shrink-0 p-3 space-y-1">
        <SidebarLink
          active={view === 'overview'}
          onClick={() => onViewChange('overview')}
          label="Overview"
        />
        <SidebarLink
          active={view === 'scripts'}
          onClick={() => onViewChange('scripts')}
          label="Scripts"
        />
      </nav>

      <div className="flex-shrink-0 mx-3 my-1 border-t border-gray-800" />

      <div className="flex-shrink-0 px-3 py-1.5">
        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
          Cells
        </span>
      </div>

      <div className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {cells.map(cell => {
          const isRunning = runningIds.includes(cell.id);
          return (
            <button
              key={cell.id}
              onClick={() => onEditCell(cell.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs text-left transition-colors ${
                view === 'scripts' && cell.status === 'running'
                  ? 'bg-gray-800/80 text-gray-200'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
              }`}
              title={`${cell.name}\n${cell.status} · ${cell.lastRunAt ? formatTimeAgo(cell.lastRunAt) : 'Not run'}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  isRunning
                    ? 'bg-yellow-400 animate-pulse'
                    : cell.status === 'success'
                    ? 'bg-green-400'
                    : cell.status === 'error'
                    ? 'bg-red-400'
                    : 'bg-gray-600'
                }`}
              />
              <span className="truncate">{cell.name}</span>
              {isRunning && (
                <span className="text-[9px] text-yellow-500/70 ml-auto flex-shrink-0">
                  {formatInterval(cell.intervalMs)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-shrink-0 p-2 border-t border-gray-800">
        <button
          onClick={addCell}
          className="w-full px-2 py-1.5 rounded text-xs font-medium bg-blue-600/60 hover:bg-blue-600 text-white transition-colors"
        >
          + Add Cell
        </button>
      </div>
    </aside>
  );
}

function SidebarLink({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1.5 rounded text-xs font-medium transition-colors ${
        active
          ? 'bg-gray-800 text-white'
          : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/40'
      }`}
    >
      {label}
    </button>
  );
}

function formatInterval(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s}s`;
  const m = s / 60;
  if (m < 60) return `${m}m`;
  const h = m / 60;
  return `${h}h`;
}
