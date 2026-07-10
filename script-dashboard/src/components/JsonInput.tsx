import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
}

export function JsonInput({ value, onChange, onSubmit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const jsonTheme = Prec.high(EditorView.theme({
      '&': { backgroundColor: '#191a1e !important' },
      '.cm-gutters': { backgroundColor: '#141316 !important', borderRight: '1px solid #43474e !important', color: '#8e9099 !important' },
    }));

    const autoHeight = EditorView.theme({
      '&': { height: 'auto' },
      '.cm-scroller': { overflow: 'hidden' },
      '.cm-content': { minHeight: '32px' },
      '.cm-gutter': { minHeight: '32px' },
      '.cm-lint-marker-error': { fontSize: '100%' },
    });

    const updateListener = EditorView.updateListener.of(update => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
      const view = update.view;
      requestAnimationFrame(() => {
        const h = Math.max(48, view.contentHeight);
        if (view.dom.style.height !== h + 'px') {
          view.dom.style.height = h + 'px';
        }
      });
    });

    const formatJson = (view: EditorView): boolean => {
      const raw = view.state.doc.toString();
      try {
        const formatted = JSON.stringify(JSON.parse(raw), null, 2);
        if (formatted !== raw) {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: formatted },
          });
        }
        return true;
      } catch { return false; }
    };

    const shortcuts = keymap.of([
      { key: 'Mod-Shift-f', run: formatJson },
      ...(onSubmit ? [{ key: 'Mod-Enter', run: () => { onSubmit(); return true; } }] : []),
    ]);

    const pasteHandler = EditorView.domEventHandlers({
      paste: (_event, view) => {
        setTimeout(() => {
          const raw = view.state.doc.toString();
          try {
            const formatted = JSON.stringify(JSON.parse(raw), null, 2);
            if (formatted !== raw) {
              view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: formatted },
              });
            }
          } catch { /* keep as-is if invalid */ }
        }, 10);
        return false;
      },
    });

    const view = new EditorView({
      doc: value || '',
      extensions: [
        basicSetup,
        json(),
        oneDark,
        linter(jsonParseLinter()),
        shortcuts,
        jsonTheme,
        autoHeight,
        updateListener,
        pasteHandler,
      ],
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value !== view.state.doc.toString()) {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
      });
    }
  }, [value]);

  return <div ref={containerRef} className="codemirror-editor text-[10px] border border-outline-variant rounded-lg overflow-hidden" />;
}
