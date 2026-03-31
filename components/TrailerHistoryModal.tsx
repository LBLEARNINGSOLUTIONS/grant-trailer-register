import React, { useEffect, useState, useCallback } from 'react';
import { X, ArrowDownCircle, ArrowUpCircle, Image, ChevronLeft, ChevronRight } from 'lucide-react';
import { getTrailerHistory } from '../services/backendService';
import { SamsaraFormSubmission, TrailerStatus } from '../types';

interface Props {
  trailer: TrailerStatus;
  onClose: () => void;
}

export default function TrailerHistoryModal({ trailer, onClose }: Props) {
  const [history, setHistory] = useState<SamsaraFormSubmission[]>([]);
  const [lightboxPhotos, setLightboxPhotos] = useState<string[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  useEffect(() => {
    setHistory(getTrailerHistory(trailer.id, 10));
  }, [trailer.id]);

  const openLightbox = useCallback((photos: string[], index: number) => {
    setLightboxPhotos(photos);
    setLightboxIndex(index);
  }, []);

  const closeLightbox = useCallback(() => {
    setLightboxPhotos([]);
    setLightboxIndex(0);
  }, []);

  const navigateLightbox = useCallback((dir: -1 | 1) => {
    setLightboxIndex(prev => {
      const next = prev + dir;
      if (next < 0) return lightboxPhotos.length - 1;
      if (next >= lightboxPhotos.length) return 0;
      return next;
    });
  }, [lightboxPhotos.length]);

  // Keyboard navigation for lightbox
  useEffect(() => {
    if (lightboxPhotos.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') navigateLightbox(-1);
      if (e.key === 'ArrowRight') navigateLightbox(1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxPhotos.length, closeLightbox, navigateLightbox]);

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
            <p className="text-sm text-slate-500 mt-0.5">{trailer.location}</p>
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

                  <p className="text-sm text-slate-500">{event.location}</p>

                  {event.defectLevel && event.defectLevel !== 'No' && (
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200">
                      <span className="text-xs font-medium text-amber-700">{event.defectLevel}</span>
                      {event.defectNotes && (
                        <span className="text-xs text-amber-600">— {event.defectNotes}</span>
                      )}
                    </div>
                  )}

                  {event.accessoryNotes && (
                    <div className="mt-1.5 text-xs text-slate-500">
                      <span className="font-medium text-slate-600">Accessories:</span> {event.accessoryNotes}
                    </div>
                  )}

                  {/* Photo thumbnails */}
                  {event.photoUrls && event.photoUrls.length > 0 && (
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {event.photoUrls.map((url, i) => (
                        <div
                          key={i}
                          className="relative aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-80 transition-opacity bg-slate-100"
                          onClick={() => openLightbox(event.photoUrls!, i)}
                        >
                          <img
                            src={url}
                            alt={`Photo ${i + 1}`}
                            loading="lazy"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              const target = e.currentTarget;
                              target.style.display = 'none';
                              target.parentElement!.classList.add('flex', 'items-center', 'justify-center');
                              const fallback = document.createElement('div');
                              fallback.className = 'flex flex-col items-center gap-1 text-slate-400';
                              fallback.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span class="text-[10px]">Photo ${i + 1}</span>`;
                              target.parentElement!.appendChild(fallback);
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightboxPhotos.length > 0 && (
        <div
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center"
          onClick={(e) => { if (e.target === e.currentTarget) closeLightbox(); }}
        >
          {/* Close button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-10"
          >
            <X size={28} />
          </button>

          {/* Navigation arrows */}
          {lightboxPhotos.length > 1 && (
            <>
              <button
                onClick={() => navigateLightbox(-1)}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-10"
              >
                <ChevronLeft size={36} />
              </button>
              <button
                onClick={() => navigateLightbox(1)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/70 hover:text-white p-2 rounded-full hover:bg-white/10 transition-colors z-10"
              >
                <ChevronRight size={36} />
              </button>
            </>
          )}

          {/* Image */}
          <img
            src={lightboxPhotos[lightboxIndex]}
            alt={`Photo ${lightboxIndex + 1}`}
            className="max-h-[90vh] max-w-[90vw] object-contain rounded-lg"
          />

          {/* Counter */}
          {lightboxPhotos.length > 1 && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/50 px-3 py-1 rounded-full">
              {lightboxIndex + 1} / {lightboxPhotos.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
