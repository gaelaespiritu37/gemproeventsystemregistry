import type { Timestamp } from 'firebase/firestore';

export type AttendeeStatus = 'present' | 'absent';

export interface PartyEvent {
  id: string;
  title: string;
  eventDate: string;
  venue: string;
  ownerId: string;
  kioskCode: string;
  kioskEnabled: boolean;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PublicEventHeader {
  id: string;
  title: string;
  eventDate: string;
  venue: string;
  ownerId: string;
  kioskEnabled: boolean;
}

export interface Attendee {
  id: string;
  eventId: string;
  ownerId: string;
  employeeNo: string;
  fullName: string;
  department: string;
  status: AttendeeStatus;
  quantity: number;
  checkedInAt: Timestamp | null;
  createdAt?: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface SelfCheckInReceipt {
  id: string;
  eventId: string;
  ownerId: string;
  kioskCode: string;
  employeeNo: string;
  fullName: string;
  department: string;
  quantity: number;
  createdAt?: Timestamp | null;
}

export interface CheckInFeedback {
  id: string;
  outcome: 'checked_in' | 'already_present' | 'error';
  employeeNo: string;
  fullName?: string;
  department?: string;
  quantity?: number;
  message: string;
  timestamp: Date;
}

// Validation constants synchronized with firebase-blueprint.json & firestore.rules
export const VALIDATION = {
  TITLE_MAX: 120,
  DATE_MAX: 40,
  VENUE_MAX: 120,
  EMP_NO_MAX: 40,
  FULL_NAME_MAX: 100,
  DEPARTMENT_MAX: 80,
  QUANTITY_MIN: 1,
  QUANTITY_MAX: 50,
  EMP_NO_REGEX: /^[a-zA-Z0-9_\-.]+$/,
  DOC_ID_REGEX: /^[a-zA-Z0-9_\-]+$/,
} as const;

export function sanitizeEmployeeDocId(employeeNo: string): string {
  return employeeNo
    .trim()
    .toUpperCase()
    .replace(/[^a-zA-Z0-9_\-]/g, '_')
    .slice(0, 128);
}

export function normalizeEmployeeNo(raw: string): string {
  return raw.trim().toUpperCase();
}

export function generateKioskCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let partA = '';
  let partB = '';
  for (let i = 0; i < 4; i += 1) {
    partA += chars[Math.floor(Math.random() * chars.length)];
    partB += chars[Math.floor(Math.random() * chars.length)];
  }
  return `XMAS-${partA}-${partB}`;
}

export function buildEventCheckInUrl(eventId: string, kioskCode: string): string {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.origin);
  url.searchParams.set('checkin', eventId);
  url.searchParams.set('code', kioskCode);
  return url.toString();
}

export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(
    VALIDATION.QUANTITY_MIN,
    Math.min(VALIDATION.QUANTITY_MAX, Math.round(value))
  );
}

export function formatTimeShort(ts: Timestamp | null | undefined): string {
  if (!ts || typeof ts.toDate !== 'function') return '—';
  return ts.toDate().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
