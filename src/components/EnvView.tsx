import { useState } from 'react';
import { useCellsStore } from '../store/useCellsStore';
import { useToastStore } from '../store/toastStore';

export function EnvView() {
  const { env, setEnvVar, deleteEnvVar } = useCellsStore();
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

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
      <div className="sticky top-0 z-10 bg-gray-800 pt-3 pb-3">
        <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
          Environment Variables
        </h2>
        <p className="text-[11px] text-gray-400 mt-1">
          Accessible in scripts via <code className="text-blue-400 bg-gray-700/50 px-1 py-0.5 rounded text-[10px]">$env.KEY_NAME</code>
        </p>
      </div>

      {entries.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600 text-left">
                <th className="py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-1/3">Key</th>
                <th className="py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Value</th>
                <th className="py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-10"></th>
                <th className="py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16"></th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([key, value]) => (
                <tr key={key} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <code className="text-blue-400 font-mono text-xs bg-gray-700/50 px-1.5 py-0.5 rounded">
                        {key}
                      </code>
                      <button
                        onClick={() => { navigator.clipboard.writeText(key); useToastStore.getState().show('Copied!'); }}
                        title="Copy name"
                        className="flex-shrink-0 px-1 py-0.5 rounded text-[10px] text-gray-500 hover:text-gray-200 hover:bg-gray-600 transition-colors"
                      >
                        &#128203;
                      </button>
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="text-gray-300 font-mono text-xs break-all">{value || <span className="text-gray-500 italic">empty</span>}</span>
                      {value && (
                        <button
                          onClick={() => { navigator.clipboard.writeText(value); useToastStore.getState().show('Copied!'); }}
                          title="Copy value"
                          className="flex-shrink-0 px-1 py-0.5 rounded text-[10px] text-gray-500 hover:text-gray-200 hover:bg-gray-600 transition-colors"
                        >
                          &#128203;
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3">
                    <button
                      onClick={() => deleteEnvVar(key)}
                      className="px-2 py-1 rounded text-xs font-semibold bg-gray-700 hover:bg-red-800 text-gray-300 hover:text-white transition-colors"
                      title="Delete variable"
                    >
                      Del
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <div className="text-3xl mb-2">&#128273;</div>
          <p className="text-sm">No environment variables defined yet.</p>
        </div>
      )}

      <div className="mt-6 border border-gray-600 rounded-lg p-4 bg-gray-700/30">
        <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Add Variable</h3>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="KEY"
            value={newKey}
            onChange={e => setNewKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            className="flex-1 bg-gray-800 border border-gray-500 rounded px-3 py-2 text-sm font-mono text-gray-200 outline-none focus:border-blue-500 placeholder-gray-500"
          />
          <input
            type="text"
            placeholder="Value"
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            className="flex-[2] bg-gray-800 border border-gray-500 rounded px-3 py-2 text-sm font-mono text-gray-200 outline-none focus:border-blue-500 placeholder-gray-500"
          />
          <button
            onClick={handleAdd}
            disabled={!newKey.trim()}
            className="px-4 py-2 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
