import React, { useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw, Truck } from 'lucide-react';
import { getDataIssues } from '../services/backendService';
import { DataIssue } from '../types';

export default function DataIssuesView() {
  const [issues, setIssues] = useState<DataIssue[]>([]);

  const load = () => setIssues(getDataIssues());

  useEffect(() => {
    load();
  }, []);

  const pickupIssues = issues.filter(i => i.type === 'PICKUP_WITHOUT_DROP');
  const unknownIssues = issues.filter(i => i.type === 'UNKNOWN_TRAILER');

  const IssueTable = ({ rows, emptyMsg }: { rows: DataIssue[]; emptyMsg: string }) => (
    rows.length === 0 ? (
      <div className="flex flex-col items-center justify-center py-8 text-slate-400">
        <Truck size={32} className="mb-2 opacity-30" />
        <p className="text-sm">{emptyMsg}</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700 text-slate-400 text-left">
              <th className="px-4 py-2 font-medium">Trailer #</th>
              <th className="px-4 py-2 font-medium">Event</th>
              <th className="px-4 py-2 font-medium">Timestamp</th>
              <th className="px-4 py-2 font-medium">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {rows.map(issue => (
              <tr key={issue.id} className="hover:bg-slate-800 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-white">{issue.trailerNumber}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    issue.type === 'PICKUP_WITHOUT_DROP'
                      ? 'bg-amber-900 text-amber-300'
                      : 'bg-red-900 text-red-300'
                  }`}>
                    {issue.type === 'PICKUP_WITHOUT_DROP' ? 'PICKUP / NO DROP' : 'UNKNOWN TRAILER'}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                  {new Date(issue.timestamp).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-slate-300 text-xs">{issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-slate-200 font-semibold flex items-center gap-2">
          <AlertTriangle size={16} className="text-amber-400" />
          {issues.length === 0 ? 'No data issues detected' : `${issues.length} issue${issues.length !== 1 ? 's' : ''} detected`}
        </h3>
        <button onClick={load} className="text-slate-400 hover:text-white text-xs flex items-center gap-1">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Pickups without a prior drop */}
      <div>
        <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 px-1">
          Pickups Without a Prior Drop ({pickupIssues.length})
        </h4>
        <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
          <IssueTable rows={pickupIssues} emptyMsg="No pickup anomalies found." />
        </div>
      </div>

      {/* Unknown trailer numbers */}
      <div>
        <h4 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2 px-1">
          Unrecognized Trailer Numbers ({unknownIssues.length})
        </h4>
        <div className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700">
          <IssueTable rows={unknownIssues} emptyMsg="All trailer numbers match the master list." />
        </div>
      </div>
    </div>
  );
}
