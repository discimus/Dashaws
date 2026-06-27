import { useEffect, useState } from 'react';
import { useCellsStore } from './store/useCellsStore';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Overview } from './components/Overview';
import { ScriptsView } from './components/ScriptsView';
import { EnvView } from './components/EnvView';
import { SecretsView } from './components/SecretsView';

export type View = 'overview' | 'scripts' | 'env' | 'secrets';

export default function App() {
  const { loaded, init } = useCellsStore();
  const [view, setView] = useState<View>('overview');
  const [focusCellId, setFocusCellId] = useState<string | null>(null);

  useEffect(() => {
    init();
  }, [init]);

  const navigateToEditor = (cellId: string) => {
    setFocusCellId(cellId);
    setView('scripts');
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-400 bg-gray-950">
        <div className="text-center">
          <div className="text-lg mb-2">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 text-gray-100 overflow-hidden">
      <TopBar />
      <div className="flex h-full pt-12">
        <Sidebar view={view} onViewChange={setView} onEditCell={navigateToEditor} />
        <main className="flex-1 overflow-y-auto px-4 pb-4 bg-gray-800">
          {view === 'overview' ? (
            <Overview onEditCell={navigateToEditor} />
          ) : view === 'scripts' ? (
            <ScriptsView focusCellId={focusCellId} onFocusHandled={() => setFocusCellId(null)} />
          ) : view === 'env' ? (
            <EnvView />
          ) : (
            <SecretsView />
          )}
        </main>
      </div>
    </div>
  );
}
