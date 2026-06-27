import { useState } from 'react';
import { useCellsStore } from '../store/useCellsStore';
import { useToastStore } from '../store/toastStore';

export function SecretsView() {
  const {
    secretsLocked,
    secrets,
    secretsBlob,
    tryUnlockSecrets,
    lockSecrets,
    setSecret,
    deleteSecret,
    setSecretsPassword,
    removeSecretsPassword,
  } = useCellsStore();

  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [error, setError] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const entries = Object.entries(secrets);
  const hasPassword = secretsBlob !== null;

  const handleUnlock = async () => {
    setError('');
    const ok = await tryUnlockSecrets(password);
    if (!ok) {
      setError('Incorrect password.');
    } else {
      setPassword('');
    }
  };

  const handleSetupPassword = async () => {
    setError('');
    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters.');
      return;
    }
    if (newPassword !== newPasswordConfirm) {
      setError('Passwords do not match.');
      return;
    }
    await setSecretsPassword(newPassword);
    setNewPassword('');
    setNewPasswordConfirm('');
    setShowSetup(false);
  };

  const handleRemovePassword = async () => {
    if (confirm('Remove password? All stored secrets will be permanently deleted and cannot be recovered.')) {
      await removeSecretsPassword();
      setError('');
    }
  };

  const handleAddSecret = async () => {
    const key = newKey.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!key) return;
    await setSecret(key, newValue);
    setNewKey('');
    setNewValue('');
  };

  const handleDeleteSecret = async (key: string) => {
    await deleteSecret(key);
  };

  return (
    <div>
      <div className="sticky top-0 z-10 bg-gray-800 pt-3 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
              Secrets
            </h2>
            <p className="text-[11px] text-gray-400 mt-1">
              Encrypted with AES-GCM. Accessible via <code className="text-purple-400 bg-gray-700/50 px-1 py-0.5 rounded text-[10px]">$secrets.KEY</code>
            </p>
          </div>
          {hasPassword && !secretsLocked && (
            <button
              onClick={() => lockSecrets()}
              className="px-3 py-1.5 rounded text-xs font-semibold bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/40 border border-yellow-600/30 transition-colors"
            >
              Lock
            </button>
          )}
        </div>
      </div>

      {hasPassword && secretsLocked && (
        <div className="max-w-md mx-auto mt-12">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">&#128274;</div>
            <h3 className="text-base font-semibold text-gray-200 mb-1">Secrets Locked</h3>
            <p className="text-xs text-gray-400">Enter your password to unlock secrets.</p>
          </div>

          <div className="space-y-3">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
              className="w-full bg-gray-800 border border-gray-500 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500 placeholder-gray-500"
              autoFocus
            />
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
            <button
              onClick={handleUnlock}
              disabled={!password}
              className="w-full px-4 py-2 rounded text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Unlock
            </button>
            <button
              onClick={handleRemovePassword}
              className="w-full px-4 py-2 rounded text-xs font-medium text-gray-500 hover:text-red-400 transition-colors"
            >
              Remove password &amp; delete all secrets
            </button>
          </div>
        </div>
      )}

      {!hasPassword && !showSetup && (
        <div className="max-w-md mx-auto mt-12">
          <div className="text-center mb-6">
            <div className="text-4xl mb-3">&#128273;</div>
            <h3 className="text-base font-semibold text-gray-200 mb-1">No Secrets Configured</h3>
            <p className="text-xs text-gray-400">Set a password to start using encrypted secrets.</p>
          </div>
          <button
            onClick={() => setShowSetup(true)}
            className="w-full px-4 py-2 rounded text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
          >
            Set Password
          </button>
        </div>
      )}

      {!hasPassword && showSetup && (
        <div className="max-w-md mx-auto mt-8">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Set Secrets Password</h3>
          <p className="text-[11px] text-gray-400 mb-4">
            Secrets are encrypted with AES-GCM 256-bit. If you lose this password, your secrets cannot be recovered.
          </p>

          <div className="space-y-3">
            <input
              type="password"
              placeholder="New password (min 4 chars)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-500 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500 placeholder-gray-500"
              autoFocus
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={newPasswordConfirm}
              onChange={e => setNewPasswordConfirm(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSetupPassword(); }}
              className="w-full bg-gray-800 border border-gray-500 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500 placeholder-gray-500"
            />
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSetup(false); setError(''); }}
                className="flex-1 px-4 py-2 rounded text-sm font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSetupPassword}
                disabled={!newPassword || !newPasswordConfirm}
                className="flex-1 px-4 py-2 rounded text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Set Password
              </button>
            </div>
          </div>
        </div>
      )}

      {hasPassword && !secretsLocked && (
        <>
          {entries.length > 0 ? (
            <div className="overflow-x-auto mt-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-600 text-left">
                    <th className="py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-1/3">Key</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Value</th>
                    <th className="py-2 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(([key]) => (
                    <tr key={key} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <code className="text-purple-400 font-mono text-xs bg-gray-700/50 px-1.5 py-0.5 rounded">
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
                        <span className="text-gray-500 font-mono text-xs break-all italic">
                          {'\u2022'.repeat(18)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <button
                          onClick={() => handleDeleteSecret(key)}
                          className="px-2 py-1 rounded text-xs font-semibold bg-gray-700 hover:bg-red-800 text-gray-300 hover:text-white transition-colors"
                          title="Delete secret"
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
            <div className="text-center py-12 text-gray-400 mt-4">
              <p className="text-sm">No secrets defined yet. Add your first secret below.</p>
            </div>
          )}

          <div className="mt-6 border border-gray-600 rounded-lg p-4 bg-gray-700/30">
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Add Secret</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="KEY"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSecret(); }}
                className="flex-1 bg-gray-800 border border-gray-500 rounded px-3 py-2 text-sm font-mono text-gray-200 outline-none focus:border-blue-500 placeholder-gray-500"
              />
              <input
                type="text"
                placeholder="Value"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSecret(); }}
                className="flex-[2] bg-gray-800 border border-gray-500 rounded px-3 py-2 text-sm font-mono text-gray-200 outline-none focus:border-blue-500 placeholder-gray-500"
              />
              <button
                onClick={handleAddSecret}
                disabled={!newKey.trim()}
                className="px-4 py-2 rounded text-xs font-semibold bg-purple-600 hover:bg-purple-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
              >
                Add
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
