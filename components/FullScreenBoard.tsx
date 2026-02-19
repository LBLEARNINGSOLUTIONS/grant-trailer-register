import React, { useEffect, useState, useCallback } from 'react';
import { LogOut, RefreshCw } from 'lucide-react';
import { getTrailers } from '../services/backendService';
import { TrailerStatus } from '../types';

interface Props {
  onExit: () => void;
}

function formatAge(isoDate: string): { label: string; tier: 'fresh' | 'aging' | 'overdue' } {
  const ms = Date.now() - new Date(isoDate).getTime();
  const hours = ms / (1000 * 60 * 60);
  const mins = Math.floor((ms / (1000 * 60)) % 60);
  const h = Math.floor(hours);

  if (hours < 4) return { label: h > 0 ? `${h}h ${mins}m` : `${mins}m`, tier: 'fresh' };
  if (hours < 24) return { label: `${h}h ${mins}m`, tier: 'aging' };
  return { label: `${Math.floor(hours / 24)}d ${h % 24}h`, tier: 'overdue' };
}

const TIER_ROW: Record<string, string> = {
  fresh:   'bg-slate-800 border-slate-700',
  aging:   'bg-amber-950 border-amber-800',
  overdue: 'bg-red-950 border-red-800',
};

const TIER_AGE: Record<string, string> = {
  fresh:   'text-slate-300',
  aging:   'text-amber-300 font-semibold',
  overdue: 'text-red-300 font-bold',
};

const DEFECT_BADGE: Record<string, string> = {
  'No':                   'hidden',
  'Yes (minor)':          'bg-amber-800 text-amber-200',
  'Yes (needs attention)':'bg-red-800 text-red-200',
};

export default function FullScreenBoard({ onExit }: Props) {
  const [trailers, setTrailers] = useState<TrailerStatus[]>([]);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = useCallback(() => {
    setTrailers(getTrailers());
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);

    // Request full-screen
    document.documentElement.requestFullscreen().catch(() => {});

    return () => {
      clearInterval(interval);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, [load]);

  return (
    <div className="fixed inset-0 bg-slate-900 text-white flex flex-col z-50 overflow-hidden">
      {/* Board Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">Dropped Trailer Pool</h1>
          <p className="text-slate-400 text-sm mt-0.5">{trailers.length} trailer{trailers.length !== 1 ? 's' : ''} currently on yard</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right text-sm text-slate-400">
            <RefreshCw size={12} className="inline mr-1 opacity-50" />
            Last updated {lastRefresh.toLocaleTimeString()}
          </div>
          <button
            onClick={onExit}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-sm font-medium transition-colors"
          >
            <LogOut size={16} />
            Exit
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {trailers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <p className="text-2xl font-light">No trailers currently on yard</p>
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Trailer #</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer / Job</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Drop Location</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Driver</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Dropped At</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Age</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-400 uppercase tracking-wider">Defect</th>
              </tr>
            </thead>
            <tbody>
              {trailers.map(t => {
                const age = formatAge(t.lastUpdated);
                const defectClass = DEFECT_BADGE[t.defectLevel ?? 'No'] ?? 'hidden';
                return (
                  <tr key={t.id} className={`border-b ${TIER_ROW[age.tier]} transition-colors`}>
                    <td className="px-6 py-4 text-xl font-bold font-mono">{t.id}</td>
                    <td className="px-6 py-4 text-base text-slate-200">{t.customerName || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{t.dropLocationDesc || t.location || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-300">{t.droppedBy || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-400 whitespace-nowrap">
                      {new Date(t.lastUpdated).toLocaleString()}
                    </td>
                    <td className={`px-6 py-4 text-lg ${TIER_AGE[age.tier]}`}>{age.label}</td>
                    <td className="px-6 py-4">
                      {t.defectLevel && t.defectLevel !== 'No' ? (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${defectClass}`}>
                          {t.defectLevel}
                        </span>
                      ) : (
                        <span className="text-slate-600 text-sm">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Legend */}
      <div className="shrink-0 flex items-center gap-6 px-6 py-3 border-t border-slate-700 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-500 inline-block" /> &lt; 4h</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-600 inline-block" /> 4–24h</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-red-600 inline-block" /> &gt; 24h</span>
        <span className="ml-auto">Auto-refreshes every 30s</span>
      </div>
    </div>
  );
}
