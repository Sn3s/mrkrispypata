import React, { useEffect, useState } from 'react';
import { HomeView } from './views/HomeView';
import { AdminView } from './views/AdminView';
import { ensureSupabaseConfig, needsSupabaseRuntimeBootstrap } from './lib/supabase';

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'admin'>('home');
  const [configReady, setConfigReady] = useState(!needsSupabaseRuntimeBootstrap());

  useEffect(() => {
    if (!needsSupabaseRuntimeBootstrap()) return;
    void ensureSupabaseConfig().finally(() => setConfigReady(true));
  }, []);

  if (!configReady) {
    return (
      <div className="min-h-screen bg-[#0B0B0B] flex flex-col items-center justify-center gap-3 text-white/50 text-sm font-bold px-6">
        <p>Loading…</p>
        <p className="text-white/30 text-xs font-medium text-center max-w-sm">
          Connecting to configuration
        </p>
      </div>
    );
  }

  return (
    <>
      {view === 'home' ? (
        <HomeView onAdminClick={() => setView('admin')} />
      ) : (
        <AdminView onLogout={() => setView('home')} />
      )}
    </>
  );
};

export default App;
