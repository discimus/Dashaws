import { useEffect, useRef } from 'react';
import { useCellsStore } from '../store/useCellsStore';
import { CellCard } from './CellCard';

interface Props {
  focusCellId: string | null;
  onFocusHandled: () => void;
  onNavigateHelp: () => void;
}

export function ScriptsView({ focusCellId, onFocusHandled, onNavigateHelp }: Props) {
  const { cells, addCell, selectedIds } = useCellsStore();
  const focusRef = useRef<HTMLDivElement>(null);

  const filtered = selectedIds.length > 0 ? cells.filter(c => selectedIds.includes(c.id)) : cells;

  useEffect(() => {
    if (focusCellId && focusRef.current) {
      focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      onFocusHandled();
    }
  }, [focusCellId, onFocusHandled]);

  if (cells.length === 0) {
    return (
      <div className="text-center py-20">
        <p className="text-on-surface-variant mb-4">No scripts configured yet.</p>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={onNavigateHelp}
            className="md-btn md-btn-tonal px-4 py-2 text-base"
          >
            ? Help
          </button>
          <button
            onClick={addCell}
            className="md-btn md-btn-filled px-4 py-2 text-base"
          >
            + Add Script
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between sticky top-0 z-10 bg-surface pt-3 pb-3">
        <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">
          Scripts {selectedIds.length > 0 ? `(${selectedIds.length}/${cells.length})` : `(${cells.length})`}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={onNavigateHelp}
            className="md-btn md-btn-tonal px-3 py-1.5 text-sm"
            title="Open script reference documentation"
          >
            ? Help
          </button>
          <button
            onClick={addCell}
            className="md-btn md-btn-filled px-3 py-1.5 text-sm"
          >
            + Add Script
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {filtered.map(cell => (
          <div
            key={cell.id}
            ref={cell.id === focusCellId ? focusRef : undefined}
          >
            <CellCard
              cell={cell}
              highlighted={cell.id === focusCellId}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
