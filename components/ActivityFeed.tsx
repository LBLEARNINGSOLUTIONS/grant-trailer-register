import React, { useEffect, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Bell, CheckCircle } from 'lucide-react';
import { getActivitySummary, markActivitySeen } from '../services/backendService';
import { SamsaraFormSubmission } from '../types';

const ActivityFeed: React.FC = () => {
  const [activity, setActivity] = useState<SamsaraFormSubmission[]>([]);
  const [newCount, setNewCount] = useState(0);

  const loadData = () => {
    const summary = getActivitySummary(12);
    setActivity(summary.activity);
    setNewCount(summary.newCount);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-white shrink-0">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-slate-600" />
          <span className="font-semibold text-slate-800">Recent Drops / Pickups</span>
          {newCount > 0 && (
            <span className="ml-2 inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-amber-100 text-amber-800">
              {newCount} new
            </span>
          )}
        </div>

        <button
          onClick={() => {
            markActivitySeen();
            loadData();
          }}
          className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
        >
          <CheckCircle size={14} />
          Mark seen
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar divide-y divide-slate-100">
        {activity.length === 0 ? (
          <div className="px-4 py-6 text-center text-slate-500 text-sm">No activity yet.</div>
        ) : (
          activity.map((s) => (
            <div key={s.id} className="px-4 py-3 flex gap-3 items-start hover:bg-slate-50 transition-colors">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white flex-shrink-0 ${
                  s.event === 'DROP' ? 'bg-blue-600' : 'bg-emerald-600'
                }`}
              >
                {s.event === 'DROP' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center gap-4">
                  <div className="truncate">
                    <span className="font-semibold text-slate-800">{s.trailerNumber}</span>
                    <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">
                      {s.event === 'DROP' ? 'Dropped' : 'Picked Up'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 whitespace-nowrap">
                    {new Date(s.submittedAt).toLocaleString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit'
                    })}
                  </div>
                </div>
                <div className="text-sm text-slate-600 truncate">
                  {s.driverName ? `By ${s.driverName}` : 'By driver'}
                </div>
                {s.location && <div className="text-xs text-slate-500 truncate">{s.location}</div>}
                {s.notes && <div className="text-xs text-slate-500 truncate">Notes: {s.notes}</div>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default ActivityFeed;