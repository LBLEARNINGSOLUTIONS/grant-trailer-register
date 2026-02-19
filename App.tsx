import React, { useState, useEffect } from 'react';
import { Truck, Shield, LayoutDashboard } from 'lucide-react';
import OwnerDashboard from './components/OwnerDashboard';
import AdminPanel from './components/AdminPanel';
import { AppMode } from './types';
import { triggerSamsaraSync } from './services/backendService';

const SYNC_INTERVAL_MS = 60_000; // sync Samsara every 60 seconds

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.OWNER);

  // Background sync — runs on mount and every 60s regardless of active tab
  useEffect(() => {
    triggerSamsaraSync();
    const interval = setInterval(triggerSamsaraSync, SYNC_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const NavButton = ({ targetMode, icon: Icon, label }: { targetMode: AppMode; icon: any; label: string }) => (
    <button
      onClick={() => setMode(targetMode)}
      className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all ${
        mode === targetMode
          ? 'text-blue-600 bg-blue-50 font-bold'
          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
      }`}
    >
      <Icon size={24} className="mb-1" />
      <span className="text-xs">{label}</span>
    </button>
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm z-20">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-2 rounded-lg text-white">
            <Truck size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-slate-800">Grant Trailer</h1>
            <p className="text-xs text-slate-400">Register System</p>
          </div>
        </div>

        {/* Desktop Navigation (Hidden on Mobile) */}
        <nav className="hidden md:flex bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setMode(AppMode.OWNER)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === AppMode.OWNER ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Owner
          </button>
          <button
            onClick={() => setMode(AppMode.ADMIN)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === AppMode.ADMIN ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Admin
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        {mode === AppMode.OWNER && <OwnerDashboard />}
        {mode === AppMode.ADMIN && <AdminPanel />}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden bg-white border-t border-slate-200 grid grid-cols-2 pb-6 pt-2 px-2 z-20">
        <NavButton targetMode={AppMode.OWNER} icon={LayoutDashboard} label="Dashboard" />
        <NavButton targetMode={AppMode.ADMIN} icon={Shield} label="Admin" />
      </nav>
    </div>
  );
};

export default App;
