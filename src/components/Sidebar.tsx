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
    <aside className="flex-shrink-0 w-64 bg-gray-900 border-r border-gray-700 flex flex-col min-h-0">
      <nav className="flex-shrink-0 p-3 space-y-1.5">
        <SidebarLink active={view === 'overview'} onClick={() => onViewChange('overview')} label="Overview"
          info="Dashboard overview showing all scripts at a glance. Monitor statuses, recent outputs, and system stats in one place." />
        <SidebarLink active={view === 'scripts'} onClick={() => onViewChange('scripts')} label="Scripts"
          info="Create, edit, and run JavaScript scripts on configurable intervals. Each script runs in an isolated sandbox with strict mode and blocked dangerous globals." />
        <SidebarLink active={view === 'env'} onClick={() => onViewChange('env')} label="Environment"
          info="Environment variables accessible inside scripts via $env.KEY. Use for non-sensitive configuration like API URLs, feature flags, and settings." />
        <SidebarLink active={view === 'secrets'} onClick={() => onViewChange('secrets')} label={`Secrets ${hasSecrets ? (secretsLocked ? '\uD83D\uDD12' : '\uD83D\uDD13') : ''}`}
          info="Encrypted secrets stored with AES-GCM + PBKDF2. Accessible via $secrets.KEY. Values are masked in logs to prevent leakage. Password-protected." />
        <SidebarLink active={view === 'queues'} onClick={() => onViewChange('queues')} label="Queues"
          info="FIFO message queues (like SQS). Scripts subscribe and process messages in order. Enqueue via $queue.enqueue(name, body) inside scripts." />
        <SidebarLink active={view === 'pubsub'} onClick={() => onViewChange('pubsub')} label="Pub/Sub"
          info="Broadcast event topics (like SNS). Emitting an event triggers all subscribed scripts immediately. Use $pubsub.emit(name, body) inside scripts." />
        <SidebarLink active={view === 'crons'} onClick={() => onViewChange('crons')} label="Cronjobs"
          info="Schedule scripts, queues, or pub/sub events using cron expressions (min hour dom month dow). Supports */n intervals, ranges, and comma-separated values. Polled every 15s." />
      </nav>

      <div className="flex-shrink-0 mx-3 my-1 border-t border-gray-700" />

      <div className="flex-shrink-0 px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Scripts</span>
        <div className="flex items-center gap-1">
          {selectedIds.length > 0 && (
            <button onClick={clearSelection} className="text-[9px] text-gray-500 hover:text-gray-300 transition-colors">
              {selectedIds.length} selected
            </button>
          )}
          <div ref={menuRef} className="relative">
            <button onClick={() => setMenuOpen(!menuOpen)} className="px-1 py-0.5 text-gray-500 hover:text-gray-300 text-[10px] font-bold">
              &#8942;
            </button>
            {menuOpen && (
              <div className="absolute left-0 top-full mt-1 w-36 bg-gray-800 border border-gray-600 rounded-lg shadow-lg z-30 py-1">
                <button
                  onClick={() => { setMenuOpen(false); setConfirmDeleteAll(true); }}
                  disabled={selectedIds.length === 0}
                  className={`w-full text-left px-3 py-1.5 text-xs font-semibold transition-colors ${
                    selectedIds.length > 0 ? 'text-red-400 hover:bg-red-900/30' : 'text-gray-600 cursor-not-allowed'
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
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded text-sm text-left font-medium transition-colors ${
                isSelected
                  ? 'bg-blue-600/30 text-blue-200 ring-1 ring-blue-500/50'
                  : view === 'scripts' && cell.status === 'running'
                  ? 'bg-gray-700/80 text-gray-100'
                  : 'text-gray-300 hover:text-white hover:bg-gray-700/40'
              }`}
              title={`${cell.name}\n${cell.status} · ${cell.lastRunAt ? formatTimeAgo(cell.lastRunAt) : 'Not run'}`}
            >
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                isRunning ? 'bg-yellow-400 animate-pulse' :
                cell.status === 'success' ? 'bg-green-400' :
                cell.status === 'error' ? 'bg-red-400' :
                'bg-gray-500'
              }`} />
              <span className="truncate">{cell.name}</span>
              {isRunning && (
                <span className="text-[9px] text-yellow-500/70 ml-auto flex-shrink-0">{formatInterval(cell.intervalMs)}</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="flex-shrink-0 p-3 border-t border-gray-700">
        {selectedIds.length > 0 ? (
          <div className="flex gap-1.5">
            <button
              onClick={() => selectedIds.forEach(id => useCellsStore.getState().runOnce(id))}
              className="flex-1 px-2 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
            >
              Run once {selectedIds.length}
            </button>
            {allSelectedRunning ? (
              <button onClick={stopSelected} className="flex-1 px-2 py-2 rounded text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors">
                Stop {selectedIds.length}
              </button>
            ) : (
              <button onClick={startSelected} className="flex-1 px-2 py-2 rounded text-xs font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors">
                Start {selectedIds.length}
              </button>
            )}
          </div>
        ) : (
          <button onClick={addCell} className="w-full px-4 py-2.5 rounded text-sm font-semibold bg-blue-600/60 hover:bg-blue-600 text-white transition-colors">
            + Add Script
          </button>
        )}
      </div>
    </aside>
  );
}

function SidebarLink({ active, onClick, label, info }: { active: boolean; onClick: () => void; label: string; info?: string }) {
  return (
    <button onClick={onClick} className={`w-full text-left px-4 py-2.5 rounded text-sm font-semibold transition-colors flex items-center gap-2 ${
      active ? 'bg-gray-700 text-white' : 'text-gray-300 hover:text-white hover:bg-gray-700/40'
    }`}>
      <span>{label}</span>
      {info && (
        <span className="text-gray-400 hover:text-gray-200 cursor-help text-xs flex-shrink-0" title={info}>
          &#9432;
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
