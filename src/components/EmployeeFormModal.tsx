import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  type Attendee,
  type AttendeeStatus,
  clampQuantity,
  normalizeEmployeeNo,
  VALIDATION,
} from '../types/event';

interface EmployeeFormModalProps {
  open: boolean;
  editingAttendee: Attendee | null;
  onClose: () => void;
  onSave: (payload: {
    employeeNo: string;
    fullName: string;
    department: string;
    quantity: number;
    status: AttendeeStatus;
  }) => Promise<void>;
}

export function EmployeeFormModal({
  open,
  editingAttendee,
  onClose,
  onSave,
}: EmployeeFormModalProps) {
  const [employeeNo, setEmployeeNo] = useState('');
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<AttendeeStatus>('absent');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingAttendee) {
      setEmployeeNo(editingAttendee.employeeNo);
      setFullName(editingAttendee.fullName);
      setDepartment(editingAttendee.department);
      setQuantity(editingAttendee.quantity);
      setStatus(editingAttendee.status);
    } else {
      setEmployeeNo('');
      setFullName('');
      setDepartment('');
      setQuantity(1);
      setStatus('absent');
    }
  }, [editingAttendee, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normEmpNo = normalizeEmployeeNo(employeeNo);
    if (!normEmpNo || normEmpNo.length > VALIDATION.EMP_NO_MAX) {
      setError(`Employee No. must be 1 to ${VALIDATION.EMP_NO_MAX} characters.`);
      return;
    }
    if (!VALIDATION.EMP_NO_REGEX.test(normEmpNo)) {
      setError(
        'Employee No. may only contain letters, numbers, hyphens, underscores, or periods.'
      );
      return;
    }
    if (!fullName.trim() || fullName.trim().length > VALIDATION.FULL_NAME_MAX) {
      setError(`Full name must be 1 to ${VALIDATION.FULL_NAME_MAX} characters.`);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSave({
        employeeNo: normEmpNo,
        fullName: fullName.trim().slice(0, VALIDATION.FULL_NAME_MAX),
        department:
          department.trim().slice(0, VALIDATION.DEPARTMENT_MAX) || 'General',
        quantity: clampQuantity(quantity),
        status,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save employee.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="emp-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 id="emp-modal-title" className="text-base font-semibold text-slate-900">
            {editingAttendee ? 'Edit Employee Record' : 'Add Employee to Roster'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-500 hover:text-slate-900 rounded-md"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="emp-no-field"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Employee No.
            </label>
            <input
              id="emp-no-field"
              type="text"
              required
              disabled={Boolean(editingAttendee)}
              maxLength={VALIDATION.EMP_NO_MAX}
              value={employeeNo}
              onChange={(e) => setEmployeeNo(e.target.value)}
              placeholder="e.g. EMP-1025"
              className="w-full px-3.5 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-800"
            />
          </div>

          <div>
            <label
              htmlFor="emp-name-field"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Full Name
            </label>
            <input
              id="emp-name-field"
              type="text"
              required
              maxLength={VALIDATION.FULL_NAME_MAX}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. Camille Mendoza"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="emp-dept-field"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Department
              </label>
              <input
                id="emp-dept-field"
                type="text"
                maxLength={VALIDATION.DEPARTMENT_MAX}
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="Engineering"
                className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800"
              />
            </div>
            <div>
              <label
                htmlFor="emp-qty-field"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Quantity (1–50)
              </label>
              <input
                id="emp-qty-field"
                type="number"
                required
                min={VALIDATION.QUANTITY_MIN}
                max={VALIDATION.QUANTITY_MAX}
                value={quantity}
                onChange={(e) => setQuantity(clampQuantity(Number(e.target.value)))}
                className="w-full px-3.5 py-2 text-sm font-mono tabular-nums bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800"
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 mb-1.5">
              Attendance Status
            </span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setStatus('absent')}
                className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                  status === 'absent'
                    ? 'bg-red-50 border-red-300 text-red-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Absent
              </button>
              <button
                type="button"
                onClick={() => setStatus('present')}
                className={`py-2 text-xs font-semibold rounded-lg border transition-colors ${
                  status === 'present'
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                Present
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-950 disabled:opacity-50 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : editingAttendee ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
