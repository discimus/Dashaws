import { useState, useEffect } from 'react';
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

const MIN_EDITOR_LINES = 12;

export function CellCard({ cell, highlighted }: Props) {
  const [showParams, setShowParams] = useState(false);
  const [editorExpanded, setEditorExpanded] = useState(false);
  const clientId = useCellsStore(s => s.clientId);
  const lockedByOther = cell.lockedBy != null && cell.lockedBy !== clientId;

  const editorLines = cell.script.split('\n').length;
  const collapsible = editorLines > MIN_EDITOR_LINES;

  useEffect(() => {
    setEditorExpanded(false);
  }, [cell.id]);

  return (
    <div className={`border rounded-xl overflow-hidden bg-surface-container-low transition-colors ${
      highlighted ? 'script-flash' : lockedByOther ? 'border-warning/70' : cell.status === 'running' ? 'border-warning ring-2 ring-warning/30' : 'border-outline-variant hover:border-outline'
    }`}>
      <div className="px-3 py-2 border-b border-outline-variant bg-surface-container">
        <CellControls cell={cell} onToggleParams={() => setShowParams(!showParams)} />
      </div>

      {showParams && (
        <PropsEditor cell={cell} onSave={(json) => {
          useCellsStore.getState().updateCell(cell.id, { params: json });
        }} />
      )}

      <div className={`${collapsible && !editorExpanded ? 'editor-collapsed' : ''}`}>
        <CellEditor cell={cell} onFocus={() => setEditorExpanded(true)} />
      </div>

      {collapsible && !editorExpanded && (
        <button
          onClick={() => setEditorExpanded(true)}
          className="w-full py-1.5 text-xs font-medium text-on-surface-variant hover:text-primary hover:bg-on-surface/4 transition-colors flex items-center justify-center gap-1 border-t border-outline-variant/40"
        >
          <span className="text-[10px]">Show more</span>
        </button>
      )}

      {collapsible && editorExpanded && (
        <button
          onClick={() => setEditorExpanded(false)}
          className="w-full py-1.5 text-xs font-medium text-on-surface-variant hover:text-primary hover:bg-on-surface/4 transition-colors flex items-center justify-center gap-1 border-t border-outline-variant/40"
        >
          <span className="text-[10px]">Show less</span>
        </button>
      )}

      <div className="px-3 py-1 border-t border-outline-variant bg-surface-container flex items-center justify-between text-[10px] text-on-surface-variant">
        <span className="flex items-center gap-2">
          <span>ID: {cell.id.slice(0, 8)}</span>
          <span className="bg-surface-container-highest px-1.5 py-0.5 rounded-full text-[9px] font-medium">{cell.language === 'python' ? 'Python' : 'JS'}</span>
          <span>{cell.script.split('\n').length} lines</span>
        </span>
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
