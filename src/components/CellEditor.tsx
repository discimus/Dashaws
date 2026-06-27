import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, acceptCompletion, type CompletionContext } from '@codemirror/autocomplete';
import { Prec } from '@codemirror/state';
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

function secretsCompletionSource(context: CompletionContext) {
  const before = context.matchBefore(/\$secrets\.(\w*)$/);
  if (!before) return null;

  const partial = before.text.slice(9); // strip "$secrets."
  const secrets = useCellsStore.getState().secrets;
  const entries = Object.entries(secrets);

  if (entries.length === 0) return null;

  const options = entries
    .filter(([key]) => partial === '' || key.toLowerCase().startsWith(partial.toLowerCase()))
    .map(([key]) => ({
      label: `$secrets.${key}`,
      type: 'property' as const,
      detail: '\u2022'.repeat(18),
      apply: `$secrets.${key}`,
    }));

  return {
    from: before.from,
    options,
    validFor: (text: string) => /^\$secrets\.(\w*)$/.test(text),
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

    const propsCompletionSource = (context: CompletionContext) => {
      const before = context.matchBefore(/\$props\.(\w*)$/);
      if (!before) return null;

      const partial = before.text.slice(7); // strip "$props."
      let keys: string[] = [];
      try {
        const params = JSON.parse(cell.params || '{}');
        keys = Object.keys(typeof params === 'object' && params !== null ? params : {});
      } catch { /* invalid */ }

      if (keys.length === 0) return null;

      const options = keys
        .filter(key => partial === '' || key.toLowerCase().startsWith(partial.toLowerCase()))
        .map(key => ({
          label: `$props.${key}`,
          type: 'property' as const,
          detail: 'prop',
          apply: `$props.${key}`,
        }));

      return {
        from: before.from,
        options,
        validFor: (text: string) => /^\$props\.(\w*)$/.test(text),
      };
    };

    const envCompletion = autocompletion({ override: [envCompletionSource, secretsCompletionSource, propsCompletionSource] });
    const tabAccept = Prec.high(keymap.of([{ key: 'Tab', run: acceptCompletion }]));

    const view = new EditorView({
      doc: cell.script,
      extensions: [basicSetup, javascript(), oneDark, envCompletion, tabAccept, updateListener],
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
