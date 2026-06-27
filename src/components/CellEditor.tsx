import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { useCellsStore } from '../store/useCellsStore';
import type { Cell } from '../types/cell';

interface Props {
  cell: Cell;
}

export function CellEditor({ cell }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isExternalUpdateRef = useRef(false);
  const updateCell = useCellsStore(s => s.updateCell);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update: import('@codemirror/view').ViewUpdate) => {
      if (update.docChanged) {
        if (isExternalUpdateRef.current) {
          isExternalUpdateRef.current = false;
          return;
        }
        const content = update.state.doc.toString();
        updateCell(cell.id, { script: content });
      }
    });

    const view = new EditorView({
      doc: cell.script,
      extensions: [basicSetup, javascript(), oneDark, updateListener],
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
    if (cell.script !== current) {
      isExternalUpdateRef.current = true;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: cell.script },
      });
    }
  }, [cell.script]);

  return (
    <div ref={containerRef} className="codemirror-editor text-sm" />
  );
}
