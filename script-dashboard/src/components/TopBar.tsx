import { useCellsStore } from '../store/useCellsStore';

export function TopBar() {
  const { cells, stopAll, runningIds, secretsBlob, keepUnlocked, toggleKeepUnlocked, keepAlive, toggleKeepAlive, authRequired, authenticated, logout } = useCellsStore();
  const activeCount = runningIds.length;
  const hasSecrets = secretsBlob !== null;

  return (
    <header className="fixed top-0 left-0 right-0 bg-surface-container border-b border-outline-variant h-12 flex items-center z-30">
      <div className="flex items-center justify-between w-full px-4">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold tracking-tight text-on-surface">Dashaws</h1>
          <span className="text-xs text-on-surface-variant">
            {cells.length} script{cells.length !== 1 ? 's' : ''}
          </span>
          {activeCount > 0 && (
            <span className="text-xs text-warning flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
              {activeCount} running
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <button
              onClick={toggleKeepAlive}
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                keepAlive
                  ? 'bg-success-container border-transparent text-on-success-container'
                  : 'bg-transparent border-outline text-on-surface-variant hover:bg-on-surface/8'
              }`}
            >
              <span>{keepAlive ? '⏳' : '⌛'}</span>
              Keep alive
            </button>
            <span
              className="text-on-surface-variant hover:text-on-surface cursor-help text-xs"
              title="Keep-alive prevents the browser from sleeping or throttling script timers. It uses the Wake Lock API (keeps screen on) and a silent audio loop (prevents timer throttling in background tabs). Enable this for long-running scripts that need consistent interval timing."
            >
              &#9432;
            </span>
          </span>

          {hasSecrets && (
            <span className="inline-flex items-center gap-1.5">
              <button
                onClick={toggleKeepUnlocked}
                className={`flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors border ${
                  keepUnlocked
                    ? 'bg-warning-container border-transparent text-on-warning-container'
                    : 'bg-transparent border-outline text-on-surface-variant hover:bg-on-surface/8'
                }`}
              >
                <span>{keepUnlocked ? '\u{1F513}' : '\u{1F512}'}</span>
                Keep unlocked
              </button>
              <span
                className="text-on-surface-variant hover:text-on-surface cursor-help text-xs"
                title="Auto-unlock keeps your secrets password in session storage, so you don't have to re-enter it on every page refresh. Secrets are decrypted automatically on load when this is active. Disable if you want to manually enter the password each time for extra security."
              >
                &#9432;
              </span>
            </span>
          )}

          {activeCount > 0 && (
            <button
              onClick={stopAll}
              className="md-btn md-btn-danger px-4 py-1.5 text-sm"
            >
              Stop All
            </button>
          )}

          {authRequired && authenticated && (
            <button
              onClick={() => logout()}
              className="md-btn md-btn-tonal px-4 py-1.5 text-sm"
            >
              Logout
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
