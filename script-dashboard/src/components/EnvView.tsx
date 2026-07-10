import { useState } from 'react';
import { useCellsStore } from '../store/useCellsStore';
import { useToastStore } from '../store/toastStore';
import { ConfirmPopover } from './ConfirmPopover';
import { copyToClipboard } from '../utils/clipboard';

export function EnvView() {
  const { env, setEnvVar, deleteEnvVar } = useCellsStore();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);

  const entries = Object.entries(env);

  const handleAdd = () => {
    const key = newKey.trim();
    if (!key) return;
    setEnvVar(key, newValue);
    setNewKey('');
    setNewValue('');
  };

  return (
    <div>
      <div className="sticky top-0 z-10 bg-surface pt-3 pb-3">
        <h2 className="text-sm font-semibold text-on-surface uppercase tracking-wider">
          Environment Variables
        </h2>
        <p className="text-[11px] text-on-surface-variant mt-1">
          Accessible in scripts via <code className="text-primary md-code text-xs">$env.KEY_NAME</code>
        </p>
      </div>

      {entries.length > 0 ? (
        <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-left">
                <th className="py-2 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-1/3">Key</th>
                <th className="py-2 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Value</th>
                <th className="py-2 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-10"></th>
                <th className="py-2 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-16"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key} className="border-b border-outline-variant/50 hover:bg-on-surface/4 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <code className="text-primary font-mono text-xs bg-on-surface/6 px-1.5 py-0.5 rounded">
                        {key}
                      </code>
                      <button
                        onClick={() => { copyToClipboard(key); useToastStore.getState().show('Copied!'); }}
                        title="Copy name"
                        className="flex-shrink-0 px-1 py-0.5 rounded-full text-xs text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8 transition-colors"
                      >
                        &#128203;
                      </button>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-on-surface font-mono text-xs break-all">{value || <span className="text-on-surface-variant/60 italic">empty</span>}</span>
                      {value && (
                        <button
                          onClick={() => { copyToClipboard(value); useToastStore.getState().show('Copied!'); }}
                          title="Copy value"
                          className="flex-shrink-0 px-1 py-0.5 rounded-full text-xs text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8 transition-colors"
                        >
                          &#128203;
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 relative">
                    <button
                      onClick={() => setMenuKey(menuKey === key ? null : key)}
                      className="px-2 py-1 rounded-full text-xs font-semibold text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8 transition-colors"
                      title="Actions"
                    >
                      &#8942;
                    </button>
                    {menuKey === key && (
                      <div className="md-menu absolute right-0 top-full mt-1 w-32 z-20">
                        <button
                          onClick={() => { setMenuKey(null); setConfirmingKey(key); }}
                          className="md-menu-item text-error hover:bg-error/10"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                    <ConfirmPopover
                      open={confirmingKey === key}
                      message={`Delete "${key}"?`}
                      onConfirm={() => { deleteEnvVar(key); setConfirmingKey(null); }}
                      onCancel={() => setConfirmingKey(null)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
      ) : (
        <div className="text-center py-12 text-on-surface-variant">
          <div className="text-3xl mb-2">&#128273;</div>
          <p className="text-sm">No environment variables defined yet.</p>
        </div>
      )}

      <div className="mt-6 md-card p-4">
        <h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider mb-3">Add Variable</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="KEY"
            value={newKey}
            onChange={e => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            className="md-field flex-1 px-3 py-2 text-sm font-mono"
          />
          <input
            type="text"
            placeholder="Value"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            className="md-field flex-[2] px-3 py-2 text-sm font-mono"
          />
          <button
            onClick={handleAdd}
            disabled={!newKey.trim()}
            className="md-btn md-btn-filled px-4 py-2 text-sm"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
