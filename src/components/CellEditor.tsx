import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import { useCellsStore } from '../store/useCellsStore';
import type { Cell } from '../types/cell';

interface Props {
  cell: Cell;
}

function envCompletionSource(context: CompletionContext) {
  const before = context.matchBefore(/\$env\.(\w*)$/);
  if (!before) return null;

  const partial = before.text.slice(5); // strip "$env."
  const env = useCellsStore.getState().env;
  const entries = Object.entries(env);

  if (entries.length === 0) return null;

  const options = entries
    .filter(([key]) => partial === '' || key.toLowerCase().startsWith(partial.toLowerCase()))
    .map(([key, value]) => ({
      label: `$env.${key}`,
      type: 'property' as const,
      detail: value.length > 40 ? value.slice(0, 40) + '...' : value,
      apply: `$env.${key}`,
    }));

  return {
    from: before.from,
    options,
    validFor: (text: string) => /^\$env\.(\w*)$/.test(text),
  };
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

    const envCompletion = autocompletion({ override: [envCompletionSource] });

    const view = new EditorView({
      doc: cell.script,
      extensions: [basicSetup, javascript(), oneDark, envCompletion, updateListener],
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
