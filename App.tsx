
import React, { useState } from 'react';
import { HomeView } from './views/HomeView';
import { AdminView } from './views/AdminView';

const App: React.FC = () => {
  const [view, setView] = useState<'home' | 'admin'>('home');

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
