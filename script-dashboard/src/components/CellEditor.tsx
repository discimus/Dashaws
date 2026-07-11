import { useEffect, useRef, useCallback } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { Compartment } from '@codemirror/state';
import { indentLess, indentMore, toggleComment } from '@codemirror/commands';
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

const JS_GLOBALS = [
  { label: '$state', detail: 'Persisted state' },
  { label: '$env', detail: 'Environment variables' },
  { label: '$secrets', detail: 'Encrypted secrets' },
  { label: '$props', detail: 'Script parameters' },
  { label: '$queue', detail: 'Message queue' },
  { label: '$pubsub', detail: 'PubSub events' },
  { label: 'console', detail: 'Console logging' },
  { label: 'fetch', detail: 'HTTP client' },
  { label: 'loadPackage', detail: 'Load npm package' },
  { label: 'setTimeout', detail: 'Delayed execution' },
  { label: 'clearTimeout', detail: 'Clear timeout' },
  { label: 'signal', detail: 'Abort signal' },
  { label: 'Math', detail: 'Math utilities' },
  { label: 'JSON', detail: 'JSON utilities' },
  { label: 'Date', detail: 'Date constructor' },
];

const PYTHON_GLOBALS = [
  { label: 'state', detail: 'Persisted state' },
  { label: 'env', detail: 'Environment variables' },
  { label: 'secrets', detail: 'Encrypted secrets' },
  { label: 'props', detail: 'Script parameters' },
  { label: 'queue', detail: 'Message queue' },
  { label: 'pubsub', detail: 'PubSub events' },
  { label: 'console', detail: 'Console logging' },
  { label: 'print', detail: 'Print output' },
  { label: 'requests', detail: 'HTTP client' },
  { label: 'True', detail: 'Boolean true' },
  { label: 'False', detail: 'Boolean false' },
  { label: 'None', detail: 'None/null' },
];

function pythonEnvCompletionSource(context: CompletionContext) {
  const before = context.matchBefore(/env\.(\w*)$/);
  if (!before) return null;
  const partial = before.text.slice(4);
  const env = useCellsStore.getState().env;
  const entries = Object.entries(env);
  if (entries.length === 0) return null;
  const options = entries
    .filter(([key]) => partial === '' || key.toLowerCase().startsWith(partial.toLowerCase()))
    .map(([key, value]) => ({
      label: `env.${key}`,
      type: 'property' as const,
      detail: value.length > 40 ? value.slice(0, 40) + '...' : value,
      apply: `env.${key}`,
    }));
  return { from: before.from, options, validFor: (text: string) => /^env\.(\w*)$/.test(text) };
}

function pythonSecretsCompletionSource(context: CompletionContext) {
  const before = context.matchBefore(/secrets\.(\w*)$/);
  if (!before) return null;
  const partial = before.text.slice(8);
  const secrets = useCellsStore.getState().secrets;
  const entries = Object.entries(secrets);
  if (entries.length === 0) return null;
  const options = entries
    .filter(([key]) => partial === '' || key.toLowerCase().startsWith(partial.toLowerCase()))
    .map(([key]) => ({
      label: `secrets.${key}`,
      type: 'property' as const,
      detail: '\u2022'.repeat(18),
      apply: `secrets.${key}`,
    }));
  return { from: before.from, options, validFor: (text: string) => /^secrets\.(\w*)$/.test(text) };
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

    const stateCompletionSource = (context: CompletionContext) => {
      const isPython = cell.language === 'python';
      const pattern = isPython ? /state\.(\w*)$/ : /\$state\.(\w*)$/;
      const before = context.matchBefore(pattern);
      if (!before) return null;
      const prefix = isPython ? 'state.' : '$state.';
      const partial = before.text.slice(prefix.length);
      const stateKeys = Object.keys(cell.state || {});
      if (stateKeys.length === 0) return null;
      const options = stateKeys
        .filter(k => partial === '' || k.toLowerCase().startsWith(partial.toLowerCase()))
        .map(k => ({ label: prefix + k, type: 'property' as const, apply: prefix + k }));
      if (options.length === 0) return null;
      const validForRe = isPython ? /^state\.(\w*)$/ : /^\$state\.(\w*)$/;
      return { from: before.from, options, validFor: (text: string) => validForRe.test(text) };
    };

    const topLevelGlobalsSource = (context: CompletionContext) => {
      const isPython = cell.language === 'python';
      const globals = isPython ? PYTHON_GLOBALS : JS_GLOBALS;
      const pattern = isPython ? /(\w{2,})$/ : /(\$\w{1,})$/;
      const before = context.matchBefore(pattern);
      if (!before) return null;
      const partial = before.text;
      const options = globals
        .filter(g => g.label.toLowerCase().startsWith(partial.toLowerCase()))
        .map(g => ({ label: g.label, type: 'keyword' as const, detail: g.detail }));
      if (options.length === 0) return null;
      return { from: before.from, options };
    };

    const methodCompletionSource = (context: CompletionContext) => {
      const isPython = cell.language === 'python';
      const pattern = isPython
        ? /(console|queue|pubsub)\.(\w*)$/
        : /(console|\$queue|\$pubsub)\.(\w*)$/;
      const before = context.matchBefore(pattern);
      if (!before) return null;
      const match = before.text.match(pattern);
      if (!match) return null;
      const objectName = match[1];
      const partial = match[2];

      let available: { label: string; detail: string }[] = [];
      if (objectName === 'console') {
        available = [
          { label: 'log', detail: 'Log a message' },
          { label: 'warn', detail: 'Warning' },
          { label: 'error', detail: 'Error' },
          { label: 'info', detail: 'Info' },
          { label: 'table', detail: 'Tabular data' },
        ];
      } else if (objectName === 'queue' || objectName === '$queue') {
        available = [
          { label: 'enqueue', detail: 'Push to queue' },
        ];
      } else if (objectName === 'pubsub' || objectName === '$pubsub') {
        available = [
          { label: 'emit', detail: 'Emit event' },
        ];
      }

      const options = available
        .filter(m => m.label.startsWith(partial))
        .map(m => ({ label: m.label, type: 'method' as const, detail: m.detail, apply: m.label }));
      if (options.length === 0) return null;
      return { from: before.from + objectName.length + 1, options, validFor: /^\w*$/ };
    };

    const completion = autocompletion({
      override: [
        envCompletionSource,
        secretsCompletionSource,
        pythonEnvCompletionSource,
        pythonSecretsCompletionSource,
        propsCompletionSource,
        stateCompletionSource,
        topLevelGlobalsSource,
        methodCompletionSource,
      ],
    });
    const tabHandler = keymap.of([{
      key: 'Tab',
      run: (target) => {
        if (acceptCompletion(target)) return true;
        return indentMore(target);
      },
    }, {
      key: 'Shift-Tab',
      run: indentLess,
    }]);

    const commentKeymap = keymap.of([{
      key: 'Ctrl-;',
      run: toggleComment,
    }]);

    const blockBrowserShortcuts = EditorView.domEventHandlers({
      keydown: (event) => {
        const key = event.key.toLowerCase();
        if ((event.ctrlKey || event.metaKey) && ['c', 'v', 'x', 'z', 'y', 'a', ';', '/'].includes(key)) return false;
        if (event.key === 'Tab' && event.shiftKey) return false;
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
        completion,
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
