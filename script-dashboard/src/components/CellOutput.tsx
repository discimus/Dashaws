import { useRef, useEffect, useState, useCallback } from 'react';
import type { Cell } from '../types/cell';

interface Props {
  cell: Cell;
}

export function CellOutput({ cell }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevLenRef = useRef(cell.output.length);
  const [hasNewOutput, setHasNewOutput] = useState(false);

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
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      case 'table': return 'text-purple-400';
      default: return 'text-gray-300';
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

  return (
    <div className="relative border-t border-gray-600">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="bg-gray-700/50 h-48 overflow-y-auto p-2 font-mono text-xs"
      >
        {cell.output.length === 0 ? (
          <span className="text-gray-400 italic">No output yet</span>
        ) : (
          cell.output.map((entry, i) => (
            <div key={i} className={`${getColor(entry.type)} py-0.5 border-b border-gray-600/50`}>
              <span className="text-gray-400 mr-2 text-[10px]">
                {new Date(entry.timestamp).toLocaleTimeString()}
              </span>
              <span className="text-gray-400 mr-1">[{entry.type}]</span>
              {entry.args.map((arg, j) => (
                <span key={j} className="whitespace-pre-wrap">
                  {j > 0 ? ' ' : ''}{formatValue(arg)}
                </span>
              ))}
            </div>
          ))
        )}
      </div>
      {hasNewOutput && cell.output.length > 0 && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-2 right-2 bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 py-1 rounded shadow-md transition-colors z-10"
        >
          ↓ New output
        </button>
      )}
    </div>
  );
}
