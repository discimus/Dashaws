import { useEffect, useRef, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { Compartment } from '@codemirror/state';
import { indentMore, toggleComment } from '@codemirror/commands';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { autocompletion, acceptCompletion, type CompletionContext } from '@codemirror/autocomplete';
import { useCellsStore } from '../store/useCellsStore';
import type { Cell } from '../types/cell';

interface Props {
  cell: Cell;
  onFocus?: () => void;
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

export function CellEditor({ cell, onFocus }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const isExternalUpdateRef = useRef(false);
  const isFocusedRef = useRef(false);
  const editableCompartmentRef = useRef(new Compartment());
  const updateCell = useCellsStore(s => s.updateCell);
  const lockCell = useCellsStore(s => s.lockCell);
  const unlockCell = useCellsStore(s => s.unlockCell);
  const clientId = useCellsStore(s => s.clientId);

  const handleFocus = useCallback(() => {
    isFocusedRef.current = true;
    onFocus?.();
    const st = useCellsStore.getState();
    const cc = st.cells.find(c => c.id === cell.id);
    if (cc?.lockedBy && cc.lockedBy !== st.clientId) return;
    lockCell(cell.id);
  }, [cell.id, lockCell, onFocus]);

  const handleBlur = useCallback(() => {
    isFocusedRef.current = false;
    unlockCell(cell.id);
  }, [cell.id, unlockCell]);

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update: import('@codemirror/view').ViewUpdate) => {
      if (update.docChanged) {
        if (isExternalUpdateRef.current) {
          isExternalUpdateRef.current = false;
          return;
        }
        const st = useCellsStore.getState();
        const currentCell = st.cells.find(c => c.id === cell.id);
        if (currentCell?.lockedBy && currentCell.lockedBy !== st.clientId) return;
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
    const tabHandler = keymap.of([{
      key: 'Tab',
      run: (target) => {
        if (acceptCompletion(target)) return true;
        return indentMore(target);
      },
    }]);

    const commentKeymap = keymap.of([{
      key: 'Ctrl-;',
      run: toggleComment,
    }]);

    const blockBrowserShortcuts = EditorView.domEventHandlers({
      keydown: (event) => {
        const key = event.key.toLowerCase();
        if ((event.ctrlKey || event.metaKey) && ['c', 'v', 'x', 'z', 'y', 'a', ';', '/'].includes(key)) return false;
        if (event.ctrlKey || event.metaKey || event.altKey) { event.preventDefault(); return true; }
        if (/^f\d+$/i.test(key)) { event.preventDefault(); return true; }
        return false;
      },
    });

    const langExt = cell.language === 'python' ? python() : javascript();

    const view = new EditorView({
      doc: cell.script,
      extensions: [
        basicSetup,
        langExt,
        oneDark,
        envCompletion,
        tabHandler,
        commentKeymap,
        blockBrowserShortcuts,
        updateListener,
        editableCompartmentRef.current.of(EditorView.editable.of(!cell.lockedBy || cell.lockedBy === clientId)),
      ],
      parent: containerRef.current,
    });

    viewRef.current = view;

    view.contentDOM.addEventListener('focus', handleFocus);
    view.contentDOM.addEventListener('blur', handleBlur);

    return () => {
      view.contentDOM.removeEventListener('focus', handleFocus);
      view.contentDOM.removeEventListener('blur', handleBlur);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cell.id]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    // Toggle editable state based on lock
    const shouldBeEditable = !cell.lockedBy || cell.lockedBy === clientId;
    view.dispatch({
      effects: editableCompartmentRef.current.reconfigure(
        EditorView.editable.of(shouldBeEditable)
      ),
    });

    const current = view.state.doc.toString();
    if (cell.script !== current) {
      if (isFocusedRef.current) return;
      isExternalUpdateRef.current = true;
      const cursor = view.state.selection.main.head;
      view.dispatch({
        changes: { from: 0, to: current.length, insert: cell.script },
        selection: { anchor: Math.min(cursor, cell.script.length) },
      });
    }
  }, [cell.script, cell.lockedBy, cell.lockedAt, clientId]);

  return (
    <div ref={containerRef} className="codemirror-editor text-sm" />
  );
}
