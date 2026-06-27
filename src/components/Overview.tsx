import type { Cell } from '../types/cell';
import { useCellsStore } from '../store/useCellsStore';
import { formatTimeAgo } from '../utils/id';

interface Props {
  onEditCell: (cellId: string) => void;
}

export function Overview({ onEditCell }: Props) {
  const { cells, addCell, startCell, stopCell, runOnce, clearOutput, runningIds } = useCellsStore();

  if (cells.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-gray-400 mb-2 text-4xl">&#9633;</div>
        <p className="text-gray-400 mb-4">No cells yet. Create your first script cell.</p>
        <button
          onClick={addCell}
          className="px-5 py-2.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
        >
          + Add Cell
        </button>
      </div>
    );
  }

  const errorCount = cells.filter(c => c.status === 'error').length;
  const successCount = cells.filter(c => c.status === 'success').length;

  return (
    <div>
      <div className="sticky top-0 z-10 bg-gray-800 pt-3 pb-3">
        <div className="grid grid-cols-4 gap-3">
          <StatBox label="Cells" value={cells.length} color="text-blue-400" />
          <StatBox label="Running" value={runningIds.length} color="text-yellow-400" />
          <StatBox label="Success" value={successCount} color="text-green-400" />
          <StatBox label="Errors" value={errorCount} color={errorCount > 0 ? 'text-red-400' : 'text-gray-500'} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Cells</h2>
          <span className="text-xs text-gray-400">{cells.length} total</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {cells.map(cell => (
          <OverviewCard
            key={cell.id}
            cell={cell}
            isRunning={runningIds.includes(cell.id)}
            onEdit={() => onEditCell(cell.id)}
            onStart={() => startCell(cell.id)}
            onStop={() => stopCell(cell.id)}
            onRunOnce={() => runOnce(cell.id)}
            onClear={() => clearOutput(cell.id)}
          />
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{label}</div>
    </div>
  );
}

interface CardProps {
  cell: Cell;
  isRunning: boolean;
  onEdit: () => void;
  onStart: () => void;
  onStop: () => void;
  onRunOnce: () => void;
  onClear: () => void;
}

function OverviewCard({ cell, isRunning, onEdit, onStart, onStop, onRunOnce, onClear }: CardProps) {
  const lastOutputs = cell.output.slice(-4);

  return (
    <div
      className="border border-gray-600 rounded-lg bg-gray-700/60 hover:border-gray-500 transition-colors p-3 cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${
              cell.status === 'running'
                ? 'bg-yellow-400 animate-pulse'
                : cell.status === 'success'
                ? 'bg-green-400'
                : cell.status === 'error'
                ? 'bg-red-400'
                : 'bg-gray-500'
            }`}
          />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{cell.name}</div>
            <div className="text-[10px] text-gray-400">
              Every {formatInterval(cell.intervalMs)}
              {cell.lastRunAt && ` · ${formatTimeAgo(cell.lastRunAt)}`}
            </div>
          </div>
        </div>
        <span
              className={`text-[10px] font-medium uppercase flex-shrink-0 ml-2 ${
                cell.status === 'running'
                  ? 'text-yellow-400'
                  : cell.status === 'error'
                  ? 'text-red-400'
                  : cell.status === 'success'
                  ? 'text-green-400'
                  : 'text-gray-400'
              }`}
        >
          {cell.status}
        </span>
      </div>

      {lastOutputs.length > 0 && (
        <div className="border-t border-gray-600/50 pt-2 mb-2 min-h-0">
          {lastOutputs.map((entry, i: number) => (
            <div
              key={i}
              className={`text-[10px] font-mono leading-relaxed truncate ${
                entry.type === 'error'
                  ? 'text-red-400'
                  : entry.type === 'warn'
                  ? 'text-yellow-400'
                  : 'text-gray-300'
              }`}
            >
              <span className="text-gray-400 mr-1">[{entry.type}]</span>
              {entry.args.map((a: unknown) => formatAtom(a)).join(' ')}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        {isRunning ? (
          <button
            onClick={onStop}
            className="px-2.5 py-1 rounded text-[10px] font-semibold bg-red-600/80 hover:bg-red-600 text-white transition-colors"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={onStart}
            className="px-2.5 py-1 rounded text-[10px] font-semibold bg-green-600/80 hover:bg-green-600 text-white transition-colors"
          >
            Start
          </button>
        )}
        {!isRunning && (
          <button
            onClick={onRunOnce}
            className="px-2.5 py-1 rounded text-[10px] font-semibold bg-blue-600/60 hover:bg-blue-600 text-white transition-colors"
          >
            Run
          </button>
        )}
        <button
          onClick={onClear}
          className="px-2.5 py-1 rounded text-[10px] font-semibold bg-gray-600 hover:bg-gray-500 text-white transition-colors"
        >
          Clear
        </button>
        <div className="flex-1" />
        <button
          onClick={onEdit}
          className="px-2.5 py-1 rounded text-[10px] font-semibold bg-gray-600 hover:bg-gray-500 text-white transition-colors"
        >
          Edit
        </button>
      </div>
    </div>
  );
}

function formatAtom(val: unknown): string {
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
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
