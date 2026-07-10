import { useState, useRef, useEffect } from 'react';

interface Props {
  open: boolean;
  onConfirm: (password: string) => void;
  onCancel: () => void;
  error: string;
}

export function PromptModal({ open, onConfirm, onCancel, error }: Props) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue('');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onCancel}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative bg-surface-container-high border border-outline-variant rounded-2xl shadow-2xl w-80 p-5"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-on-surface mb-1">Secrets Locked</h3>
        <p className="text-xs text-on-surface-variant mb-3">
          Enter your secrets password to unlock and run this script.
        </p>

        <input
          ref={inputRef}
          type="password"
          placeholder="Password"
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && value) onConfirm(value);
          }}
          className="md-field w-full px-3 py-2 text-sm"
        />

        {error && (
          <p className="text-xs text-error mt-2">{error}</p>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="md-btn md-btn-tonal flex-1 px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => value && onConfirm(value)}
            disabled={!value}
            className="md-btn md-btn-filled flex-1 px-3 py-1.5 text-sm"
          >
            Unlock &amp; Run
          </button>
        </div>
      </div>
    </div>
  );
}
