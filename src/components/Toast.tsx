import { useToastStore } from '../store/toastStore';

export function Toast() {
  const { message, visible } = useToastStore();

  if (!visible) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg shadow-lg text-xs font-semibold animate-pulse">
        {message}
      </div>
    </div>
  );
}
