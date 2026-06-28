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
      <div className="sticky top-0 z-10 bg-gray-800 pt-3 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Cronjobs</h2>
          <p className="text-[11px] text-gray-400 mt-1">
            5-field cron expressions: <code className="text-green-400 bg-gray-700/50 px-1 py-0.5 rounded text-[10px]">min hour dom month dow</code>
          </p>
        </div>
        <button
          onClick={() => setOpenAdd(!openAdd)}
          className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          + Cronjob
        </button>
      </div>

      {openAdd && (
        <div className="mb-4 p-4 border border-gray-600 rounded-lg bg-gray-700/30 space-y-3">
          <div className="flex gap-2">
            <input type="text" placeholder="Job name" value={newName} onChange={e => setNewName(e.target.value)}
              className="flex-[2] bg-gray-800 border border-gray-500 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500 placeholder-gray-500" autoFocus />
            <input type="text" placeholder="*/5 * * * *" value={newExpr} onChange={e => setNewExpr(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-500 rounded px-3 py-2 text-sm font-mono text-gray-200 outline-none focus:border-blue-500 placeholder-gray-500" />
          </div>
          <div className="flex gap-2 items-end">
            <select value={newTargetType} onChange={e => { setNewTargetType(e.target.value as typeof newTargetType); setNewTargetName(''); }}
              className="bg-gray-800 border border-gray-500 rounded px-3 py-2 text-sm outline-none">
              <option value="cell">Script</option><option value="queue">Queue</option><option value="pubsub">Pub/Sub</option>
            </select>
            <select value={newTargetName} onChange={e => setNewTargetName(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-500 rounded px-3 py-2 text-sm outline-none">
              <option value="">Select {targetTypeLabel(newTargetType)}...</option>
              {targetOptions(newTargetType).map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
            </select>
          </div>
          <div>
            <span className="text-[10px] text-gray-500 mb-1 block">Payload (JSON)</span>
            <JsonInput value={newPayload} onChange={setNewPayload} />
          </div>
          <button onClick={handleAdd} disabled={!newName.trim() || !newExpr.trim() || !newTargetName.trim()}
            className="px-4 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40">
            Add Cronjob
          </button>
        </div>
      )}

      {crons.length === 0 ? (
        <div className="text-center py-12 text-gray-400"><p className="text-sm">No cronjobs defined yet.</p></div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {crons.map(cron => {
            const lockedBySecrets = secretsLocked && cronTargetsSecrets(cron, cells);
            const toggleDisabled = lockedBySecrets && !cron.enabled;
            return (
            <div key={cron.name} className={`border rounded-lg p-4 transition-colors ${
              cron.enabled ? 'bg-gray-700/30 border-gray-600' : 'bg-gray-700/10 border-gray-700/50 opacity-60'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleCron(cron.name)}
                    disabled={toggleDisabled}
                    className={`text-sm ${toggleDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                    title={lockedBySecrets ? 'Secrets locked — must unlock secrets to enable this cron' : undefined}
                  >
                    {cron.enabled ? '\u25C9' : '\u25CB'}
                  </button>
                  <span className="text-sm font-medium text-gray-200">{cron.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => runCronNow(cron.name)}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors" title="Run now">Run</button>
                  <button onClick={() => startEdit(cron.name)}
                    className="px-2 py-0.5 rounded text-[10px] font-semibold text-gray-400 hover:text-white hover:bg-gray-700 transition-colors" title="Edit">Edit</button>
                  <div className="relative">
                    <button onClick={() => setConfirmingDelete(cron.name)}
                      className="text-[10px] text-gray-600 hover:text-red-400 transition-colors" title="Delete">Del</button>
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
                <div className="space-y-2 mt-2 pt-2 border-t border-gray-600/50">
                  <input type="text" value={editExpr} onChange={e => setEditExpr(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-500 rounded px-2 py-1.5 text-xs font-mono text-gray-200 outline-none focus:border-blue-500" />
                  <div className="flex gap-2">
                    <select value={editTargetType} onChange={e => { setEditTargetType(e.target.value as typeof editTargetType); setEditTargetName(''); }}
                      className="bg-gray-800 border border-gray-500 rounded px-2 py-1.5 text-xs outline-none">
                      <option value="cell">Script</option><option value="queue">Queue</option><option value="pubsub">Pub/Sub</option>
                    </select>
                    <select value={editTargetName} onChange={e => setEditTargetName(e.target.value)}
                      className="flex-1 bg-gray-800 border border-gray-500 rounded px-2 py-1.5 text-xs outline-none">
                      <option value="">Select {targetTypeLabel(editTargetType)}...</option>
                      {targetOptions(editTargetType).map(o => (<option key={o.value} value={o.value}>{o.label}</option>))}
                    </select>
                  </div>
                  <JsonInput value={editPayload} onChange={setEditPayload} />
                  <div className="flex gap-1">
                    <button onClick={() => setEditingCron(null)}
                      className="flex-1 px-2 py-1 rounded text-[10px] font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors">Cancel</button>
                    <button onClick={() => handleEdit(cron.name)}
                      className="flex-1 px-2 py-1 rounded text-[10px] font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors">Save</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-1 text-[10px]">
                  <div>
                    <code className="text-green-400 font-mono bg-gray-700/50 px-1.5 py-0.5 rounded">{cron.expression}</code>
                    <span className="text-gray-500 ml-1.5">— {cronDescribe(cron.expression)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-400">
                    <span className="text-gray-500">Target:</span>
                    <span className={`uppercase text-[9px] font-semibold px-1 py-0.5 rounded ${
                      cron.target.type === 'cell' ? 'bg-blue-600/20 text-blue-400' :
                      cron.target.type === 'queue' ? 'bg-orange-600/20 text-orange-400' :
                      'bg-pink-600/20 text-pink-400'
                    }`}>{targetTypeLabel(cron.target.type)}</span>
                    <span className="text-gray-300">{targetLabel(cron.target)}</span>
                  </div>
                  {cron.lastRunAt && (
                    <div className="text-gray-600">Last run: {new Date(cron.lastRunAt).toLocaleString()}</div>
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
