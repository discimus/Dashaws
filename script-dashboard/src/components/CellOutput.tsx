import { useRef, useEffect, useState, useCallback } from 'react';
import type { Cell } from '../types/cell';
import { copyToClipboard } from '../utils/clipboard';

interface Props {
  cell: Cell;
}

const MAX_CHARS_COLLAPSED = 300;
const MAX_LINES_COLLAPSED = 3;

export function CellOutput({ cell }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevLenRef = useRef(cell.output.length);
  const [hasNewOutput, setHasNewOutput] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (copiedIndex === null) return;
    const timeout = setTimeout(() => setCopiedIndex(null), 1500);
    return () => clearTimeout(timeout);
  }, [copiedIndex]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 30;
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    isAtBottomRef.current = atBottom;
    if (atBottom) {
      setHasNewOutput(false);
    }
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const prevLen = prevLenRef.current;
    const newLen = cell.output.length;
    prevLenRef.current = newLen;

    if (newLen <= prevLen && prevLen > 0) {
      return;
    }

    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
      setHasNewOutput(false);
    } else {
      setHasNewOutput(true);
    }
  }, [cell.output]);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setHasNewOutput(false);
    }
  };

  const getColor = (type: string): string => {
    switch (type) {
      case 'error': return 'text-error';
      case 'warn': return 'text-warning';
      case 'info': return 'text-primary';
      case 'table': return 'text-accent-purple';
      default: return 'text-on-surface-variant';
    }
  };

  const formatValue = (val: unknown): string => {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'string') return val;
    if (typeof val === 'object') {
      try {
        return JSON.stringify(val, null, 2);
      } catch {
        return String(val);
      }
    }
    return String(val);
  };

  const isLongContent = (text: string): boolean => {
    return text.length > MAX_CHARS_COLLAPSED || (text.match(/\n/g) || []).length > MAX_LINES_COLLAPSED;
  };

  const truncateText = (text: string): string => {
    const lines = text.split('\n');
    if (lines.length > MAX_LINES_COLLAPSED) {
      return lines.slice(0, MAX_LINES_COLLAPSED).join('\n') + '\n...';
    }
    if (text.length > MAX_CHARS_COLLAPSED) {
      return text.slice(0, MAX_CHARS_COLLAPSED) + '...';
    }
    return text;
  };

  const toggleExpand = (index: number) => {
    setExpandedEntries(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const handleCopy = (text: string, index: number) => {
    copyToClipboard(text);
    setCopiedIndex(index);
  };

  return (
    <div className="relative border-t border-outline-variant">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="bg-surface-container-lowest h-48 overflow-y-auto p-2 font-mono text-xs"
      >
        {cell.output.length === 0 ? (
          <span className="text-on-surface-variant/70 italic">No output yet</span>
        ) : (
          cell.output.map((entry, i) => {
            const fullText = entry.args.map(formatValue).join(' ');
            const long = isLongContent(fullText);
            const expanded = expandedEntries.has(i);
            const displayText = long && !expanded ? truncateText(fullText) : fullText;

            return (
              <div key={i} className={`${getColor(entry.type)} group py-0.5 border-b border-outline-variant/40`}>
                <div className="flex items-start gap-1">
                  <span className="text-on-surface-variant/60 mr-2 text-[10px] shrink-0 leading-5">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                  <span className="text-on-surface-variant/60 mr-1 shrink-0 text-[10px] leading-5">[{entry.type}]</span>
                  <span className="whitespace-pre-wrap break-all flex-1 min-w-0">
                    {displayText}
                  </span>
                  <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopy(fullText, i); }}
                      className="p-0.5 rounded hover:bg-on-surface/10 transition-colors leading-none"
                      title="Copy to clipboard"
                    >
                      {copiedIndex === i ? (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-success">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
                {long && (
                  <button
                    onClick={() => toggleExpand(i)}
                    className="text-[10px] text-primary hover:text-primary/80 transition-colors ml-24 mt-0.5"
                  >
                    {expanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
      {hasNewOutput && cell.output.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-2 right-2 bg-primary text-on-primary text-xs font-medium px-3 py-1 rounded-full hover:shadow-md transition-shadow z-10"
        >
          ↓ New output
        </button>
      )}
    </div>
  );
}
