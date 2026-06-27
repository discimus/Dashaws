import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import type { Cell } from '../types/cell';

interface Props {
  cell: Cell;
  onSave: (value: string) => void;
}

export function PropsEditor({ cell, onSave }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      doc: cell.params || '{\n  \n}',
      extensions: [
        basicSetup,
        json(),
        oneDark,
        linter(jsonParseLinter()),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            const content = update.state.doc.toString();
            onSave(content);
          }
        }),
      ],
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell.id]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if ((cell.params || '') !== current) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: cell.params || '{\n  \n}' },
      });
    }
  }, [cell.params]);

  return (
    <div className="border-t border-gray-600/50">
      <div className="px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">$props (JSON)</span>
        <span className="text-[10px] text-gray-600">— passed via $cells.run(id, props)</span>
      </div>
      <div ref={containerRef} className="codemirror-editor text-xs" style={{ height: '100px' }} />
    </div>
  );
}
