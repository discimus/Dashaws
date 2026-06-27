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
      <div className="sticky top-0 z-10 bg-gray-800 pt-3 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Queues</h2>
          <p className="text-[11px] text-gray-400 mt-1">
            FIFO message queues. Enqueue via <code className="text-orange-400 bg-gray-700/50 px-1 py-0.5 rounded text-[10px]">$queue.enqueue(name, body)</code>
          </p>
        </div>
        <button
          onClick={() => setOpenAddQueue(!openAddQueue)}
          className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          + Queue
        </button>
      </div>

      {openAddQueue && (
        <div className="mb-4 p-3 border border-gray-600 rounded-lg bg-gray-700/30 flex gap-2 items-end">
          <input
            type="text"
            placeholder="Queue name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            className="flex-[2] bg-gray-800 border border-gray-500 rounded px-3 py-2 text-sm font-mono text-gray-200 outline-none focus:border-blue-500 placeholder-gray-500"
            autoFocus
          />
          <select
            value={newRetries}
            onChange={e => setNewRetries(Number(e.target.value))}
            className="flex-1 bg-gray-800 border border-gray-500 rounded px-2 py-2 text-xs outline-none"
          >
            <option value={0}>0 retries</option>
            <option value={1}>1 retry</option>
            <option value={3}>3 retries</option>
            <option value={5}>5 retries</option>
          </select>
          <button onClick={handleAdd} disabled={!newName.trim()} className="px-4 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40">Add</button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No queues defined yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {entries.map(q => (
            <div key={q.name} className="border border-gray-600 rounded-lg p-4 bg-gray-700/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <code className="text-orange-400 font-mono text-sm bg-gray-700/50 px-2 py-0.5 rounded">{q.name}</code>
                  <span className="text-[10px] text-gray-500">{q.messages.length} msg{q.messages.length !== 1 ? 's' : ''}</span>
                  <span className="text-[10px] text-gray-600">· {q.maxRetries} retr{q.maxRetries !== 1 ? 'ies' : 'y'}</span>
                </div>
                <button
                  onClick={() => deleteQueue(q.name)}
                  className="text-[10px] text-gray-600 hover:text-red-400 transition-colors"
                  title="Delete queue"
                >
                  Delete
                </button>
              </div>

              <div className="text-xs text-gray-400">
                <div className="flex items-center gap-1">
                  <span className="text-gray-500">Subscribers:</span>
                  {q.subscriberIds.length === 0 ? (
                    <span className="text-gray-600 italic">none</span>
                  ) : (
                    q.subscriberIds.map(id => {
                      const cell = cells.find(c => c.id === id);
                      return (
                        <span key={id} className="inline-flex items-center gap-1 bg-gray-700/50 px-1.5 py-0.5 rounded text-[10px]">
                          {cell?.name || id.slice(0, 8)}
                          <button onClick={() => removeQueueSubscriber(q.name, id)} className="text-gray-600 hover:text-red-400">✕</button>
                        </span>
                      );
                    })
                  )}
                </div>
                {cells.length > 0 && (
                  <select
                    value=""
                    onChange={e => { if (e.target.value) { addQueueSubscriber(q.name, e.target.value); e.target.value = ''; } }}
                    className="mt-1.5 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-[10px] outline-none w-full"
                  >
                    <option value="">+ Add subscriber cell...</option>
                    {cells.filter(c => !q.subscriberIds.includes(c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="mt-3">
                <div style={{ height: 52 }} className="border border-gray-500 rounded overflow-hidden">
                  <JsonInput
                    value={testMessages[q.name] || '{\n  "key": "value"\n}'}
                    onChange={val => setTestMessages(prev => ({ ...prev, [q.name]: val }))}
                    onSubmit={() => {
                      enqueue(q.name, testMessages[q.name] || '');
                      setTestMessages(prev => ({ ...prev, [q.name]: '' }));
                    }}
                  />
                </div>
                <button
                  onClick={() => { enqueue(q.name, testMessages[q.name] || ''); setTestMessages(prev => ({ ...prev, [q.name]: '' })); }}
                  disabled={!testMessages[q.name]?.trim()}
                  className="mt-1 w-full px-3 py-1 rounded text-[10px] font-semibold bg-orange-600 hover:bg-orange-700 text-white transition-colors disabled:opacity-40"
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
