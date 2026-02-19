import React, { useEffect, useState } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle, Image } from 'lucide-react';
import { getTrailerHistory } from '../services/backendService';
import { SamsaraFormSubmission, TrailerStatus } from '../types';

interface Props {
  trailer: TrailerStatus;
  onClose: () => void;
}

export default function TrailerHistoryModal({ trailer, onClose }: Props) {
  const [history, setHistory] = useState<SamsaraFormSubmission[]>([]);

  useEffect(() => {
    setHistory(getTrailerHistory(trailer.id, 10));
  }, [trailer.id]);

  // Close on backdrop click
  const handleBackdrop = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={handleBackdrop}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-800">{trailer.id}</h2>
            {trailer.customerName && (
              <p className="text-sm text-slate-500 mt-0.5">{trailer.customerName}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X size={22} />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-4">
          {history.length === 0 ? (
            <p className="text-center text-slate-400 py-8">No history found for this trailer.</p>
          ) : (
            history.map((event, idx) => (
              <div key={event.id} className="flex gap-4">
                {/* Icon */}
                <div className="flex flex-col items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-white shrink-0 ${
                      event.event === 'DROP' ? 'bg-blue-600' : 'bg-emerald-600'
                    }`}
                  >
                    {event.event === 'DROP' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                  </div>
                  {idx < history.length - 1 && (
                    <div className="w-px flex-1 bg-slate-200 my-1" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pb-2">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span
                      className={`text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                        event.event === 'DROP'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {event.event === 'DROP' ? 'Dropped' : 'Picked Up'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(event.submittedAt).toLocaleString()}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-700">{event.driverName}</p>

                  {event.customerName && (
                    <p className="text-sm text-slate-500">{event.customerName}</p>
                  )}

                  {event.dropLocationDesc && (
                    <p className="text-sm text-slate-500">{event.dropLocationDesc}</p>
                  )}

                  {event.defectLevel && event.defectLevel !== 'No' && (
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                      <span className="text-xs font-medium text-amber-700">{event.defectLevel}</span>
                      {event.defectNotes && (
                        <span className="text-xs text-amber-600">— {event.defectNotes}</span>
                      )}
                    </div>
                  )}

                  {/* Photo links */}
                  {event.photoUrls && event.photoUrls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {event.photoUrls.map((url, i) => (
                        <a
                          key={i}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs text-slate-600 transition-colors"
                        >
                          <Image size={12} />
                          Photo {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
