import { useMemo } from 'react';
import QRCode from 'qrcode';
import { Calendar, Download, MapPin, Printer } from 'lucide-react';
import { buildEventCheckInUrl, type PartyEvent } from '../types/event';
import { QrCodeImage } from './QrCodeImage';

interface EventPosterViewProps {
  event: PartyEvent;
}

export function EventPosterView({ event }: EventPosterViewProps) {
  const checkInUrl = useMemo(
    () => buildEventCheckInUrl(event.id, event.kioskCode),
    [event.id, event.kioskCode]
  );

  const handleDownloadHighRes = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(checkInUrl, {
        width: 1200,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `christmas-party-qr-${event.kioskCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to download QR PNG:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="no-print bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Printable Entrance QR Poster
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Print this single poster or display it full-screen on a lobby monitor for all ~400 employees.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => void handleDownloadHighRes()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Download QR PNG
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-950 rounded-lg transition-colors whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            Print Poster
          </button>
        </div>
      </div>

      {/* Printable Poster Canvas */}
      <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-10 sm:p-14 text-center print:border-0 print:p-6">
        <p className="text-xs font-semibold text-emerald-900 tracking-wide">
          Event Attendance Registration
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-semibold text-slate-900 tracking-tight mt-2">
          {event.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-slate-400" />
            {event.eventDate}
          </span>
          <span aria-hidden="true">·</span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="w-4 h-4 text-slate-400" />
            {event.venue}
          </span>
        </div>

        <div className="my-8 inline-flex p-5 bg-white border-2 border-slate-900 rounded-2xl">
          <QrCodeImage
            value={checkInUrl}
            size={300}
            alt="Event registration QR code"
          />
        </div>

        <h2 className="font-display text-xl font-semibold text-slate-900">
          Scan to Check In
        </h2>
        <div className="mt-4 max-w-md mx-auto grid grid-cols-1 sm:grid-cols-3 gap-4 text-left text-xs text-slate-600 pt-4 border-t border-slate-200">
          <div>
            <div className="font-semibold text-slate-900">01. Scan QR Code</div>
            <p className="mt-0.5">Point your phone camera at the QR code above.</p>
          </div>
          <div>
            <div className="font-semibold text-slate-900">02. Enter Details</div>
            <p className="mt-0.5">Type your Employee No., Full Name, and Department.</p>
          </div>
          <div>
            <div className="font-semibold text-slate-900">03. Confirm</div>
            <p className="mt-0.5">Tap Check In to mark yourself Present.</p>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 text-[11px] font-mono text-slate-400 break-all">
          {checkInUrl}
        </div>
      </div>
    </div>
  );
}
