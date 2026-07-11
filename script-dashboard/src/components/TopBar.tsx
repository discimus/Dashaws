import { useCellsStore } from '../store/useCellsStore';

export function TopBar() {
  const { cells, stopAll, runningIds, secretsBlob, keepUnlocked, toggleKeepUnlocked, keepAlive, toggleKeepAlive, authRequired, authenticated, logout, theme, toggleTheme } = useCellsStore();
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
          <button
            onClick={toggleTheme}
            className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-on-surface/8 transition-colors"
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5"/>
                <line x1="12" y1="1" x2="12" y2="3"/>
                <line x1="12" y1="21" x2="12" y2="23"/>
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                <line x1="1" y1="12" x2="3" y2="12"/>
                <line x1="21" y1="12" x2="23" y2="12"/>
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
              </svg>
            )}
          </button>
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
              <svg width="13" height="13" viewBox="0 0 13 13" className="inline-block align-middle shrink-0"><circle cx="6.5" cy="6.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6"/><text x="6.5" y="9.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor" opacity="0.8">?</text></svg>
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
                <svg width="13" height="13" viewBox="0 0 13 13" className="inline-block align-middle shrink-0"><circle cx="6.5" cy="6.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.6"/><text x="6.5" y="9.5" textAnchor="middle" fontSize="9" fontWeight="bold" fill="currentColor" opacity="0.8">?</text></svg>
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
