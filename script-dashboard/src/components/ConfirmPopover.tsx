import { useEffect, useRef } from 'react';

interface Props {
  open: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmPopover({ open, message, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onCancel]);

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
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 z-30 bg-surface-container-high border border-outline-variant rounded-xl shadow-xl p-3 w-56"
    >
      <p className="text-xs text-on-surface mb-2">{message}</p>
      <div className="flex gap-1.5">
        <button
          onClick={onCancel}
          className="md-btn md-btn-tonal flex-1 px-2 py-1 text-sm"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          className="md-btn md-btn-danger flex-1 px-2 py-1 text-sm"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
