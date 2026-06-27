export function stripComments(script: string): string {
  return script
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

export function generateId(): string {
  return crypto.randomUUID();
}

export function formatTimeAgo(timestamp: number | null): string {
  if (timestamp === null) return 'Never';
  const diff = Date.now() - timestamp;
  if (diff < 5000) return 'Just now';
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
