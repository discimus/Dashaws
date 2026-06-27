import { useEffect, useRef } from 'react';
import { useCellsStore } from '../store/useCellsStore';
import { CellCard } from './CellCard';

interface Props {
  focusCellId: string | null;
  onFocusHandled: () => void;
}

export function ScriptsView({ focusCellId, onFocusHandled }: Props) {
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
        <p className="text-gray-400 mb-4">No scripts configured yet.</p>
        <button
          onClick={addCell}
          className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm transition-colors"
        >
          + Add Cell
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between sticky top-0 z-10 bg-gray-800 pt-3 pb-3">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
          Scripts {selectedIds.length > 0 ? `(${selectedIds.length}/${cells.length})` : `(${cells.length})`}
        </h2>
        <button
          onClick={addCell}
          className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          + Add Cell
        </button>
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
