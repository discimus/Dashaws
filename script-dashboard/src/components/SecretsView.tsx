import { useState } from 'react';
import { useCellsStore } from '../store/useCellsStore';
import { useToastStore } from '../store/toastStore';
import { ConfirmPopover } from './ConfirmPopover';
import { copyToClipboard } from '../utils/clipboard';

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
  const [confirmingKey, setConfirmingKey] = useState<string | null>(null);
  const [menuKey, setMenuKey] = useState<string | null>(null);

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
      <div className="sticky top-0 z-10 bg-surface pt-3 pb-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-on-surface uppercase tracking-wider">
              Secrets
            </h2>
            <p className="text-[11px] text-on-surface-variant mt-1">
              Encrypted with AES-GCM. Accessible via <code className="text-accent-purple md-code text-xs">$secrets.KEY</code>
            </p>
          </div>
          {hasPassword && !secretsLocked && (
            <button
              onClick={() => lockSecrets()}
              className="px-3 py-1.5 rounded-full text-sm font-medium bg-warning-container text-on-warning-container hover:brightness-110 transition-all"
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
            <h3 className="text-base font-semibold text-on-surface mb-1">Secrets Locked</h3>
            <p className="text-xs text-on-surface-variant">Enter your password to unlock secrets.</p>
          </div>

          <div className="space-y-3">
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
              className="md-field w-full px-3 py-2 text-sm"
              autoFocus
            />
            {error && (
              <p className="text-xs text-error">{error}</p>
            )}
            <button
              onClick={handleUnlock}
              disabled={!password}
              className="md-btn md-btn-filled w-full px-4 py-2 text-base"
            >
              Unlock
            </button>
            <button
              onClick={handleRemovePassword}
              className="w-full px-4 py-2 rounded-full text-xs font-medium text-on-surface-variant hover:text-error hover:bg-error/8 transition-colors"
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
            <h3 className="text-base font-semibold text-on-surface mb-1">No Secrets Configured</h3>
            <p className="text-xs text-on-surface-variant">Set a password to start using encrypted secrets.</p>
          </div>
          <button
            onClick={() => setShowSetup(true)}
            className="md-btn md-btn-filled w-full px-4 py-2 text-base"
          >
            Set Password
          </button>
        </div>
      )}

      {!hasPassword && showSetup && (
        <div className="max-w-md mx-auto mt-8">
          <h3 className="text-sm font-semibold text-on-surface mb-3">Set Secrets Password</h3>
          <p className="text-[11px] text-on-surface-variant mb-4">
            Secrets are encrypted with AES-GCM 256-bit. If you lose this password, your secrets cannot be recovered.
          </p>

          <div className="space-y-3">
            <input
              type="password"
              placeholder="New password (min 4 chars)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="md-field w-full px-3 py-2 text-sm"
              autoFocus
            />
            <input
              type="password"
              placeholder="Confirm password"
              value={newPasswordConfirm}
              onChange={e => setNewPasswordConfirm(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSetupPassword(); }}
              className="md-field w-full px-3 py-2 text-sm"
            />
            {error && (
              <p className="text-xs text-error">{error}</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowSetup(false); setError(''); }}
                className="md-btn md-btn-tonal flex-1 px-4 py-2 text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleSetupPassword}
                disabled={!newPassword || !newPasswordConfirm}
                className="md-btn md-btn-filled flex-1 px-4 py-2 text-base"
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
            <table className="w-full text-sm mt-4">
                <thead>
                  <tr className="border-b border-outline-variant text-left">
                    <th className="py-2 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-1/3">Key</th>
                    <th className="py-2 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">Value</th>
                    <th className="py-2 px-3 text-xs font-semibold text-on-surface-variant uppercase tracking-wider w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(([key]) => (
                    <tr key={key} className="border-b border-outline-variant/50 hover:bg-on-surface/5 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <code className="text-accent-purple font-mono text-xs bg-on-surface/10 px-1.5 py-0.5 rounded">
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
                        <span className="text-on-surface-variant/70 font-mono text-xs break-all italic">
                          {'\u2022'.repeat(18)}
                        </span>
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
                          onConfirm={() => { handleDeleteSecret(key); setConfirmingKey(null); }}
                          onCancel={() => setConfirmingKey(null)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
            <div className="text-center py-12 text-on-surface-variant mt-4">
              <p className="text-sm">No secrets defined yet. Add your first secret below.</p>
            </div>
          )}

          <div className="mt-6 md-card p-4">
            <h3 className="text-xs font-semibold text-on-surface uppercase tracking-wider mb-3">Add Secret</h3>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="KEY"
                value={newKey}
                onChange={e => setNewKey(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSecret(); }}
                className="md-field flex-1 px-3 py-2 text-sm font-mono"
              />
              <input
                type="text"
                placeholder="Value"
                value={newValue}
                onChange={e => setNewValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddSecret(); }}
                className="md-field flex-[2] px-3 py-2 text-sm font-mono"
              />
              <button
                onClick={handleAddSecret}
                disabled={!newKey.trim()}
                className="md-btn md-btn-purple px-4 py-2 text-sm flex-shrink-0"
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
