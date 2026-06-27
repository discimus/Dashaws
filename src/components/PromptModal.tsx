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
      <div className="absolute inset-0 bg-black/60" />
      <div
        className="relative bg-gray-800 border border-gray-600 rounded-lg shadow-2xl w-80 p-5"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-gray-200 mb-1">Secrets Locked</h3>
        <p className="text-xs text-gray-400 mb-3">
          Enter your secrets password to unlock and run this cell.
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
          className="w-full bg-gray-900 border border-gray-500 rounded px-3 py-2 text-sm text-gray-200 outline-none focus:border-blue-500 placeholder-gray-500"
        />

        {error && (
          <p className="text-xs text-red-400 mt-2">{error}</p>
        )}

        <div className="flex gap-2 mt-4">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-1.5 rounded text-xs font-semibold bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => value && onConfirm(value)}
            disabled={!value}
            className="flex-1 px-3 py-1.5 rounded text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Unlock &amp; Run
          </button>
        </div>
      </div>
    </div>
  );
}
