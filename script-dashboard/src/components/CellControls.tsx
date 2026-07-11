import { useState, useRef, useEffect } from 'react';
import { useCellsStore } from '../store/useCellsStore';
import type { Cell } from '../types/cell';
import { stripComments } from '../utils/id';
import { PromptModal } from './PromptModal';
import { ConfirmPopover } from './ConfirmPopover';

interface Props {
  cell: Cell;
  onToggleParams: () => void;
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

const TIMEOUT_PRESETS = [
  { label: 'No limit', value: 0 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
  { label: '1m', value: 60000 },
  { label: '5m', value: 300000 },
  { label: '15m', value: 900000 },
  { label: '30m', value: 1800000 },
  { label: '1h', value: 3600000 },
];

export function CellControls({ cell, onToggleParams }: Props) {
  const { updateCell, deleteCell, startCell, stopCell, runOnce, clearOutput, runningIds, secretsLocked, tryUnlockSecrets, clientId } =
    useCellsStore();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editingName, setEditingName] = useState(cell.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [promptAction, setPromptAction] = useState<'start' | 'run' | null>(null);
  const [promptError, setPromptError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const isRunning = runningIds.includes(cell.id);
  const lockedByOther = cell.lockedBy != null && cell.lockedBy !== clientId;

  let parsedCount = 0;
  try { parsedCount = Object.keys(JSON.parse(cell.params || '{}')).length; } catch { /* invalid */ }

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
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
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
          className="md-field px-2 py-0.5 text-sm w-40"
        />
      ) : (
        <span
          className={`text-sm font-medium flex-shrink-0 ${
            lockedByOther
              ? 'text-on-surface-variant/50 cursor-not-allowed'
              : 'cursor-pointer text-on-surface hover:text-primary'
          }`}
          onClick={() => {
            if (lockedByOther) return;
            setEditingName(cell.name);
            setIsEditingName(true);
          }}
          title={lockedByOther ? 'Locked by another client' : 'Click to rename'}
        >
          {cell.name}
        </span>
      )}

      {/* Actions */}
      <div className="flex-1 flex flex-wrap items-center justify-center gap-1 min-w-0">
        <select
          value={cell.intervalMs}
          onChange={e => updateCell(cell.id, { intervalMs: Number(e.target.value) })}
          className="min-w-18 md-field px-1.5 py-0.5 text-xs"
          title="Interval between runs"
        >
          {INTERVAL_PRESETS.map(p => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <select
          value={cell.timeoutMs ?? 0}
          onChange={e => updateCell(cell.id, { timeoutMs: Number(e.target.value) || null })}
          className="md-field px-1.5 py-0.5 text-xs"
          title="Max execution time per run (0 = no limit)"
        >
          {TIMEOUT_PRESETS.map(p => (
            <option key={p.value} value={p.value}>
              {'\u23F1'} {p.label}
            </option>
          ))}
        </select>
        <button
          onClick={handleStart}
          title={blocked ? 'Secrets locked — click to unlock' : isRunning ? 'Stop' : 'Loop'}
          className={`md-btn px-2 py-0.5 text-xs ${
            isRunning ? 'md-btn-danger' : 'md-btn-success'
          }`}
        >
          {isRunning ? 'Stop' : <>{blocked && '\u{1F512} '}Loop</>}
        </button>
        {!isRunning && (
          <button
            onClick={handleRun}
            title={blocked ? 'Secrets locked — click to unlock' : 'Run once'}
            className="md-btn md-btn-filled px-2 py-0.5 text-xs"
          >
            {blocked && '\u{1F512} '}Run once
          </button>
        )}
      </div>

      {/* Right side: params, status, menu */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="inline-flex items-center gap-1.5">
          <button
            onClick={onToggleParams}
            className={`text-[10px] font-medium transition-colors ${
              parsedCount > 0 ? 'text-warning' : 'text-on-surface-variant hover:text-on-surface'
            }`}
            title="Edit parameters ($props)"
          >
            {parsedCount > 0 ? `⚙ ${parsedCount}` : '⚙'}
          </button>
          <span
            className="text-on-surface-variant hover:text-on-surface cursor-help text-xs"
            title="Parameters define $props values passed into scripts. Overridden by queue or pubsub message bodies. Access inside scripts as $props.key."
          >
            <svg width="13" height="13" viewBox="0 0 13 13" className="inline-block align-middle shrink-0"><circle cx="6.5" cy="6.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6"/><text x="6.5" y="9.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor" opacity="0.8">?</text></svg>
          </span>
        </span>

        <span
          className={`inline-flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider ${
            cell.status === 'running'
              ? 'text-warning'
              : cell.status === 'success'
              ? 'text-success'
              : cell.status === 'error'
              ? 'text-error'
              : 'text-on-surface-variant'
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              cell.status === 'running'
                ? 'bg-warning animate-pulse'
                : cell.status === 'success'
                ? 'bg-success'
                : cell.status === 'error'
                ? 'bg-error'
                : 'bg-outline'
            }`}
          />
          {cell.status}
        </span>

        {cell.lockedBy && (
          <span
            className={`text-[10px] font-medium ${
              cell.lockedBy === clientId ? 'text-primary' : 'text-warning'
            }`}
            title={cell.lockedBy === clientId ? 'You are editing this script' : `Locked by client ${cell.lockedBy}`}
          >
            {cell.lockedBy === clientId ? '\u270F\uFE0F' : '\u{1F512}'}
          </span>
        )}

        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="px-2 py-1 rounded-full text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8 transition-colors"
            title="More actions"
          >
            &#8942;
          </button>
          {menuOpen && (
            <div className="md-menu absolute right-0 top-full mt-1 w-36 z-20">
              <button
                onClick={handleClearLogs}
                className="md-menu-item text-on-surface-variant hover:bg-on-surface/8"
              >
                Clear logs
              </button>
              <button
                onClick={() => { setMenuOpen(false); setConfirmDelete(true); }}
                className="md-menu-item text-error hover:bg-error/10"
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
