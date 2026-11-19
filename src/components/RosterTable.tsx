import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  Minus,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserPlus,
} from 'lucide-react';
import {
  type Attendee,
  type AttendeeStatus,
  clampQuantity,
  formatTimeShort,
} from '../types/event';

interface RosterTableProps {
  attendees: Attendee[];
  loading: boolean;
  onToggleStatus: (attendee: Attendee, nextStatus: AttendeeStatus) => Promise<void>;
  onUpdateQuantity: (attendee: Attendee, nextQty: number) => Promise<void>;
  onEditAttendee: (attendee: Attendee) => void;
  onDeleteAttendee: (attendee: Attendee) => Promise<void>;
  onOpenImportModal: () => void;
  onOpenAddModal: () => void;
  onLoadSampleRoster: () => Promise<void>;
  eventTitle: string;
}

type FilterTab = 'all' | 'present' | 'absent';

export function RosterTable({
  attendees,
  loading,
  onToggleStatus,
  onUpdateQuantity,
  onEditAttendee,
  onDeleteAttendee,
  onOpenImportModal,
  onOpenAddModal,
  onLoadSampleRoster,
  eventTitle,
}: RosterTableProps) {
  const [statusFilter, setStatusFilter] = useState<FilterTab>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loadingSample, setLoadingSample] = useState(false);

  const departments = useMemo(() => {
    const set = new Set<string>();
    attendees.forEach((a) => {
      if (a.department) set.add(a.department);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [attendees]);

  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    let presentQty = 0;
    let absentQty = 0;
    for (const a of attendees) {
      if (a.status === 'present') {
        present += 1;
        presentQty += a.quantity;
      } else {
        absent += 1;
        absentQty += a.quantity;
      }
    }
    return {
      all: attendees.length,
      present,
      absent,
      presentQty,
      absentQty,
    };
  }, [attendees]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return attendees
      .filter((a) => {
        if (statusFilter !== 'all' && a.status !== statusFilter) return false;
        if (deptFilter !== 'all' && a.department !== deptFilter) return false;
        if (q) {
          return (
            a.employeeNo.toLowerCase().includes(q) ||
            a.fullName.toLowerCase().includes(q) ||
            a.department.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => a.employeeNo.localeCompare(b.employeeNo));
  }, [attendees, deptFilter, searchQuery, statusFilter]);

  const handleExportCsv = () => {
    const headers = [
      'Employee No',
      'Full Name',
      'Department',
      'Status',
      'Quantity',
      'Checked In At',
    ];
    const rows = filtered.map((a) => [
      a.employeeNo,
      a.fullName,
      a.department || 'General',
      a.status === 'present' ? 'Present' : 'Absent',
      String(a.quantity),
      a.checkedInAt ? a.checkedInAt.toDate().toISOString() : '',
    ]);
    const csvContent = [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = eventTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    link.href = url;
    link.download = `${safeTitle || 'event'}-${statusFilter}-attendance.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRowStatusToggle = async (attendee: Attendee) => {
    setBusyId(attendee.id);
    try {
      await onToggleStatus(
        attendee,
        attendee.status === 'present' ? 'absent' : 'present'
      );
    } finally {
      setBusyId(null);
    }
  };

  const handleStepQty = async (attendee: Attendee, delta: number) => {
    const nextQty = clampQuantity(attendee.quantity + delta);
    if (nextQty === attendee.quantity) return;
    setBusyId(attendee.id);
    try {
      await onUpdateQuantity(attendee, nextQty);
    } finally {
      setBusyId(null);
    }
  };

  const handleLoadSample = async () => {
    setLoadingSample(true);
    try {
      await onLoadSampleRoster();
    } finally {
      setLoadingSample(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      {/* Toolbar Header */}
      <div className="p-6 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented Filter Control */}
          <div
            role="tablist"
            aria-label="Attendance status filter"
            className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
          >
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'all'}
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All ({counts.all})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'present'}
              onClick={() => setStatusFilter('present')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                statusFilter === 'present'
                  ? 'bg-white text-emerald-800 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Present ({counts.present} · Qty {counts.presentQty})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={statusFilter === 'absent'}
              onClick={() => setStatusFilter('absent')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                statusFilter === 'absent'
                  ? 'bg-white text-red-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Absent ({counts.absent} · Qty {counts.absentQty})
            </button>
          </div>

          {departments.length > 0 && (
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              aria-label="Filter by department"
              className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-800"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Employee No. or name..."
              className="w-full sm:w-60 pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-800"
            />
          </div>
          <button
            type="button"
            onClick={onOpenImportModal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Upload className="w-3.5 h-3.5" />
            Import CSV
          </button>
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Data Grid */}
      {loading ? (
        <div className="p-6 space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-11 bg-slate-100 rounded-md animate-pulse"
            />
          ))}
        </div>
      ) : attendees.length === 0 ? (
        <div className="py-16 px-6 text-center">
          <h3 className="text-base font-semibold text-slate-900">
            Your Christmas Party Roster Is Empty
          </h3>
          <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">
            Import your employee list via CSV, add employees individually, or let employees register directly by scanning the single Event QR code.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-950 rounded-lg transition-colors whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              Add First Employee
            </button>
            <button
              type="button"
              onClick={onOpenImportModal}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              Import CSV / Paste List
            </button>
            <button
              type="button"
              onClick={() => void handleLoadSample()}
              disabled={loadingSample}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors whitespace-nowrap"
            >
              <Sparkles className="w-4 h-4" />
              {loadingSample ? 'Loading Sample...' : 'Load 12 Sample Employees'}
            </button>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 px-6 text-center">
          <p className="text-sm font-medium text-slate-700">
            No employees match the current filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setStatusFilter('all');
              setDeptFilter('all');
              setSearchQuery('');
            }}
            className="mt-3 text-xs font-semibold text-emerald-800 hover:underline"
          >
            Reset filters
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 whitespace-nowrap">Employee No.</th>
                <th className="py-3 px-4 whitespace-nowrap">Full Name</th>
                <th className="py-3 px-4 whitespace-nowrap">Department</th>
                <th className="py-3 px-4 whitespace-nowrap">Status</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">Quantity</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">Check-In Time</th>
                <th className="py-3 px-4 whitespace-nowrap text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((emp) => {
                const isPresent = emp.status === 'present';
                const isBusy = busyId === emp.id;
                return (
                  <tr
                    key={emp.id}
                    className="hover:bg-slate-50/80 transition-colors"
                  >
                    <td className="py-2.5 px-4 font-mono text-xs font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                      {emp.employeeNo}
                    </td>
                    <td className="py-2.5 px-4 font-medium text-slate-900 whitespace-nowrap">
                      {emp.fullName}
                    </td>
                    <td className="py-2.5 px-4 text-slate-600 text-xs whitespace-nowrap">
                      {emp.department || 'General'}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                          isPresent ? 'text-emerald-700' : 'text-red-700'
                        }`}
                      >
                        {isPresent ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                            Present
                          </>
                        ) : (
                          <>
                            <Clock className="w-3.5 h-3.5 shrink-0" />
                            Absent
                          </>
                        )}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap text-right">
                      <div className="inline-flex items-center border border-slate-200 rounded-md bg-white">
                        <button
                          type="button"
                          disabled={isBusy || emp.quantity <= 1}
                          onClick={() => void handleStepQty(emp, -1)}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          aria-label={`Decrease quantity for ${emp.fullName}`}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 text-xs font-mono font-semibold text-slate-900 tabular-nums">
                          {emp.quantity}
                        </span>
                        <button
                          type="button"
                          disabled={isBusy || emp.quantity >= 50}
                          onClick={() => void handleStepQty(emp, 1)}
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                          aria-label={`Increase quantity for ${emp.fullName}`}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-500 tabular-nums text-right whitespace-nowrap">
                      {formatTimeShort(emp.checkedInAt)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void handleRowStatusToggle(emp)}
                          className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                            isPresent
                              ? 'text-slate-700 bg-slate-100 hover:bg-slate-200'
                              : 'text-white bg-emerald-900 hover:bg-emerald-950'
                          }`}
                        >
                          {isPresent ? 'Mark Absent' : 'Check In'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onEditAttendee(emp)}
                          className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors"
                          title="Edit employee"
                          aria-label={`Edit ${emp.fullName}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void onDeleteAttendee(emp)}
                          className="p-1.5 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                          title="Remove employee"
                          aria-label={`Remove ${emp.fullName}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
