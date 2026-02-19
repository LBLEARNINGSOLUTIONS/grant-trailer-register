import React, { useState, useEffect, useMemo } from 'react';
import { Search, AlertTriangle, Clock, Truck, RefreshCw, X } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { getTrailers, getNewEventsForOwnerNotifications, markOwnerNotified } from '../services/backendService';
import { TrailerStatus, SamsaraFormSubmission } from '../types';
import ActivityFeed from './ActivityFeed';

const COLORS = ['#3b82f6', '#f59e0b', '#ef4444', '#10b981'];

type ToastMsg = { 
  id: string; 
  event: 'DROP' | 'PICK'; 
  title: string; 
  body: string; 
};

const OwnerDashboard: React.FC = () => {
  const [trailers, setTrailers] = useState<TrailerStatus[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'AGING' | 'ATTENTION'>('ALL');
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);

  const pushToast = (t: ToastMsg) => {
    setToasts((prev) => [...prev, t]);

    // auto-dismiss
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== t.id));
    }, 9000);
  };

  const loadData = () => {
    setLoading(true);
    // Simulate slight loading delay for effect
    setTimeout(() => {
      setTrailers(getTrailers());
      
      const notif = getNewEventsForOwnerNotifications(3);

      if (notif.toNotify.length) {
        notif.toNotify.forEach((s: SamsaraFormSubmission) => {
          pushToast({
            id: crypto.randomUUID(),
            event: s.event,
            title: `${s.event === 'DROP' ? 'Dropped' : 'Picked Up'} • ${s.trailerNumber}`,
            body: `${s.location ?? 'Location unknown'} • ${new Date(s.submittedAt).toLocaleTimeString()}`
          });
        });

        markOwnerNotified(notif.lastTs);
      }

      setLoading(false);
    }, 400);
  };

  useEffect(() => {
    loadData();
    // Auto-refresh every 30s
    const interval = setInterval(loadData, 30000);
    return () => clearInterval(interval);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Metrics
  const droppedTrailers = useMemo(() => trailers.filter(t => t.status === 'DROPPED'), [trailers]);
  
  const agingCount = useMemo(() => {
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    return droppedTrailers.filter(t => new Date(t.lastUpdated).getTime() < twentyFourHoursAgo).length;
  }, [droppedTrailers]);

  const attentionCount = useMemo(() => {
    return droppedTrailers.filter(t => t.condition && t.condition !== 'Good').length;
  }, [droppedTrailers]);

  // Chart Data
  const chartData = useMemo(() => [
    { name: 'Good', value: droppedTrailers.filter(t => t.condition === 'Good').length },
    { name: 'Needs Service', value: droppedTrailers.filter(t => t.condition === 'Needs Service').length },
    { name: 'Damaged', value: droppedTrailers.filter(t => t.condition === 'Damaged').length },
  ].filter(d => d.value > 0), [droppedTrailers]);

  // Filtered List
  const filteredTrailers = useMemo(() => {
    let result = droppedTrailers;

    if (filter === 'AGING') {
      const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
      result = result.filter(t => new Date(t.lastUpdated).getTime() < twentyFourHoursAgo);
    } else if (filter === 'ATTENTION') {
      result = result.filter(t => t.condition !== 'Good');
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(t => 
        t.id.toLowerCase().includes(lower) || 
        t.location.toLowerCase().includes(lower)
      );
    }

    return result.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  }, [droppedTrailers, filter, searchTerm]);

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">
      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-3 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto w-80 bg-white border border-slate-200 shadow-2xl rounded-xl p-3"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-white shrink-0 ${
                  t.event === 'DROP' ? 'bg-blue-600' : 'bg-emerald-600'
                }`}
              >
                {t.event === 'DROP' ? '↓' : '↑'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-800 truncate">{t.title}</div>
                <div className="text-xs text-slate-600 truncate mt-0.5">{t.body}</div>
              </div>

              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Metrics Row */}
      <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4 bg-white border-b border-slate-200 shadow-sm z-10 shrink-0">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
          <div>
            <p className="text-blue-600 text-sm font-medium">Dropped Trailers</p>
            <p className="text-3xl font-bold text-blue-900">{droppedTrailers.length}</p>
          </div>
          <Truck className="text-blue-300" size={32} />
        </div>
        
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 flex items-center justify-between">
          <div>
            <p className="text-orange-600 text-sm font-medium">Aging ({'>'}24h)</p>
            <p className="text-3xl font-bold text-orange-900">{agingCount}</p>
          </div>
          <Clock className="text-orange-300" size={32} />
        </div>

        <div className="bg-red-50 p-4 rounded-xl border border-red-100 flex items-center justify-between">
          <div>
            <p className="text-red-600 text-sm font-medium">Needs Attention</p>
            <p className="text-3xl font-bold text-red-900">{attentionCount}</p>
          </div>
          <AlertTriangle className="text-red-300" size={32} />
        </div>

        <div className="hidden md:block h-24 w-full">
             <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={25}
                    outerRadius={40}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col md:flex-row gap-6">
        
        {/* Left Col: Trailer List (Flexible width) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-4 justify-between items-center shrink-0">
            <div className="relative w-full md:w-96">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search trailer # or location..." 
                className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
               <button 
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${filter === 'ALL' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
               >
                 All Open
               </button>
               <button 
                onClick={() => setFilter('AGING')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${filter === 'AGING' ? 'bg-orange-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
               >
                 <Clock size={14} /> Aging
               </button>
               <button 
                onClick={() => setFilter('ATTENTION')}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-2 ${filter === 'ATTENTION' ? 'bg-red-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
               >
                 <AlertTriangle size={14} /> Issues
               </button>
               <button 
                onClick={loadData}
                className="ml-auto p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                title="Refresh Data"
               >
                 <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
               </button>
            </div>
          </div>

          {/* Table/Cards */}
          <div className="flex-1 overflow-y-auto custom-scrollbar bg-white rounded-xl shadow-sm border border-slate-200">
             {filteredTrailers.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                 <Truck size={48} className="mb-4 opacity-20" />
                 <p>No trailers found matching criteria.</p>
               </div>
             ) : (
              <div className="min-w-full">
                 <div className="grid grid-cols-1 md:hidden">
                   {/* Mobile Cards */}
                   {filteredTrailers.map(trailer => (
                     <div key={trailer.id} className="p-4 border-b border-slate-100 hover:bg-slate-50">
                       <div className="flex justify-between items-start mb-2">
                         <span className="text-lg font-bold text-slate-800">{trailer.id}</span>
                         <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                           trailer.condition === 'Good' ? 'bg-green-100 text-green-700' : 
                           trailer.condition === 'Needs Service' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                         }`}>
                           {trailer.condition}
                         </span>
                       </div>
                       <div className="text-sm text-slate-600 mb-1 flex items-center gap-1">
                         <Truck size={12} /> {trailer.location}
                       </div>
                       <div className="text-xs text-slate-400 flex justify-between items-center mt-2">
                         <span>By: {trailer.droppedBy}</span>
                         <span>{new Date(trailer.lastUpdated).toLocaleDateString()}</span>
                       </div>
                     </div>
                   ))}
                 </div>

                 {/* Desktop Table */}
                 <table className="hidden md:table w-full">
                   <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                     <tr>
                       <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Trailer</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Location</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Condition</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Dropped By</th>
                       <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Date</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100">
                     {filteredTrailers.map(trailer => (
                       <tr key={trailer.id} className="hover:bg-slate-50 transition-colors">
                         <td className="px-6 py-4 whitespace-nowrap font-bold text-slate-800">{trailer.id}</td>
                         <td className="px-6 py-4 whitespace-nowrap text-slate-600">{trailer.location}</td>
                         <td className="px-6 py-4 whitespace-nowrap">
                           <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              trailer.condition === 'Good' ? 'bg-green-100 text-green-800' : 
                              trailer.condition === 'Needs Service' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'
                           }`}>
                             {trailer.condition}
                           </span>
                         </td>
                         <td className="px-6 py-4 whitespace-nowrap text-slate-500 text-sm">{trailer.droppedBy}</td>
                         <td className="px-6 py-4 whitespace-nowrap text-slate-400 text-sm">
                           {new Date(trailer.lastUpdated).toLocaleString()}
                         </td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
              </div>
             )}
          </div>
        </div>

        {/* Right Col: Recent Activity (Fixed width on desktop) */}
        <div className="w-full md:w-80 shrink-0 h-96 md:h-auto">
          <ActivityFeed />
        </div>
      </div>
    </div>
  );
};

export default OwnerDashboard;