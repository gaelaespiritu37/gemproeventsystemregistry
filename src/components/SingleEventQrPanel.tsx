import React, { useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Minus,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import {
  type Attendee,
  buildEventCheckInUrl,
  type CheckInFeedback,
  clampQuantity,
  formatTimeShort,
  normalizeEmployeeNo,
  type PartyEvent,
  VALIDATION,
} from '../types/event';
import { QrCodeImage } from './QrCodeImage';

interface SingleEventQrPanelProps {
  event: PartyEvent;
  attendees: Attendee[];
  soundEnabled: boolean;
  onToggleSound: () => void;
  onDirectCheckIn: (data: {
    employeeNo: string;
    fullName: string;
    department: string;
    quantity: number;
  }) => Promise<CheckInFeedback>;
  onUndoCheckIn: (attendee: Attendee) => Promise<void>;
  onToggleKioskEnabled: () => Promise<void>;
  onRotateKioskCode: () => Promise<void>;
  onOpenPosterTab: () => void;
  onPreviewSelfForm: () => void;
}

export function SingleEventQrPanel({
  event,
  attendees,
  soundEnabled,
  onToggleSound,
  onDirectCheckIn,
  onUndoCheckIn,
  onToggleKioskEnabled,
  onRotateKioskCode,
  onOpenPosterTab,
  onPreviewSelfForm,
}: SingleEventQrPanelProps) {
  const [employeeNo, setEmployeeNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [lastFeedback, setLastFeedback] = useState<CheckInFeedback | null>(null);
  const [copied, setCopied] = useState(false);

  const empNoInputRef = useRef<HTMLInputElement>(null);

  const checkInUrl = useMemo(
    () => buildEventCheckInUrl(event.id, event.kioskCode),
    [event.id, event.kioskCode]
  );

  const attendeeByEmpNo = useMemo(() => {
    const map = new Map<string, Attendee>();
    for (const a of attendees) {
      map.set(normalizeEmployeeNo(a.employeeNo), a);
    }
    return map;
  }, [attendees]);

  const suggestions = useMemo(() => {
    const q = employeeNo.trim().toLowerCase();
    if (!q) return [];
    return attendees
      .filter(
        (a) =>
          a.employeeNo.toLowerCase().includes(q) ||
          a.fullName.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [attendees, employeeNo]);

  const recentCheckIns = useMemo(() => {
    return attendees
      .filter((a) => a.status === 'present' && a.checkedInAt)
      .sort((a, b) => {
        const ta = a.checkedInAt?.toMillis() ?? 0;
        const tb = b.checkedInAt?.toMillis() ?? 0;
        return tb - ta;
      })
      .slice(0, 8);
  }, [attendees]);

  const handleEmpNoChange = (val: string) => {
    setEmployeeNo(val);
    const matched = attendeeByEmpNo.get(normalizeEmployeeNo(val));
    if (matched) {
      setFullName(matched.fullName);
      setDepartment(matched.department);
      setQuantity(matched.quantity);
    }
  };

  const handleSelectSuggestion = (emp: Attendee) => {
    setEmployeeNo(emp.employeeNo);
    setFullName(emp.fullName);
    setDepartment(emp.department);
    setQuantity(emp.quantity);
  };

  const handleDirectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const norm = normalizeEmployeeNo(employeeNo);
    if (!norm || !fullName.trim()) return;

    setSubmitting(true);
    try {
      const result = await onDirectCheckIn({
        employeeNo: norm,
        fullName: fullName.trim().slice(0, VALIDATION.FULL_NAME_MAX),
        department:
          department.trim().slice(0, VALIDATION.DEPARTMENT_MAX) || 'General',
        quantity: clampQuantity(quantity),
      });
      setLastFeedback(result);
      setEmployeeNo('');
      setFullName('');
      setDepartment('');
      setQuantity(1);
    } finally {
      setSubmitting(false);
      empNoInputRef.current?.focus();
    }
  };

  const handleDownloadQrPng = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(checkInUrl, {
        width: 1000,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `event-checkin-qr-${event.kioskCode}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('QR download error:', err);
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(checkInUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const matchedLastAttendee = lastFeedback
    ? attendeeByEmpNo.get(normalizeEmployeeNo(lastFeedback.employeeNo))
    : undefined;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left 5 Cols: The ONE Shared Event QR Code */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Single Event QR Code
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              One shared QR code for all employees to self-register at the door.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onToggleKioskEnabled()}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
              event.kioskEnabled
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'
            }`}
          >
            {event.kioskEnabled ? 'QR Active' : 'QR Paused'}
          </button>
        </div>

        <div className="py-6 flex flex-col items-center text-center">
          <div className="p-4 bg-white border border-slate-200 rounded-2xl">
            <QrCodeImage
              value={checkInUrl}
              size={220}
              alt="Single shared Christmas party check-in QR code"
            />
          </div>
          <p className="mt-4 text-xs font-medium text-slate-700 max-w-xs">
            Employees scan this single code on their phone and enter their{' '}
            <span className="font-semibold text-slate-900">Employee No.</span>,{' '}
            <span className="font-semibold text-slate-900">Full Name</span>, and{' '}
            <span className="font-semibold text-slate-900">Department</span>.
          </p>
          <div className="mt-2 font-mono text-[11px] text-slate-400">
            Pass Code: {event.kioskCode}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 pt-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => void handleDownloadQrPng()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-950 rounded-lg transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Download QR
          </button>
          <button
            type="button"
            onClick={onOpenPosterTab}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Poster
          </button>
          <button
            type="button"
            onClick={() => void handleCopyUrl()}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-700" />
                Copied Link
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy Link
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onPreviewSelfForm}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Test Mobile Form
          </button>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => void onRotateKioskCode()}
            className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Reset QR Pass Code
          </button>
        </div>
      </div>

      {/* Right 7 Cols: Direct Desk Check-In Form + Live Arrivals */}
      <div className="lg:col-span-7 space-y-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Direct Desk Check-In
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Register an employee directly on the tracker if they do not have a phone handy.
              </p>
            </div>
            <button
              type="button"
              onClick={onToggleSound}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-emerald-800" />
                  Sound On
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-500" />
                  Muted
                </>
              )}
            </button>
          </div>

          <form onSubmit={handleDirectSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="desk-emp-no"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Employee No.
                </label>
                <input
                  ref={empNoInputRef}
                  id="desk-emp-no"
                  type="text"
                  required
                  autoComplete="off"
                  maxLength={VALIDATION.EMP_NO_MAX}
                  value={employeeNo}
                  onChange={(e) => handleEmpNoChange(e.target.value)}
                  placeholder="e.g. EMP-1001"
                  className="w-full px-3.5 py-2.5 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-emerald-800"
                />
              </div>

              <div>
                <label
                  htmlFor="desk-full-name"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="desk-full-name"
                  type="text"
                  required
                  maxLength={VALIDATION.FULL_NAME_MAX}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Employee full name"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-800"
                />
              </div>
            </div>

            {suggestions.length > 0 && !attendeeByEmpNo.has(normalizeEmployeeNo(employeeNo)) && (
              <div className="border border-slate-200 rounded-lg bg-slate-50 divide-y divide-slate-200 overflow-hidden">
                {suggestions.map((emp) => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => handleSelectSuggestion(emp)}
                    className="w-full px-3.5 py-2 flex items-center justify-between text-left hover:bg-white transition-colors text-xs"
                  >
                    <div>
                      <span className="font-mono font-semibold text-slate-900">
                        {emp.employeeNo}
                      </span>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="font-medium text-slate-800">
                        {emp.fullName}
                      </span>
                      <span className="mx-2 text-slate-300">·</span>
                      <span className="text-slate-500">{emp.department}</span>
                    </div>
                    <span
                      className={`font-semibold ${
                        emp.status === 'present'
                          ? 'text-emerald-700'
                          : 'text-slate-600'
                      }`}
                    >
                      {emp.status === 'present' ? 'Present' : 'Select'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-end">
              <div className="sm:col-span-6">
                <label
                  htmlFor="desk-dept"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Department
                </label>
                <input
                  id="desk-dept"
                  type="text"
                  required
                  maxLength={VALIDATION.DEPARTMENT_MAX}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Engineering, Operations"
                  className="w-full px-3.5 py-2.5 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-800"
                />
              </div>

              <div className="sm:col-span-3">
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Quantity
                </span>
                <div className="flex items-center justify-between border border-slate-300 rounded-lg bg-white px-1 py-1">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => clampQuantity(q - 1))}
                    className="p-1.5 text-slate-600 hover:text-slate-900"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-sm font-mono font-semibold text-slate-900 tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => clampQuantity(q + 1))}
                    className="p-1.5 text-slate-600 hover:text-slate-900"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="sm:col-span-3">
                <button
                  type="submit"
                  disabled={submitting || !employeeNo.trim() || !fullName.trim()}
                  className="w-full py-2.5 px-4 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-950 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap"
                >
                  {submitting ? 'Saving...' : 'Check In'}
                </button>
              </div>
            </div>
          </form>

          {lastFeedback && (
            <div
              role="status"
              aria-live="polite"
              className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3.5 flex flex-wrap items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 text-xs">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span className="font-semibold text-slate-900">
                  {lastFeedback.message}
                </span>
                <span className="text-slate-300">·</span>
                <span className="font-mono font-semibold text-slate-900">
                  {lastFeedback.employeeNo}
                </span>
                {lastFeedback.fullName && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-700">{lastFeedback.fullName}</span>
                  </>
                )}
              </div>
              {matchedLastAttendee && matchedLastAttendee.status === 'present' && (
                <button
                  type="button"
                  onClick={() => void onUndoCheckIn(matchedLastAttendee)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md"
                >
                  <RotateCcw className="w-3 h-3" />
                  Undo
                </button>
              )}
            </div>
          )}
        </div>

        {/* Live Arrivals Feed */}
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-slate-200">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Live Check-In Feed
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Includes both mobile QR scans and direct desk entries
              </p>
            </div>
            <span className="text-xs font-mono font-semibold text-emerald-800 tabular-nums">
              {recentCheckIns.length} recent
            </span>
          </div>

          {recentCheckIns.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                Waiting for the first arrival
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Employees scanning the Event QR code will appear here in real time.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 mt-1">
              {recentCheckIns.map((emp) => (
                <div
                  key={emp.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-slate-900 truncate">
                      {emp.fullName}
                    </div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <span className="font-mono tabular-nums">{emp.employeeNo}</span>
                      <span aria-hidden="true">·</span>
                      <span className="truncate">{emp.department || 'General'}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-xs font-mono font-semibold text-emerald-800 tabular-nums">
                      Qty {emp.quantity}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400 tabular-nums">
                      {formatTimeShort(emp.checkedInAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
