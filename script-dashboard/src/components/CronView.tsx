import { useState } from 'react';
import { useCellsStore, cronTargetsSecrets } from '../store/useCellsStore';
import { cronDescribe } from '../utils/cron';
import { JsonInput } from './JsonInput';
import { ConfirmPopover } from './ConfirmPopover';
import type { CronTarget } from '../types/cell';

export function CronView() {
  const { crons, cells, queues, eventTopics, addCron, deleteCron, toggleCron, runCronNow, editCron, secretsLocked } = useCellsStore();
  const [openAdd, setOpenAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newExpr, setNewExpr] = useState('*/5 * * * *');
  const [newTargetType, setNewTargetType] = useState<'cell' | 'queue' | 'pubsub'>('cell');
  const [newTargetName, setNewTargetName] = useState('');
  const [newPayload, setNewPayload] = useState('{}');
  const [editingCron, setEditingCron] = useState<string | null>(null);
  const [editExpr, setEditExpr] = useState('');
  const [editTargetType, setEditTargetType] = useState<'cell' | 'queue' | 'pubsub'>('cell');
  const [editTargetName, setEditTargetName] = useState('');
  const [editPayload, setEditPayload] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const targetTypeLabel = (t: 'cell' | 'queue' | 'pubsub') => t === 'cell' ? 'script' : t === 'pubsub' ? 'pub/sub' : t;

  const handleAdd = () => {
    if (!newName.trim() || !newExpr.trim() || !newTargetName.trim()) return;
    addCron({
      name: newName.trim(),
      expression: newExpr.trim(),
      target: { type: newTargetType, name: newTargetName.trim() },
      payload: newPayload,
      enabled: true,
    });
    setNewName('');
    setNewExpr('*/5 * * * *');
    setNewTargetType('cell');
    setNewTargetName('');
    setNewPayload('{}');
    setOpenAdd(false);
  };

  const startEdit = (name: string) => {
    const cron = crons.find(c => c.name === name);
    if (!cron) return;
    setEditingCron(name);
    setEditExpr(cron.expression);
    setEditTargetType(cron.target.type);
    setEditTargetName(cron.target.name);
    setEditPayload(cron.payload);
  };

  const handleEdit = (name: string) => {
    if (!editExpr.trim() || !editTargetName.trim()) return;
    editCron(name, {
      expression: editExpr.trim(),
      target: { type: editTargetType, name: editTargetName.trim() },
      payload: editPayload,
    });
    setEditingCron(null);
  };

  const targetOptions = (type: 'cell' | 'queue' | 'pubsub') => {
    switch (type) {
      case 'cell': return cells.map(c => ({ label: c.name, value: c.id }));
      case 'queue': return Object.keys(queues).map(k => ({ label: k, value: k }));
      case 'pubsub': return Object.keys(eventTopics).map(k => ({ label: k, value: k }));
    }
  };

  const targetLabel = (target: CronTarget) => {
    if (target.type === 'cell') {
      return cells.find(c => c.id === target.name)?.name || target.name;
    }
    return target.name;
  };

  return (
    <div>
      <div className="sticky top-0 z-10 bg-surface pt-3 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-on-surface uppercase tracking-wider">Cronjobs</h2>
          <p className="text-[11px] text-on-surface-variant mt-1">
            5-field cron expressions: <code className="text-success md-code text-xs">min hour dom month dow</code>
          </p>
        </div>
        <button
          onClick={() => setOpenAdd(!openAdd)}
          className="md-btn md-btn-filled px-3 py-1.5 text-sm"
        >
          + Cronjob
        </button>
      </div>

      {openAdd && (
        <div className="mb-4 p-4 md-card space-y-3">
          <div className="flex gap-2">
            <input type="text" placeholder="Job name" value={newName} onChange={e => setNewName(e.target.value)}
              className="md-field flex-[2] px-3 py-2 text-sm" autoFocus />
            <input type="text" placeholder="*/5 * * * *" value={newExpr} onChange={e => setNewExpr(e.target.value)}
              className="md-field flex-1 px-3 py-2 text-sm font-mono" />
          </div>
          <div className="flex gap-2 items-end">
            <select value={newTargetType} onChange={e => { setNewTargetType(e.target.value as typeof newTargetType); setNewTargetName(''); }}
              className="md-field px-3 py-2 text-sm">
              <option value="cell">Script</option><option value="queue">Queue</option><option value="pubsub">Pub/Sub</option>
            </select>
            <select value={newTargetName} onChange={e => setNewTargetName(e.target.value)}
              className="md-field flex-1 px-3 py-2 text-sm">
              <option value="">Select {targetTypeLabel(newTargetType)}...</option>
              {targetOptions(newTargetType).map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <span className="text-[10px] text-on-surface-variant/70 mb-1 block">Payload (JSON)</span>
            <JsonInput value={newPayload} onChange={setNewPayload} />
          </div>
          <button onClick={handleAdd} disabled={!newName.trim() || !newExpr.trim() || !newTargetName.trim()}
            className="md-btn md-btn-filled px-4 py-2 text-sm">
            Add Cronjob
          </button>
        </div>
      )}

      {crons.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant"><p className="text-sm">No cronjobs defined yet.</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {crons.map(cron => {
            const lockedBySecrets = secretsLocked && cronTargetsSecrets(cron, cells);
            const toggleDisabled = lockedBySecrets && !cron.enabled;
            return (
            <div key={cron.name} className={`md-card p-4 transition-colors ${
              cron.enabled ? '' : 'opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCron(cron.name)}
                    disabled={toggleDisabled}
                    className={`text-sm ${toggleDisabled ? 'cursor-not-allowed opacity-40 text-on-surface-variant' : 'cursor-pointer text-success'}`}
                    title={lockedBySecrets ? 'Secrets locked — must unlock secrets to enable this cron' : undefined}
                  >
                    {cron.enabled ? '\u25C9' : '\u25CB'}
                  </button>
                  <span className="text-sm font-medium text-on-surface">{cron.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => runCronNow(cron.name)}
                    className="md-btn md-btn-filled px-2 py-0.5 text-xs" title="Run now">Run</button>
                  <button onClick={() => startEdit(cron.name)}
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8 transition-colors" title="Edit">Edit</button>
                  <div className="relative">
                    <button onClick={() => setConfirmingDelete(cron.name)}
                      className="text-[10px] text-on-surface-variant/70 hover:text-error transition-colors px-1" title="Delete">Del</button>
                    <ConfirmPopover
                      open={confirmingDelete === cron.name}
                      message={`Delete "${cron.name}"?`}
                      onConfirm={() => { deleteCron(cron.name); setConfirmingDelete(null); }}
                      onCancel={() => setConfirmingDelete(null)}
                    />
                  </div>
                </div>
              </div>

              {editingCron === cron.name ? (
                <div className="space-y-2 mt-2 pt-2 border-t border-outline-variant">
                  <input type="text" value={editExpr} onChange={e => setEditExpr(e.target.value)}
                    className="md-field w-full px-2 py-1.5 text-xs font-mono" />
                  <div className="flex gap-2">
                    <select value={editTargetType} onChange={e => { setEditTargetType(e.target.value as typeof editTargetType); setEditTargetName(''); }}
                      className="md-field px-2 py-1.5 text-xs">
                      <option value="cell">Script</option><option value="queue">Queue</option><option value="pubsub">Pub/Sub</option>
                    </select>
                    <select value={editTargetName} onChange={e => setEditTargetName(e.target.value)}
                      className="md-field flex-1 px-2 py-1.5 text-xs">
                      <option value="">Select {targetTypeLabel(editTargetType)}...</option>
                      {targetOptions(editTargetType).map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>
                  <JsonInput value={editPayload} onChange={setEditPayload} />
                  <div className="flex gap-1">
                    <button onClick={() => setEditingCron(null)}
                      className="md-btn md-btn-tonal flex-1 px-2 py-1 text-xs">Cancel</button>
                    <button onClick={() => handleEdit(cron.name)}
                      className="md-btn md-btn-filled flex-1 px-2 py-1 text-xs">Save</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-[10px]">
                  <div>
                    <code className="text-success font-mono bg-on-surface/10 px-1.5 py-0.5 rounded">{cron.expression}</code>
                    <span className="text-on-surface-variant/70 ml-1.5">— {cronDescribe(cron.expression)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-on-surface-variant">
                    <span className="text-on-surface-variant/70">Target:</span>
                    <span className={`uppercase text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${
                      cron.target.type === 'cell' ? 'bg-primary text-on-primary' :
                      cron.target.type === 'queue' ? 'bg-accent-orange text-on-accent-orange' :
                      'bg-accent-pink text-on-accent-pink'
                    }`}>{targetTypeLabel(cron.target.type)}</span>
                    <span className="text-on-surface">{targetLabel(cron.target)}</span>
                  </div>
                  {cron.lastRunAt && (
                    <div className="text-on-surface-variant/60">Last run: {new Date(cron.lastRunAt).toLocaleString()}</div>
                  )}
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
