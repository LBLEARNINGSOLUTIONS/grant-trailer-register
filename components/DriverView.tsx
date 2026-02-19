import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownCircle, ArrowUpCircle, Copy, ExternalLink, QrCode, X } from 'lucide-react';
import QRCode from 'qrcode';
import { DEEP_LINK_DROP, DEEP_LINK_PICK } from '../constants';

type Action = 'DROP' | 'PICK';

function isDesktop() {
  if (typeof navigator === 'undefined') return false;
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function actionInfo(action: Action) {
  return action === 'DROP'
    ? {
        label: 'Drop Trailer',
        link: DEEP_LINK_DROP,
        color: 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800',
        subText: 'text-blue-200',
        Icon: ArrowDownCircle,
      }
    : {
        label: 'Pick Up Trailer',
        link: DEEP_LINK_PICK,
        color: 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800',
        subText: 'text-emerald-200',
        Icon: ArrowUpCircle,
      };
}

export default function DriverView() {
  const desktop = useMemo(isDesktop, []);

  // Default: button view (no QR modal on load)
  const [showQR, setShowQR] = useState<Action | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');

  const openDeepLink = (action: Action) => {
    const { link } = actionInfo(action);

    // Hidden anchor click - often works better than location.assign for custom protocols
    const a = document.createElement('a');
    a.href = link;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyLink = async (action: Action) => {
    const { link } = actionInfo(action);
    try {
      await navigator.clipboard?.writeText(link);
      alert('Link copied. Paste into browser or send to driver.');
    } catch {
      alert('Could not copy link on this device.');
    }
  };

  useEffect(() => {
    if (!showQR) return;
    const { link } = actionInfo(showQR);
    QRCode.toDataURL(link, { margin: 1, scale: 6, errorCorrectionLevel: 'M' })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [showQR]);

  const ActionCard: React.FC<{ action: Action }> = ({ action }) => {
    const { label, color, subText, Icon } = actionInfo(action);

    return (
      <div className="relative rounded-2xl shadow-lg overflow-hidden min-h-[280px]">
        {/* Small buttons moved to top-left */}
        <div className="absolute top-4 left-4 flex gap-2 z-10">
          <button
            title="Copy Link"
            className="bg-white/20 hover:bg-white/30 p-2 rounded-full text-white backdrop-blur"
            onClick={(e) => {
              e.stopPropagation();
              copyLink(action);
            }}
          >
            <Copy size={18} />
          </button>

          <button
            title="Show QR"
            className="bg-white/20 hover:bg-white/30 p-2 rounded-full text-white backdrop-blur"
            onClick={(e) => {
              e.stopPropagation();
              setShowQR(action);
            }}
          >
            <QrCode size={22} />
          </button>
        </div>

        <button
          onClick={() => openDeepLink(action)}
          className={`w-full h-full ${color} text-white rounded-2xl flex flex-col items-center justify-center gap-2 py-10 px-4`}
        >
          <Icon size={64} className="mb-2" />
          <span className="text-3xl font-bold tracking-wider">{label.toUpperCase()}</span>
          <span className={`${subText} mt-1 text-sm flex items-center gap-1`}>
            Tap to Open Samsara <ExternalLink size={14} />
          </span>
        </button>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-100 p-4 gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-slate-800">Driver Actions</h2>
        <p className="text-slate-500 text-sm">Tap to launch Samsara Driver App</p>
      </div>

      {/* Side-by-side buttons */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
        <ActionCard action="DROP" />
        <ActionCard action="PICK" />
      </div>

      {/* Desktop optional: QR links available, but do NOT auto-open */}
      {desktop && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(['DROP', 'PICK'] as Action[]).map((action) => (
            <button
              key={action}
              className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition text-left"
              onClick={() => setShowQR(action)}
            >
              <div className="font-semibold mb-2">{action === 'DROP' ? 'Drop Trailer QR' : 'Pick Up Trailer QR'}</div>
              <div className="text-xs text-slate-500">Click to open QR for scanning</div>
            </button>
          ))}
        </div>
      )}

      {showQR && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm flex flex-col items-center relative shadow-2xl">
            <button
              onClick={() => setShowQR(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={28} />
            </button>

            <h3 className="text-xl font-bold text-slate-800 mb-1">
              {showQR === 'DROP' ? 'Drop Trailer' : 'Pick Up Trailer'}
            </h3>
            <p className="text-slate-500 text-sm mb-6">Scan with your phone to open Samsara</p>

            <div className="bg-white p-2 rounded-xl border-2 border-slate-100 shadow-inner">
              {qrDataUrl ? (
                <img src={qrDataUrl} alt={`${showQR} QR Code`} className="w-64 h-64 object-contain" />
              ) : (
                <div className="w-64 h-64 flex items-center justify-center text-slate-400 text-sm">
                  Building QR…
                </div>
              )}
            </div>

            <p className="mt-6 text-xs text-center text-slate-400 max-w-[80%]">
              If the deep link fails, open camera and scan this code.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}