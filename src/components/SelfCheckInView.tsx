import React, { useEffect, useState } from 'react';
import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import {
  Calendar,
  CheckCircle2,
  MapPin,
  Minus,
  Plus,
  QrCode,
  AlertCircle,
} from 'lucide-react';
import { db } from '../firebase';
import {
  clampQuantity,
  normalizeEmployeeNo,
  type PublicEventHeader,
  VALIDATION,
} from '../types/event';

interface SelfCheckInViewProps {
  eventId: string;
  kioskCode: string;
  onExitPreview?: () => void;
}

interface StoredConfirmation {
  employeeNo: string;
  fullName: string;
  department: string;
  quantity: number;
  submittedAt: string;
}

const COMMON_DEPARTMENTS = [
  'Engineering',
  'Operations',
  'Sales',
  'Marketing',
  'Finance',
  'People & Culture',
  'Customer Success',
  'Administration',
];

export function SelfCheckInView({
  eventId,
  kioskCode,
  onExitPreview,
}: SelfCheckInViewProps) {
  const [eventHeader, setEventHeader] = useState<PublicEventHeader | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [employeeNo, setEmployeeNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [quantity, setQuantity] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<StoredConfirmation | null>(
    null
  );

  const storageKey = `noelcheck_pass_${eventId}`;

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        setConfirmation(JSON.parse(saved) as StoredConfirmation);
      }
    } catch {
      // Ignore storage error
    }
  }, [storageKey]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);

    getDoc(doc(db, 'publicEvents', eventId))
      .then((snap) => {
        if (!active) return;
        if (!snap.exists()) {
          setLoadError('This event registration link is invalid or has expired.');
          setLoading(false);
          return;
        }
        const data = snap.data();
        setEventHeader({
          id: snap.id,
          title: String(data.title ?? 'Christmas Party'),
          eventDate: String(data.eventDate ?? ''),
          venue: String(data.venue ?? ''),
          ownerId: String(data.ownerId ?? ''),
          kioskEnabled: Boolean(data.kioskEnabled),
        });
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Unable to load event details. Please try again.'
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [eventId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventHeader) return;

    const normEmpNo = normalizeEmployeeNo(employeeNo);
    const trimmedName = fullName.trim().slice(0, VALIDATION.FULL_NAME_MAX);
    const trimmedDept = department.trim().slice(0, VALIDATION.DEPARTMENT_MAX);

    if (!normEmpNo || normEmpNo.length > VALIDATION.EMP_NO_MAX) {
      setSubmitError(
        `Employee No. must be 1 to ${VALIDATION.EMP_NO_MAX} characters.`
      );
      return;
    }
    if (!VALIDATION.EMP_NO_REGEX.test(normEmpNo)) {
      setSubmitError(
        'Employee No. may only use letters, numbers, hyphens, underscores, or periods.'
      );
      return;
    }
    if (!trimmedName) {
      setSubmitError('Please enter your full name.');
      return;
    }
    if (!trimmedDept) {
      setSubmitError('Please enter or select your department.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    const safeQty = clampQuantity(quantity);

    try {
      const ref = doc(collection(db, 'events', eventId, 'selfCheckins'));
      await setDoc(ref, {
        eventId,
        ownerId: eventHeader.ownerId,
        kioskCode,
        employeeNo: normEmpNo,
        fullName: trimmedName,
        department: trimmedDept,
        quantity: safeQty,
        createdAt: serverTimestamp(),
      });

      const receipt: StoredConfirmation = {
        employeeNo: normEmpNo,
        fullName: trimmedName,
        department: trimmedDept,
        quantity: safeQty,
        submittedAt: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };

      setConfirmation(receipt);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(receipt));
      } catch {
        // Ignore storage error
      }
    } catch (err) {
      const msg =
        err instanceof Error && err.message.toLowerCase().includes('permission')
          ? 'This QR code is expired or currently paused by the event organizer.'
          : err instanceof Error
            ? err.message
            : 'Check-in failed. Please try again.';
      setSubmitError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetForAnother = () => {
    setConfirmation(null);
    setEmployeeNo('');
    setFullName('');
    setDepartment('');
    setQuantity(1);
    setSubmitError(null);
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // Ignore
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      <header className="bg-white border-b border-slate-200 px-5 py-4">
        <div className="max-w-lg mx-auto flex items-center justify-between gap-4">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900">
            NoelCheck
          </span>
          {onExitPreview && (
            <button
              type="button"
              onClick={onExitPreview}
              className="text-xs font-semibold text-emerald-900 hover:underline whitespace-nowrap"
            >
              Back to Organizer Desk
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-start sm:items-center justify-center p-5">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              <div className="h-6 bg-slate-100 rounded w-2/3 animate-pulse" />
              <div className="h-4 bg-slate-100 rounded w-1/2 animate-pulse" />
              <div className="h-11 bg-slate-100 rounded animate-pulse mt-6" />
              <div className="h-11 bg-slate-100 rounded animate-pulse" />
            </div>
          ) : loadError || !eventHeader ? (
            <div className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-red-700 mx-auto mb-3" />
              <h1 className="font-display text-xl font-semibold text-slate-900">
                Registration Link Unavailable
              </h1>
              <p className="text-sm text-slate-600 mt-2">
                {loadError || 'Unable to locate this event.'}
              </p>
            </div>
          ) : !eventHeader.kioskEnabled ? (
            <div className="p-8 text-center">
              <QrCode className="w-8 h-8 text-slate-400 mx-auto mb-3" />
              <h1 className="font-display text-xl font-semibold text-slate-900">
                {eventHeader.title}
              </h1>
              <p className="text-sm text-slate-600 mt-2">
                Self-registration via this QR code is currently paused by the event organizer. Please check in at the registration desk.
              </p>
            </div>
          ) : confirmation ? (
            <div className="p-7 sm:p-8">
              <div className="flex items-center gap-3 text-emerald-800">
                <CheckCircle2 className="w-7 h-7 shrink-0" />
                <div>
                  <h1 className="font-display text-2xl font-semibold text-slate-900">
                    You&apos;re Checked In
                  </h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {eventHeader.title}
                  </p>
                </div>
              </div>

              <div className="mt-6 bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Employee No.</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {confirmation.employeeNo}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Full Name</span>
                  <span className="font-semibold text-slate-900 text-right">
                    {confirmation.fullName}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Department</span>
                  <span className="font-medium text-slate-800 text-right">
                    {confirmation.department}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-500">Quantity</span>
                  <span className="font-mono font-semibold text-emerald-800 tabular-nums">
                    {confirmation.quantity}
                  </span>
                </div>
                <div className="flex justify-between gap-4 pt-2 border-t border-slate-200">
                  <span className="text-slate-500">Status</span>
                  <span className="font-semibold text-emerald-800">
                    Present · {confirmation.submittedAt}
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-500 text-center mt-5">
                Show this screen if requested at the entrance. Enjoy the Christmas party!
              </p>

              <button
                type="button"
                onClick={handleResetForAnother}
                className="mt-5 w-full py-2.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                Register Another Employee
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
              <div className="pb-4 border-b border-slate-200">
                <h1 className="font-display text-2xl font-semibold text-slate-900 tracking-tight">
                  {eventHeader.title}
                </h1>
                <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {eventHeader.eventDate}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {eventHeader.venue}
                  </span>
                </div>
              </div>

              {submitError && (
                <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
                  {submitError}
                </div>
              )}

              <div>
                <label
                  htmlFor="self-emp-no"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Employee No.
                </label>
                <input
                  id="self-emp-no"
                  type="text"
                  required
                  autoFocus
                  autoComplete="off"
                  maxLength={VALIDATION.EMP_NO_MAX}
                  value={employeeNo}
                  onChange={(e) => setEmployeeNo(e.target.value)}
                  placeholder="e.g. EMP-1001"
                  className="w-full px-4 py-3 text-base font-mono bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-emerald-800"
                />
              </div>

              <div>
                <label
                  htmlFor="self-full-name"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="self-full-name"
                  type="text"
                  required
                  maxLength={VALIDATION.FULL_NAME_MAX}
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className="w-full px-4 py-3 text-base bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-800"
                />
              </div>

              <div>
                <label
                  htmlFor="self-dept"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  Department
                </label>
                <input
                  id="self-dept"
                  type="text"
                  required
                  list="dept-options"
                  maxLength={VALIDATION.DEPARTMENT_MAX}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Engineering, Operations, Sales"
                  className="w-full px-4 py-3 text-base bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-800"
                />
                <datalist id="dept-options">
                  {COMMON_DEPARTMENTS.map((dept) => (
                    <option key={dept} value={dept} />
                  ))}
                </datalist>
              </div>

              <div className="flex items-center justify-between gap-4 bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
                <div>
                  <div className="text-xs font-semibold text-slate-700">
                    Attendance Quantity
                  </div>
                  <div className="text-[11px] text-slate-500">
                    1 for yourself, or increase if bringing guests
                  </div>
                </div>
                <div className="inline-flex items-center border border-slate-200 bg-white rounded-lg">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => clampQuantity(q - 1))}
                    className="p-2.5 text-slate-600 hover:text-slate-900"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-3 text-sm font-mono font-semibold text-slate-900 tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => clampQuantity(q + 1))}
                    className="p-2.5 text-slate-600 hover:text-slate-900"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-950 disabled:opacity-50 rounded-lg transition-colors"
              >
                {submitting ? 'Checking In...' : 'Confirm Attendance & Check In'}
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
