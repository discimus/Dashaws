import { useState, useRef, useEffect } from 'react';
import type { Cell } from '../types/cell';
import { useCellsStore } from '../store/useCellsStore';
import { formatTimeAgo, stripComments } from '../utils/id';
import { PromptModal } from './PromptModal';

interface Props {
  onEditCell: (cellId: string) => void;
}

export function Overview({ onEditCell }: Props) {
  const { cells, addCell, startCell, stopCell, runOnce, clearOutput, runningIds, secretsLocked } = useCellsStore();

  if (cells.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-on-surface-variant mb-2 text-4xl">&#9633;</div>
        <p className="text-on-surface-variant mb-4">No scripts yet. Create your first script.</p>
        <button
          onClick={addCell}
          className="md-btn md-btn-filled px-5 py-2.5 text-base"
        >
          + Add Script
        </button>
      </div>
    );
  }

  const errorCount = cells.filter(c => c.status === 'error').length;
  const successCount = cells.filter(c => c.status === 'success').length;

  return (
    <div>
      <div className="sticky top-0 z-10 bg-surface pt-3 pb-3">
        <div className="grid grid-cols-4 gap-3">
          <StatBox label="Scripts" value={cells.length} color="text-primary" />
          <StatBox label="Running" value={runningIds.length} color="text-warning" />
          <StatBox label="Success" value={successCount} color="text-success" />
          <StatBox label="Errors" value={errorCount} color={errorCount > 0 ? 'text-error' : 'text-on-surface-variant'} />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-on-surface-variant uppercase tracking-wider">Scripts</h2>
          <span className="text-xs text-on-surface-variant">{cells.length} total</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {cells.map(cell => (
          <OverviewCard
            key={cell.id}
            cell={cell}
            isRunning={runningIds.includes(cell.id)}
            blocked={/\$secrets\./.test(stripComments(cell.script)) && secretsLocked}
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
    <div className="bg-surface-container border border-outline-variant rounded-xl px-4 py-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-on-surface-variant mt-0.5">{label}</div>
    </div>
  );
}

interface CardProps {
  cell: Cell;
  isRunning: boolean;
  blocked: boolean;
  onEdit: () => void;
  onStart: () => void;
  onStop: () => void;
  onRunOnce: () => void;
  onClear: () => void;
}

function OverviewCard({ cell, isRunning, blocked, onEdit, onStart, onStop, onRunOnce, onClear }: CardProps) {
  const lastOutputs = cell.output.slice(-4);
  const [menuOpen, setMenuOpen] = useState(false);
  const [promptAction, setPromptAction] = useState<'start' | 'run' | null>(null);
  const [promptError, setPromptError] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const tryUnlockSecrets = useCellsStore(s => s.tryUnlockSecrets);

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
      if (promptAction === 'start') onStart();
      else if (promptAction === 'run') onRunOnce();
    } else {
      setPromptError('Incorrect password.');
    }
  };

  const handleStart = () => {
    if (blocked) {
      setPromptAction('start');
      setPromptError('');
    } else {
      onStart();
    }
  };

  const handleRun = () => {
    if (blocked) {
      setPromptAction('run');
      setPromptError('');
    } else {
      onRunOnce();
    }
  };

  return (
    <div
      className="md-card hover:border-outline transition-colors p-3 cursor-pointer"
      onClick={onEdit}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${
              cell.status === 'running'
                ? 'bg-warning animate-pulse'
                : cell.status === 'success'
                ? 'bg-success'
                : cell.status === 'error'
                ? 'bg-error'
                : 'bg-outline'
            }`}
          />
          <div className="min-w-0">
            <div className="text-sm font-medium truncate text-on-surface">{cell.name}</div>
            <div className="text-[10px] text-on-surface-variant">
              Every {formatInterval(cell.intervalMs)}
              {cell.lastRunAt && ` · ${formatTimeAgo(cell.lastRunAt)}`}
            </div>
          </div>
        </div>
        <span
              className={`text-[10px] font-medium uppercase flex-shrink-0 ml-2 ${
                cell.status === 'running'
                  ? 'text-warning'
                  : cell.status === 'error'
                  ? 'text-error'
                  : cell.status === 'success'
                  ? 'text-success'
                  : 'text-on-surface-variant'
              }`}
        >
          {cell.status}
        </span>
      </div>

      {lastOutputs.length > 0 && (
        <div className="border-t border-outline-variant pt-2 mb-2 min-h-0">
          {lastOutputs.map((entry, i: number) => (
            <div
              key={i}
              className={`text-[10px] font-mono leading-relaxed truncate ${
                entry.type === 'error'
                  ? 'text-error'
                  : entry.type === 'warn'
                  ? 'text-warning'
                  : 'text-on-surface-variant'
              }`}
            >
              <span className="text-on-surface-variant/70 mr-1">[{entry.type}]</span>
              {entry.args.map((a: unknown) => formatAtom(a)).join(' ')}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        {isRunning ? (
          <button
            onClick={onStop}
            className="md-btn md-btn-danger px-2.5 py-1 text-xs"
          >
            Stop
          </button>
        ) : (
          <button
            onClick={handleStart}
            title={blocked ? 'Secrets locked — click to unlock' : 'Loop'}
            className="md-btn md-btn-success px-2.5 py-1 text-xs"
          >
            {blocked && '\u{1F512} '}Loop
          </button>
        )}
        {!isRunning && (
          <button
            onClick={handleRun}
            title={blocked ? 'Secrets locked — click to unlock' : 'Run once'}
            className="md-btn md-btn-filled px-2.5 py-1 text-xs"
          >
            {blocked && '\u{1F512} '}Run once
          </button>
        )}
        <div className="flex-1" />
        <div ref={menuRef} className="relative">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="px-2 py-1 rounded-full text-[10px] font-semibold text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8 transition-colors"
            title="More actions"
          >
            &#8942;
          </button>
          {menuOpen && (
            <div className="md-menu absolute right-0 top-full mt-1 w-32 z-20">
              <button
                onClick={() => { onClear(); setMenuOpen(false); }}
                className="md-menu-item text-[10px] text-on-surface-variant hover:bg-on-surface/8"
              >
                Clear logs
              </button>
              <button
                onClick={onEdit}
                className="md-menu-item text-[10px] text-primary hover:bg-primary/10"
              >
                Edit script
              </button>
            </div>
          )}
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
