import { useState, useRef, useEffect } from 'react';
import { useCellsStore } from '../store/useCellsStore';
import type { Cell } from '../types/cell';
import { stripComments } from '../utils/id';
import { PromptModal } from './PromptModal';
import { ConfirmPopover } from './ConfirmPopover';

interface Props {
  cell: Cell;
}

const INTERVAL_PRESETS = [
  { label: '1s', value: 1000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
  { label: '5m', value: 300000 },
  { label: '15m', value: 900000 },
  { label: '30m', value: 1800000 },
  { label: '1h', value: 3600000 },
];

export function CellControls({ cell }: Props) {
  const { updateCell, deleteCell, startCell, stopCell, runOnce, clearOutput, runningIds, secretsLocked, tryUnlockSecrets } =
    useCellsStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(cell.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [promptAction, setPromptAction] = useState<'start' | 'run' | null>(null);
  const [promptError, setPromptError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isRunning = runningIds.includes(cell.id);

  const usesSecrets = /\$secrets\./.test(stripComments(cell.script));
  const blocked = usesSecrets && secretsLocked;

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handlePromptConfirm = async (password: string) => {
    const ok = await tryUnlockSecrets(password);
    if (ok) {
      setPromptAction(null);
      setPromptError('');
      if (promptAction === 'start') {
        startCell(cell.id);
      } else if (promptAction === 'run') {
        runOnce(cell.id);
      }
    } else {
      setPromptError('Incorrect password.');
    }
  };

  const handleStart = () => {
    if (blocked) {
      setPromptAction('start');
      setPromptError('');
    } else if (isRunning) {
      stopCell(cell.id);
    } else {
      startCell(cell.id);
    }
  };

  const handleRun = () => {
    if (blocked) {
      setPromptAction('run');
      setPromptError('');
    } else {
      runOnce(cell.id);
    }
  };

  const handleDelete = () => {
    deleteCell(cell.id);
  };

  const handleClearLogs = () => {
    clearOutput(cell.id);
    setMenuOpen(false);
  };

  const handleNameSubmit = () => {
    const trimmed = editingName.trim();
    if (trimmed && trimmed !== cell.name) {
      updateCell(cell.id, { name: trimmed });
    }
    setIsEditingName(false);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Name */}
      {isEditingName ? (
        <input
          type="text"
          value={editingName}
          autoFocus
          onChange={e => setEditingName(e.target.value)}
          onBlur={handleNameSubmit}
          onKeyDown={e => {
            if (e.key === 'Enter') handleNameSubmit();
            if (e.key === 'Escape') {
              setEditingName(cell.name);
              setIsEditingName(false);
            }
          }}
          className="bg-gray-800 border border-gray-500 rounded px-2 py-0.5 text-sm w-40 outline-none focus:border-blue-500"
        />
      ) : (
        <span
          className="text-sm font-medium cursor-pointer hover:text-blue-400"
          onClick={() => {
            setEditingName(cell.name);
            setIsEditingName(true);
          }}
          title="Click to rename"
        >
          {cell.name}
        </span>
      )}

      {/* Interval */}
      <div className="flex items-center gap-1">
        <select
          value={cell.intervalMs}
          onChange={e => updateCell(cell.id, { intervalMs: Number(e.target.value) })}
          className="bg-gray-800 border border-gray-500 rounded px-1.5 py-0.5 text-xs outline-none"
        >
          {INTERVAL_PRESETS.map(p => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Status Badge */}
      <span
        className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider ${
          cell.status === 'running'
            ? 'text-yellow-400'
            : cell.status === 'success'
            ? 'text-green-400'
            : cell.status === 'error'
            ? 'text-red-400'
            : 'text-gray-400'
        }`}
      >
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            cell.status === 'running'
              ? 'bg-yellow-400 animate-pulse'
              : cell.status === 'success'
              ? 'bg-green-400'
              : cell.status === 'error'
              ? 'bg-red-400'
              : 'bg-gray-500'
          }`}
        />
        {cell.status}
      </span>

      {/* Buttons */}
      <div className="flex items-center gap-1 ml-auto">
        <button
          onClick={handleStart}
          title={blocked ? 'Secrets locked — click to unlock' : isRunning ? 'Stop' : 'Start'}
          className={`px-2.5 py-1 rounded text-xs font-semibold transition-colors ${
            isRunning
              ? 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isRunning ? 'Stop' : <>{blocked && '\u{1F512} '}Start</>}
        </button>

        {!isRunning && (
          <button
            onClick={handleRun}
            title={blocked ? 'Secrets locked — click to unlock' : 'Run once'}
            className="px-2.5 py-1 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            {blocked && '\u{1F512} '}Run
          </button>
        )}

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="px-2 py-1 rounded text-xs font-semibold text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            title="More actions"
          >
            &#8942;
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-36 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-20 py-1">
              <button
                onClick={handleClearLogs}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Clear logs
              </button>
              <button
                onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                className="w-full text-left px-3 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-900/30 transition-colors"
              >
                Delete
              </button>
            </div>
          )}
          <ConfirmPopover
            open={confirmDelete}
            message={`Delete "${cell.name}"?`}
            onConfirm={() => { setConfirmDelete(false); handleDelete(); }}
            onCancel={() => setConfirmDelete(false)}
          />
        </div>
      </div>

      <PromptModal
        open={promptAction !== null}
        onCancel={() => { setPromptAction(null); setPromptError(''); }}
        onConfirm={handlePromptConfirm}
        error={promptError}
      />
    </div>
  );
}
