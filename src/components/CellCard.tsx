import { useState } from 'react';
import { useCellsStore } from '../store/useCellsStore';
import type { Cell } from '../types/cell';
import { CellEditor } from './CellEditor';
import { CellOutput } from './CellOutput';
import { CellControls } from './CellControls';
import { PropsEditor } from './PropsEditor';
import { formatTimeAgo } from '../utils/id';

interface Props {
  cell: Cell;
  highlighted?: boolean;
}

export function CellCard({ cell, highlighted }: Props) {
  const [showParams, setShowParams] = useState(false);

  return (
    <div className={`border rounded-lg overflow-hidden bg-gray-700/30 hover:border-gray-500 transition-colors ${
      highlighted ? 'cell-flash' : 'border-gray-600'
    }`}>
      <div className="px-3 py-2 border-b border-gray-600 bg-gray-700/70">
        <CellControls cell={cell} onToggleParams={() => setShowParams(!showParams)} />
      </div>

      {showParams && (
        <PropsEditor cell={cell} onSave={(json) => {
          useCellsStore.getState().updateCell(cell.id, { params: json });
        }} />
      )}

      <CellEditor cell={cell} />

      <div className="px-3 py-1 border-t border-gray-600 bg-gray-700/70 flex items-center justify-between text-[10px] text-gray-300">
        <span>Cell ID: {cell.id.slice(0, 8)}...</span>
        <span>
          {cell.lastRunAt ? `Last run: ${formatTimeAgo(cell.lastRunAt)}` : 'Not run yet'}
          {cell.enabled && ` · Every ${formatInterval(cell.intervalMs)}`}
        </span>
      </div>

      <CellOutput cell={cell} />
    </div>
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
