import React, { useMemo, useState } from 'react';
import { Upload, X } from 'lucide-react';
import {
  clampQuantity,
  normalizeEmployeeNo,
  VALIDATION,
} from '../types/event';

export interface ParsedRosterRow {
  employeeNo: string;
  fullName: string;
  department: string;
  quantity: number;
}

interface ImportRosterModalProps {
  open: boolean;
  onClose: () => void;
  onImportRows: (rows: ParsedRosterRow[]) => Promise<void>;
}

const EXAMPLE_CSV = `EMP-2001,Angela Villanueva,Marketing,1
EMP-2002,Brandon Lim,Engineering,2
EMP-2003,Clarisse Bautista,Finance,1`;

function parseCsvLines(text: string): ParsedRosterRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const parsed: ParsedRosterRow[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const delimiter = line.includes('\t') ? '\t' : ',';
    const parts = line
      .split(delimiter)
      .map((cell) => cell.replace(/^"|"$/g, '').trim());

    if (parts.length < 2) continue;

    // Skip header row if detected
    const firstLower = parts[0].toLowerCase();
    if (
      i === 0 &&
      (firstLower.includes('employee') ||
        firstLower === 'empno' ||
        firstLower === 'id')
    ) {
      continue;
    }

    const empNo = normalizeEmployeeNo(parts[0]).slice(0, VALIDATION.EMP_NO_MAX);
    const fullName = parts[1].slice(0, VALIDATION.FULL_NAME_MAX);
    if (!empNo || !fullName || !VALIDATION.EMP_NO_REGEX.test(empNo)) continue;
    if (seen.has(empNo)) continue;
    seen.add(empNo);

    const department =
      (parts[2] ?? '').slice(0, VALIDATION.DEPARTMENT_MAX) || 'General';
    const qtyNum = Number(parts[3] ?? '1');
    const quantity = clampQuantity(Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 1);

    parsed.push({ employeeNo: empNo, fullName, department, quantity });
  }

  return parsed;
}

export function ImportRosterModal({
  open,
  onClose,
  onImportRows,
}: ImportRosterModalProps) {
  const [rawText, setRawText] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewRows = useMemo(() => parseCsvLines(rawText), [rawText]);

  if (!open) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawText(reader.result);
      }
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (previewRows.length === 0) {
      setError('No valid employee rows found. Check your formatting.');
      return;
    }
    setImporting(true);
    setError(null);
    try {
      await onImportRows(previewRows);
      setRawText('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import roster.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 id="import-modal-title" className="text-base font-semibold text-slate-900">
            Import Employee Roster (CSV or Spreadsheet Paste)
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

        <div className="p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-slate-600">
              Columns: <span className="font-mono">Employee No, Full Name, Department, Quantity</span>
            </p>
            <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors">
              <Upload className="w-3.5 h-3.5" />
              Upload .csv File
              <input
                type="file"
                accept=".csv,.txt"
                onChange={handleFileChange}
                className="sr-only"
              />
            </label>
          </div>

          <textarea
            rows={6}
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={EXAMPLE_CSV}
            className="w-full p-3 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-800"
          />

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {previewRows.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-700 tabular-nums">
                Ready to import {previewRows.length} employees
              </div>
              <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 text-xs">
                {previewRows.slice(0, 20).map((row) => (
                  <div
                    key={row.employeeNo}
                    className="px-3 py-2 flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono font-semibold text-slate-900">
                        {row.employeeNo}
                      </span>
                      <span className="text-slate-800 truncate">{row.fullName}</span>
                      <span className="text-slate-500 truncate">{row.department}</span>
                    </div>
                    <span className="font-mono font-semibold text-slate-700 tabular-nums shrink-0">
                      Qty {row.quantity}
                    </span>
                  </div>
                ))}
                {previewRows.length > 20 && (
                  <div className="px-3 py-2 text-slate-500">
                    +{previewRows.length - 20} more rows...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={importing || previewRows.length === 0}
            onClick={() => void handleImport()}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-950 disabled:opacity-40 rounded-lg transition-colors"
          >
            {importing
              ? 'Importing...'
              : `Import ${previewRows.length} Employees`}
          </button>
        </div>
      </div>
    </div>
  );
}
