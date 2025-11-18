import React, { useState } from 'react';
import { Landing } from './components/Landing';
import { Dashboard } from './components/Dashboard';

type ViewState = 'landing' | 'dashboard';

function App() {
  // Simple state-based routing
  const [currentView, setCurrentView] = useState<ViewState>('landing');

  return (
    <>
      {currentView === 'landing' && (
        <Landing onEnter={() => setCurrentView('dashboard')} />
      )}
      {currentView === 'dashboard' && (
        <Dashboard />
      )}
    </>
  );
}

export default App;