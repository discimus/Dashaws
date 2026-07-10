import { useToastStore } from '../store/toastStore';

export function Toast() {
  const { message, visible } = useToastStore();

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="bg-on-surface text-surface px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium">
        {message}
      </div>
    </div>
  );
}
