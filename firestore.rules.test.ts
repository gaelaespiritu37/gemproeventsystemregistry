/**
 * Payload-First Security Test Suite for NoelCheck Firestore Rules.
 * Verifies that all "Dirty Dozen" adversarial payloads are rejected with PERMISSION_DENIED.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  operation: 'create' | 'update' | 'get' | 'list';
  path: string;
  payload?: Record<string, unknown>;
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Event Create',
    operation: 'create',
    path: '/events/evt_spoof',
    payload: {
      title: 'Holiday Gala',
      eventDate: '2026-12-18',
      venue: 'Grand Ballroom',
      ownerId: 'victim_uid',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 2,
    name: 'Unverified Email Write',
    operation: 'create',
    path: '/events/evt_unverified',
    payload: {
      title: 'Holiday Gala',
      eventDate: '2026-12-18',
      venue: 'Grand Ballroom',
      ownerId: 'unverified_uid',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 3,
    name: 'Ghost Field Shadow Write',
    operation: 'create',
    path: '/events/evt_shadow',
    payload: {
      title: 'Holiday Gala',
      eventDate: '2026-12-18',
      venue: 'Grand Ballroom',
      ownerId: 'attacker_uid',
      isAdmin: true,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 4,
    name: 'Orphaned Attendee Create',
    operation: 'create',
    path: '/events/missing_event/attendees/EMP_001',
    payload: {
      eventId: 'missing_event',
      ownerId: 'attacker_uid',
      employeeNo: 'EMP-001',
      fullName: 'Orphan User',
      department: 'Ops',
      status: 'absent',
      quantity: 1,
      checkedInAt: null,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 5,
    name: 'Cross-Tenant Attendee Injection',
    operation: 'create',
    path: '/events/victim_event/attendees/EMP_002',
    payload: {
      eventId: 'victim_event',
      ownerId: 'attacker_uid',
      employeeNo: 'EMP-002',
      fullName: 'Injected User',
      department: 'Ops',
      status: 'present',
      quantity: 1,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 6,
    name: 'Resource Poisoning Oversized ID',
    operation: 'create',
    path: `/events/${'a'.repeat(150)}`,
    payload: {
      title: 'Oversized Event',
      eventDate: '2026-12-18',
      venue: 'Hall',
      ownerId: 'attacker_uid',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 7,
    name: 'Client-Spoofed Timestamp',
    operation: 'create',
    path: '/events/evt_time_spoof',
    payload: {
      title: 'Backdated Event',
      eventDate: '2026-12-18',
      venue: 'Hall',
      ownerId: 'attacker_uid',
      createdAt: '2020-01-01T00:00:00Z',
      updatedAt: '2020-01-01T00:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 8,
    name: 'Quantity Boundary Violation',
    operation: 'create',
    path: '/events/evt_1/attendees/EMP_003',
    payload: {
      eventId: 'evt_1',
      ownerId: 'owner_uid',
      employeeNo: 'EMP-003',
      fullName: 'Bad Quantity',
      department: 'Finance',
      status: 'present',
      quantity: 500,
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 9,
    name: 'Immutable Field Tampering',
    operation: 'update',
    path: '/events/evt_1/attendees/EMP_001',
    payload: {
      employeeNo: 'EMP-999',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 10,
    name: 'Status-Timestamp Desync',
    operation: 'update',
    path: '/events/evt_1/attendees/EMP_001',
    payload: {
      status: 'absent',
      checkedInAt: '2026-12-18T18:00:00Z',
    },
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 11,
    name: 'Blanket List Query Scraping',
    operation: 'list',
    path: '/events',
    expected: 'PERMISSION_DENIED',
  },
  {
    id: 12,
    name: 'Value Poisoning on Allowed Key',
    operation: 'update',
    path: '/events/evt_1/attendees/EMP_001',
    payload: {
      fullName: '',
    },
    expected: 'PERMISSION_DENIED',
  },
];
