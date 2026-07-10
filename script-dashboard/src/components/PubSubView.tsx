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
      <div className="sticky top-0 z-10 bg-surface pt-3 pb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-on-surface uppercase tracking-wider">Pub/Sub Events</h2>
          <p className="text-[11px] text-on-surface-variant mt-1">
            Broadcast events. Emit via <code className="text-accent-pink md-code text-xs">$pubsub.emit(name, body)</code>
          </p>
        </div>
        <button
          onClick={() => setOpenAddTopic(!openAddTopic)}
          className="md-btn md-btn-filled px-3 py-1.5 text-sm"
        >
          + Topic
        </button>
      </div>

      {openAddTopic && (
        <div className="mb-4 p-3 md-card flex gap-2 items-end">
          <input
            type="text"
            placeholder="Topic name"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            className="md-field flex-1 px-3 py-2 text-sm font-mono"
            autoFocus
          />
          <button onClick={handleAdd} disabled={!newName.trim()} className="md-btn md-btn-filled px-4 py-2 text-sm">Add</button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="text-center py-12 text-on-surface-variant">
          <p className="text-sm">No event topics defined yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {entries.map(t => (
            <div key={t.name} className="md-card p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <code className="text-accent-pink font-mono text-sm bg-on-surface/10 px-2 py-0.5 rounded">{t.name}</code>
                  <span className="text-[10px] text-on-surface-variant">{t.subscriberIds.length} sub{t.subscriberIds.length !== 1 ? 's' : ''}</span>
                </div>
                <button
                  onClick={() => deleteEventTopic(t.name)}
                  className="text-[10px] text-on-surface-variant/70 hover:text-error transition-colors"
                  title="Delete topic"
                >
                  Delete
                </button>
              </div>

              <div className="text-xs text-on-surface-variant">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-on-surface-variant/70">Subscribers:</span>
                  {t.subscriberIds.length === 0 ? (
                    <span className="text-on-surface-variant/50 italic">none</span>
                  ) : (
                    t.subscriberIds.map(id => {
                      const cell = cells.find(c => c.id === id);
                      return (
                        <span key={id} className="md-chip">
                          {cell?.name || id.slice(0, 8)}
                          <button onClick={() => removeEventSubscriber(t.name, id)} className="text-on-surface-variant/70 hover:text-error">✕</button>
                        </span>
                      );
                    })
                  )}
                </div>
                {cells.length > 0 && (
                  <select
                    value=""
                    onChange={e => { if (e.target.value) { addEventSubscriber(t.name, e.target.value); e.target.value = ''; } }}
                    className="md-field mt-1.5 px-2 py-1 text-[10px] w-full"
                  >
                      <option value="">+ Add subscriber script...</option>
                    {cells.filter(c => !t.subscriberIds.includes(c.id)).map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>

              <div className="mt-3">
                  <JsonInput
                    value={testMessages[t.name] || '{\n  "key": "value"\n}'}
                    onChange={val => setTestMessages(prev => ({ ...prev, [t.name]: val }))}
                    onSubmit={() => {
                      emitEvent(t.name, testMessages[t.name] || '');
                      setTestMessages(prev => ({ ...prev, [t.name]: '' }));
                    }}
                  />
                <button
                  onClick={() => { emitEvent(t.name, testMessages[t.name] || ''); setTestMessages(prev => ({ ...prev, [t.name]: '' })); }}
                  disabled={!testMessages[t.name]?.trim()}
                  className="md-btn md-btn-pink mt-1 w-full px-3 py-1 text-xs"
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
