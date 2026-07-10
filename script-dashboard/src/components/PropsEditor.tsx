import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
import { Prec } from '@codemirror/state';
import { indentMore } from '@codemirror/commands';
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
        onSave(update.state.doc.toString());
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
      { key: 'Tab', run: indentMore },
      { key: 'Mod-Shift-f', run: formatJson },
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
      doc: cell.params || '{\n  \n}',
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
    <div className="border-t border-outline-variant">
      <div className="px-3 py-1.5 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider">$props (JSON)</span>
        <span className="text-[10px] text-on-surface-variant/60">— passed via queue or pubsub messages</span>
      </div>
      <div ref={containerRef} className="codemirror-editor text-xs" />
    </div>
  );
}
