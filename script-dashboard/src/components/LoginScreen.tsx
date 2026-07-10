import { useState, useRef, useEffect, useCallback } from 'react';
import { useCellsStore } from '../store/useCellsStore';

export function LoginScreen() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const login = useCellsStore(s => s.login);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  useEffect(() => {
    if (retryAfter <= 0) return;
    const start = Date.now();
    const interval = setInterval(() => {
      const remaining = retryAfter - (Date.now() - start);
      if (remaining <= 0) {
        setRetryAfter(0);
        setError('');
        setPassword('');
        setTimeout(() => inputRef.current?.focus(), 50);
        clearInterval(interval);
      } else {
        setRetryAfter(Math.ceil(remaining));
      }
    }, 200);
    return () => clearInterval(interval);
  }, [retryAfter]);

  const handleSubmit = useCallback(async () => {
    if (!password || retryAfter > 0) return;
    setLoading(true);
    setError('');
    try {
      const ok = await login(password);
      if (!ok) {
        setError('Invalid password');
        setPassword('');
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    } catch (err: unknown) {
      if (err instanceof Error && 'retryAfter' in err) {
        setRetryAfter((err as Error & { retryAfter: number }).retryAfter);
        setError('Too many attempts. Please wait.');
        setPassword('');
      } else if (err instanceof Error) {
        setError(err.message || 'Connection error');
        setPassword('');
        setTimeout(() => inputRef.current?.focus(), 50);
      } else {
        setError('Connection error');
      }
    } finally {
      setLoading(false);
    }
  }, [password, retryAfter, login]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes > 0) {
      return `${minutes}m ${seconds.toString().padStart(2, '0')}s`;
    }
    return `${seconds}s`;
  };

  const isBlocked = retryAfter > 0;

  return (
    <div className="flex items-center justify-center min-h-screen bg-surface">
      <div className="bg-surface-container-high border border-outline-variant rounded-2xl shadow-2xl w-80 p-6">
        <h1 className="text-lg font-semibold text-on-surface text-center mb-1">Dashaws</h1>
        <p className="text-xs text-on-surface-variant text-center mb-4">
          Enter the server password to continue
        </p>

        <input
          ref={inputRef}
          type="password"
          placeholder="Password"
          value={password}
          disabled={isBlocked}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          onKeyDown={e => {
            if (e.key === 'Enter' && password && !isBlocked) handleSubmit();
          }}
          className="md-field w-full px-3 py-2 text-sm disabled:opacity-40"
        />

        {error && (
          <p className="text-xs text-error mt-2 text-center">
            {error}
            {isBlocked && ` (${formatTime(retryAfter)})`}
          </p>
        )}

        <button
          onClick={handleSubmit}
          disabled={!password || loading || isBlocked}
          className="md-btn md-btn-filled w-full mt-4 px-3 py-2 text-base"
        >
          {isBlocked ? formatTime(retryAfter) : loading ? 'Connecting...' : 'Login'}
        </button>
      </div>
    </div>
  );
}
