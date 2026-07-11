import { useState, useRef, useEffect } from 'react';
import { useCellsStore } from '../store/useCellsStore';
import { formatTimeAgo } from '../utils/id';
import { ConfirmPopover } from './ConfirmPopover';
import type { View } from '../App';

interface Props {
  view: View;
  onViewChange: (v: View) => void;
  onEditCell: (cellId: string) => void;
}

export function Sidebar({ view, onViewChange, onEditCell }: Props) {
  const { cells, addCell, runningIds, secretsLocked, secretsBlob, selectedIds, toggleSelected, clearSelection, startSelected, stopSelected, deleteSelected } = useCellsStore();
  const hasSecrets = secretsBlob !== null;
  const allSelectedRunning = selectedIds.length > 0 && selectedIds.every(id => runningIds.includes(id));
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  return (
    <aside className="flex-shrink-0 w-64 bg-surface-container border-r border-outline-variant flex flex-col min-h-0">
      <nav className="flex-shrink-0 p-3 space-y-1">
        <SidebarLink active={view === 'overview'} onClick={() => onViewChange('overview')} label="Overview"
          info="Dashboard overview showing all scripts at a glance. Monitor statuses, recent outputs, and system stats in one place." />
        <SidebarLink active={view === 'scripts'} onClick={() => onViewChange('scripts')} label="Scripts"
          info="Create, edit, and run scripts on configurable intervals. Each script runs in an isolated sandbox. Supports JavaScript and Python runtimes." />
        <SidebarLink active={view === 'env'} onClick={() => onViewChange('env')} label="Environment"
          info="Environment variables accessible via $env.KEY (JS) or env['KEY'] (Python). Use for non-sensitive configuration like API URLs, feature flags, and settings." />
        <SidebarLink active={view === 'secrets'} onClick={() => onViewChange('secrets')} label={`Secrets ${hasSecrets ? (secretsLocked ? '\uD83D\uDD12' : '\uD83D\uDD13') : ''}`}
          info="Encrypted secrets via $secrets.KEY (JS) or secrets['KEY'] (Python). AES-GCM + PBKDF2 encrypted. Values are masked in logs. Password-protected." />
        <SidebarLink active={view === 'queues'} onClick={() => onViewChange('queues')} label="Queues"
          info="FIFO message queues (like SQS). Scripts subscribe and process messages in order. Enqueue via $queue.enqueue() (JS) or queue.enqueue() (Python)." />
        <SidebarLink active={view === 'pubsub'} onClick={() => onViewChange('pubsub')} label="Pub/Sub"
          info="Broadcast event topics (like SNS). Emitting an event triggers all subscribed scripts immediately. Use $pubsub.emit() (JS) or pubsub.emit() (Python)." />
        <SidebarLink active={view === 'crons'} onClick={() => onViewChange('crons')} label="Cronjobs"
          info="Schedule scripts, queues, or pub/sub events using cron expressions (min hour dom month dow). Supports */n intervals, ranges, and comma-separated values. Polled every 15s." />
      </nav>

      <div className="flex-shrink-0 mx-3 my-1 border-t border-outline-variant" />

      <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">Scripts</span>
        <div className="flex items-center gap-1">
          {selectedIds.length > 0 && (
            <button onClick={clearSelection} className="text-[10px] text-primary hover:text-on-surface transition-colors">
              {selectedIds.length} selected
            </button>
          )}
          <div ref={menuRef} className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="px-1.5 py-0.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8 text-sm font-bold transition-colors">
              &#8942;
            </button>
            {menuOpen && (
              <div className="md-menu absolute left-0 top-full mt-1 w-36 z-30">
                <button
                  onClick={() => { setMenuOpen(false); setConfirmDeleteAll(true); }}
                  disabled={selectedIds.length === 0}
                  className={`md-menu-item ${
                    selectedIds.length > 0 ? 'text-error hover:bg-error/10' : 'text-on-surface-variant/40 cursor-not-allowed'
                  }`}
                >
                  Delete {selectedIds.length || ''}
                </button>
              </div>
            )}
            <ConfirmPopover
              open={confirmDeleteAll}
                message={`Delete ${selectedIds.length} script${selectedIds.length !== 1 ? 's' : ''}?`}
              onConfirm={() => { deleteSelected(); setConfirmDeleteAll(false); }}
              onCancel={() => setConfirmDeleteAll(false)}
            />
          </div>
        </div>
      </div>

      <div className="flex-1 px-2 space-y-0.5 overflow-y-auto">
        {cells.map(cell => {
          const isRunning = runningIds.includes(cell.id);
          const isSelected = selectedIds.includes(cell.id);
          return (
            <button
              key={cell.id}
              onClick={(e) => {
                if (e.ctrlKey || e.metaKey) {
                  toggleSelected(cell.id, true);
                } else {
                  toggleSelected(cell.id, false);
                  onEditCell(cell.id);
                }
              }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-full text-sm text-left font-medium transition-colors ${
                isSelected
                  ? 'bg-primary-container text-on-primary-container'
                  : view === 'scripts' && cell.status === 'running'
                  ? 'bg-surface-container-high text-on-surface'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8'
              }`}
              title={`${cell.name}\n${cell.status} · ${cell.lastRunAt ? formatTimeAgo(cell.lastRunAt) : 'Not run'}`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isRunning ? 'bg-warning animate-pulse' :
                cell.status === 'success' ? 'bg-success' :
                cell.status === 'error' ? 'bg-error' :
                'bg-outline'
              }`} />
              <span className="truncate">{cell.name}</span>
              {isRunning && (
                <span className="text-[9px] text-warning ml-auto flex-shrink-0">{formatInterval(cell.intervalMs)}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-shrink-0 p-3 border-t border-outline-variant">
        {selectedIds.length > 0 ? (
          <div className="flex gap-1.5">
            <button
              onClick={() => selectedIds.forEach(id => useCellsStore.getState().runOnce(id))}
              className="md-btn md-btn-filled flex-1 px-2 py-2 text-sm"
            >
              Run once {selectedIds.length}
            </button>
            {allSelectedRunning ? (
              <button onClick={stopSelected} className="md-btn md-btn-danger flex-1 px-2 py-2 text-sm">
                Stop {selectedIds.length}
              </button>
            ) : (
              <button onClick={startSelected} className="md-btn md-btn-success flex-1 px-2 py-2 text-sm">
                Start {selectedIds.length}
              </button>
            )}
          </div>
        ) : (
          <button onClick={addCell} className="md-btn md-btn-filled w-full px-4 py-2.5 text-base">
            + Add Script
          </button>
        )}
      </div>
    </aside>
  );
}

function SidebarLink({ active, onClick, label, info }: { active: boolean; onClick: () => void; label: string; info?: string }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-2.5 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
      active ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8'
    }`}>
      <span>{label}</span>
      {info && (
        <span className="text-on-surface-variant hover:text-on-surface cursor-help text-xs flex-shrink-0" title={info}>
          <svg width="13" height="13" viewBox="0 0 13 13" className="inline-block align-middle shrink-0"><circle cx="6.5" cy="6.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6"/><text x="6.5" y="9.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor" opacity="0.8">?</text></svg>
        </span>
      )}
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
