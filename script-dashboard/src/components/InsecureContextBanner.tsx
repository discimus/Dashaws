import { useState } from 'react';

export function InsecureContextBanner() {
  const [dismissed, setDismissed] = useState(false);

  if (typeof window === 'undefined' || window.isSecureContext || dismissed) return null;

  return (
    <div className="fixed top-12 left-0 right-0 bg-warning-container text-on-warning-container px-4 py-2 text-sm flex items-center gap-3 z-30">
      <span>Non-secure connection — clipboard and some crypto features use fallbacks.</span>
      <a
        href={window.location.href.replace(/^http:/, 'https:')}
        className="underline hover:opacity-80 whitespace-nowrap"
      >
        Switch to localhost
      </a>
      <button
        onClick={() => setDismissed(true)}
        className="ml-auto hover:opacity-70 text-lg leading-none"
        title="Dismiss"
      >
        X
      </button>
    </div>
  );
}
