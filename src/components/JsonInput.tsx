import { useEffect, useRef } from 'react';
import { EditorView, basicSetup } from 'codemirror';
import { keymap } from '@codemirror/view';
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

    const view = new EditorView({
      doc: value || '',
      extensions: [
        basicSetup,
        json(),
        oneDark,
        linter(jsonParseLinter()),
        keymap.of(onSubmit ? [{
          key: 'Mod-Enter',
          run: () => { onSubmit(); return true; },
        }] : []),
        EditorView.domEventHandlers({
          keydown: (event) => {
            const key = event.key.toLowerCase();
            if ((event.ctrlKey || event.metaKey) && ['c', 'v', 'x', 'z', 'y', 'a'].includes(key)) return false;
            if (event.ctrlKey || event.metaKey || event.altKey) { event.preventDefault(); return true; }
            if (/^f\d+$/i.test(key)) { event.preventDefault(); return true; }
            return false;
          },
        }),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
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

  return <div ref={containerRef} className="codemirror-editor text-[10px]" />;
}
