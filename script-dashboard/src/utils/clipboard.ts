/**
 * Copy text to clipboard with fallback for insecure contexts (HTTP).
 * Returns true if the text was copied successfully.
 */
export function copyToClipboard(text: string): boolean {
  // Modern async clipboard API (requires secure context)
  if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
    navigator.clipboard.writeText(text).catch(() => {
      // Silently ignore — user can copy manually
    });
    return true;
  }

  // Legacy fallback via execCommand (works in all contexts)
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.left = '-9999px';
    textarea.style.opacity = '0';
    textarea.setAttribute('readonly', '');
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    const success = document.execCommand('copy');
    document.body.removeChild(textarea);
    return success;
  } catch {
    return false;
  }
}
