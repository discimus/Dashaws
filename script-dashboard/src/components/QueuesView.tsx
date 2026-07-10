import { useState } from 'react';
import { useCellsStore } from '../store/useCellsStore';
import { JsonInput } from './JsonInput';

export function QueuesView() {
  const { queues, cells, addQueue, deleteQueue, enqueue, addQueueSubscriber, removeQueueSubscriber } = useCellsStore();
  const [newName, setNewName] = useState('');
  const [newRetries, setNewRetries] = useState(0);
  const [openAddQueue, setOpenAddQueue] = useState(false);
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});

  const entries = Object.values(queues);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addQueue(name, newRetries);
    setNewName('');
    setNewRetries(0);
    setOpenAddQueue(false);
  };

  return (
    <div>
      <div className="sticky top-0 z-10 bg-surface pt-3 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-on-surface uppercase tracking-wider">Queues</h2>
          <p className="text-[11px] text-on-surface-variant mt-1">
            FIFO message queues. Enqueue via <code className="text-accent-orange md-code text-xs">$queue.enqueue(name, body)</code>
          </p>
        </div>
        <button
          onClick={() => setOpenAddQueue(!openAddQueue)}
          className="md-btn md-btn-filled px-3 py-1.5 text-sm"
        >
          + Queue
        </button>
      </div>

      {openAddQueue && (
        <div className="mb-4 p-3 md-card flex gap-2 items-end">
          <input
            type="text"
            placeholder="Queue name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            className="md-field flex-[2] px-3 py-2 text-sm font-mono"
            autoFocus
          />
          <select
            value={newRetries}
            onChange={e => setNewRetries(Number(e.target.value))}
            className="md-field flex-1 px-2 py-2 text-xs"
          >
            <option value={0}>0 retries</option>
            <option value={1}>1 retry</option>
            <option value={3}>3 retries</option>
            <option value={5}>5 retries</option>
          </select>
          <button onClick={handleAdd} disabled={!newName.trim()} className="md-btn md-btn-filled px-4 py-2 text-sm">Add</button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <p className="text-sm">No queues defined yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {entries.map(q => (
            <div key={q.name} className="md-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <code className="text-accent-orange font-mono text-sm bg-on-surface/10 px-2 py-0.5 rounded">{q.name}</code>
                  <span className="text-[10px] text-on-surface-variant">{q.messages.length} msg{q.messages.length !== 1 ? 's' : ''}</span>
                  <span className="text-[10px] text-on-surface-variant/60">· {q.maxRetries} retr{q.maxRetries !== 1 ? 'ies' : 'y'}</span>
                </div>
                <button
                  onClick={() => deleteQueue(q.name)}
                  className="text-[10px] text-on-surface-variant/70 hover:text-error transition-colors"
                  title="Delete queue"
                >
                  Delete
                </button>
              </div>

              <div className="text-xs text-on-surface-variant">
                <div className="flex items-center gap-1">
                  <span className="text-on-surface-variant/70">Subscribers:</span>
                  {q.subscriberIds.length === 0 ? (
                    <span className="text-on-surface-variant/50 italic">none</span>
                  ) : (
                    q.subscriberIds.map(id => {
                      const cell = cells.find(c => c.id === id);
                      return (
                        <span key={id} className="md-chip">
                          {cell?.name || id.slice(0, 8)}
                          <button onClick={() => removeQueueSubscriber(q.name, id)} className="text-on-surface-variant/70 hover:text-error">✕</button>
                        </span>
                      );
                    })
                  )}
                </div>
                {cells.length > 0 && (
                  <select
                    value=""
                    onChange={e => { if (e.target.value) { addQueueSubscriber(q.name, e.target.value); e.target.value = ''; } }}
                    className="md-field mt-1.5 px-2 py-1 text-[10px] w-full"
                  >
                      <option value="">+ Add subscriber script...</option>
                    {cells.filter(c => !q.subscriberIds.includes(c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="mt-3">
                  <JsonInput
                    value={testMessages[q.name] || '{\n  "key": "value"\n}'}
                    onChange={val => setTestMessages(prev => ({ ...prev, [q.name]: val }))}
                    onSubmit={() => {
                      enqueue(q.name, testMessages[q.name] || '');
                      setTestMessages(prev => ({ ...prev, [q.name]: '' }));
                    }}
                  />
                <button
                  onClick={() => { enqueue(q.name, testMessages[q.name] || ''); setTestMessages(prev => ({ ...prev, [q.name]: '' })); }}
                  disabled={!testMessages[q.name]?.trim()}
                  className="md-btn md-btn-orange mt-1 w-full px-3 py-1 text-xs"
                >
                  Enqueue
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
