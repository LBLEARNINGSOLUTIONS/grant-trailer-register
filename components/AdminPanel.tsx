import React, { useState, useEffect } from 'react';
import { RefreshCw, Database, Terminal, CheckCircle, XCircle } from 'lucide-react';
import { triggerSamsaraSync, getLogs } from '../services/backendService';
import { SyncLog } from '../types';

const AdminPanel: React.FC = () => {
  const [syncing, setSyncing] = useState(false);
  const [logs, setLogs] = useState<SyncLog[]>([]);

  const refreshLogs = () => {
    setLogs(getLogs());
  };

  useEffect(() => {
    refreshLogs();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    await triggerSamsaraSync();
    setSyncing(false);
    refreshLogs();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto w-full">
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
             <Database className="text-blue-600" /> System Administration
           </h2>
           <p className="text-slate-500 text-sm mt-1">Manage data synchronization with Samsara API.</p>
        </div>
        
        <button
          onClick={handleSync}
          disabled={syncing}
          className={`flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-white shadow-md transition-all ${
            syncing ? 'bg-slate-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 active:scale-95'
          }`}
        >
          <RefreshCw className={syncing ? 'animate-spin' : ''} size={20} />
          {syncing ? 'Syncing...' : 'Trigger Sync Now'}
        </button>
      </div>

      <div className="bg-slate-900 rounded-xl overflow-hidden shadow-xl border border-slate-800">
        <div className="bg-slate-800 px-4 py-3 flex items-center justify-between">
          <span className="text-slate-200 font-mono text-sm flex items-center gap-2">
            <Terminal size={16} /> /var/log/samsara-sync
          </span>
          <button onClick={refreshLogs} className="text-slate-400 hover:text-white text-xs">Refresh</button>
        </div>
        
        <div className="h-96 overflow-y-auto custom-scrollbar p-4 font-mono text-sm space-y-3">
          {logs.length === 0 ? (
            <div className="text-slate-500 italic text-center py-8">No logs available. Run a sync to generate entries.</div>
          ) : (
            logs.map(log => (
              <div key={log.id} className="flex gap-3 items-start animate-fade-in">
                <span className="text-slate-500 text-xs whitespace-nowrap mt-0.5">
                  [{new Date(log.timestamp).toLocaleTimeString()}]
                </span>
                {log.status === 'SUCCESS' ? (
                  <CheckCircle size={16} className="text-green-500 mt-0.5 shrink-0" />
                ) : (
                  <XCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
                )}
                <div>
                   <span className={log.status === 'SUCCESS' ? 'text-green-400' : 'text-red-400'}>
                     {log.status === 'SUCCESS' ? 'SYNC_COMPLETE' : 'SYNC_FAILED'}
                   </span>
                   <span className="text-slate-300 mx-2">-</span>
                   <span className="text-slate-300">{log.message}</span>
                   {log.recordsProcessed > 0 && (
                     <span className="ml-2 px-1.5 py-0.5 bg-slate-700 rounded text-xs text-cyan-300">
                       +{log.recordsProcessed} records
                     </span>
                   )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
