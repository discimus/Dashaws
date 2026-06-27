import { useState } from 'react';
import { useCellsStore } from '../store/useCellsStore';
import { JsonInput } from './JsonInput';

export function PubSubView() {
  const { eventTopics, cells, addEventTopic, deleteEventTopic, emitEvent, addEventSubscriber, removeEventSubscriber } = useCellsStore();
  const [newName, setNewName] = useState('');
  const [openAddTopic, setOpenAddTopic] = useState(false);
  const [testMessages, setTestMessages] = useState<Record<string, string>>({});

  const entries = Object.values(eventTopics);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) return;
    addEventTopic(name);
    setNewName('');
    setOpenAddTopic(false);
  };

  return (
    <div>
      <div className="sticky top-0 z-10 bg-gray-800 pt-3 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Pub/Sub Events</h2>
          <p className="text-[11px] text-gray-400 mt-1">
            Broadcast events. Emit via <code className="text-pink-400 bg-gray-700/50 px-1 py-0.5 rounded text-[10px]">$pubsub.emit(name, body)</code>
          </p>
        </div>
        <button
          onClick={() => setOpenAddTopic(!openAddTopic)}
          className="px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
        >
          + Topic
        </button>
      </div>

      {openAddTopic && (
        <div className="mb-4 p-3 border border-gray-600 rounded-lg bg-gray-700/30 flex gap-2 items-end">
          <input
            type="text"
            placeholder="Topic name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            className="flex-1 bg-gray-800 border border-gray-500 rounded px-3 py-2 text-sm font-mono text-gray-200 outline-none focus:border-blue-500 placeholder-gray-500"
            autoFocus
          />
          <button onClick={handleAdd} disabled={!newName.trim()} className="px-4 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40">Add</button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-sm">No event topics defined yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {entries.map(t => (
            <div key={t.name} className="border border-gray-600 rounded-lg p-4 bg-gray-700/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <code className="text-pink-400 font-mono text-sm bg-gray-700/50 px-2 py-0.5 rounded">{t.name}</code>
                  <span className="text-[10px] text-gray-500">{t.subscriberIds.length} sub{t.subscriberIds.length !== 1 ? 's' : ''}</span>
                </div>
                <button
                  onClick={() => deleteEventTopic(t.name)}
                  className="text-[10px] text-gray-600 hover:text-red-400 transition-colors"
                  title="Delete topic"
                >
                  Delete
                </button>
              </div>

              <div className="text-xs text-gray-400">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-gray-500">Subscribers:</span>
                  {t.subscriberIds.length === 0 ? (
                    <span className="text-gray-600 italic">none</span>
                  ) : (
                    t.subscriberIds.map(id => {
                      const cell = cells.find(c => c.id === id);
                      return (
                        <span key={id} className="inline-flex items-center gap-1 bg-gray-700/50 px-1.5 py-0.5 rounded text-[10px]">
                          {cell?.name || id.slice(0, 8)}
                          <button onClick={() => removeEventSubscriber(t.name, id)} className="text-gray-600 hover:text-red-400">✕</button>
                        </span>
                      );
                    })
                  )}
                </div>
                {cells.length > 0 && (
                  <select
                    value=""
                    onChange={e => { if (e.target.value) { addEventSubscriber(t.name, e.target.value); e.target.value = ''; } }}
                    className="mt-1.5 bg-gray-800 border border-gray-600 rounded px-2 py-1 text-[10px] outline-none w-full"
                  >
                    <option value="">+ Add subscriber cell...</option>
                    {cells.filter(c => !t.subscriberIds.includes(c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="mt-3">
                <div style={{ height: 52 }} className="border border-gray-500 rounded overflow-hidden">
                  <JsonInput
                    value={testMessages[t.name] || '{\n  "key": "value"\n}'}
                    onChange={val => setTestMessages(prev => ({ ...prev, [t.name]: val }))}
                    onSubmit={() => {
                      emitEvent(t.name, testMessages[t.name] || '');
                      setTestMessages(prev => ({ ...prev, [t.name]: '' }));
                    }}
                  />
                </div>
                <button
                  onClick={() => { emitEvent(t.name, testMessages[t.name] || ''); setTestMessages(prev => ({ ...prev, [t.name]: '' })); }}
                  disabled={!testMessages[t.name]?.trim()}
                  className="mt-1 w-full px-3 py-1 rounded text-[10px] font-semibold bg-pink-600 hover:bg-pink-700 text-white transition-colors disabled:opacity-40"
                >
                  Emit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
