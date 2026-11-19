import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  Calendar,
  LogOut,
  MapPin,
  Plus,
  QrCode,
  Settings2,
} from 'lucide-react';
import {
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './firebase';
import {
  type Attendee,
  type AttendeeStatus,
  type CheckInFeedback,
  clampQuantity,
  generateKioskCode,
  normalizeEmployeeNo,
  type PartyEvent,
  sanitizeEmployeeDocId,
  type SelfCheckInReceipt,
  VALIDATION,
} from './types/event';
import { playSuccessChime } from './utils/sound';
import { SAMPLE_CHRISTMAS_ROSTER } from './utils/sampleRoster';
import { SingleEventQrPanel } from './components/SingleEventQrPanel';
import { RosterTable } from './components/RosterTable';
import { EventPosterView } from './components/EventPosterView';
import { SelfCheckInView } from './components/SelfCheckInView';
import { EmployeeFormModal } from './components/EmployeeFormModal';
import {
  ImportRosterModal,
  type ParsedRosterRow,
} from './components/ImportRosterModal';
import { EventSetupModal } from './components/EventSetupModal';

type WorkspaceTab = 'desk' | 'roster' | 'poster';

const HERO_BANNER_SRC =
  '/src/assets/images/christmas_gala_banner_1795066901636.jpg';

function getCheckInParams(): { eventId: string; code: string } | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('checkin')?.trim() ?? '';
  const code = params.get('code')?.trim() ?? '';
  if (eventId && code) {
    return { eventId, code };
  }
  return null;
}

export default function App() {
  const [qrParams] = useState<{ eventId: string; code: string } | null>(() =>
    getCheckInParams()
  );
  const [previewSelfForm, setPreviewSelfForm] = useState(false);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [bannerFailed, setBannerFailed] = useState(false);

  const [events, setEvents] = useState<PartyEvent[]>([]);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [activeEventId, setActiveEventId] = useState<string>('');
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [attendeesLoading, setAttendeesLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('desk');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Modals
  const [empModalOpen, setEmpModalOpen] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | null>(null);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [eventModalOpen, setEventModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<PartyEvent | null>(null);

  const autoCreatedRef = useRef(false);
  const backfilledEventsRef = useRef<Set<string>>(new Set());
  const processingCheckinsRef = useRef<Set<string>>(new Set());

  // Auth listener
  useEffect(() => {
    if (qrParams) return;
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthReady(true);
      if (!currentUser) {
        setEvents([]);
        setAttendees([]);
        setEventsLoaded(false);
        setActiveEventId('');
        autoCreatedRef.current = false;
      }
    });
    return unsub;
  }, [qrParams]);

  // Events subscription
  useEffect(() => {
    if (qrParams || !authReady || !user) return;

    const eventsPath = 'events';
    const q = query(
      collection(db, eventsPath),
      where('ownerId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: PartyEvent[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            title: String(data.title ?? ''),
            eventDate: String(data.eventDate ?? ''),
            venue: String(data.venue ?? ''),
            ownerId: String(data.ownerId ?? ''),
            kioskCode: String(data.kioskCode ?? ''),
            kioskEnabled:
              typeof data.kioskEnabled === 'boolean' ? data.kioskEnabled : true,
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        setEvents(list);
        setEventsLoaded(true);

        if (list.length > 0) {
          setActiveEventId((prev) =>
            prev && list.some((e) => e.id === prev) ? prev : list[0].id
          );
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, eventsPath);
      }
    );

    return unsub;
  }, [authReady, qrParams, user]);

  // Auto-create initial Christmas Party event if organizer has none yet
  useEffect(() => {
    if (qrParams || !authReady || !user || !eventsLoaded) return;
    if (events.length === 0 && !autoCreatedRef.current) {
      autoCreatedRef.current = true;
      const newRef = doc(collection(db, 'events'));
      const kioskCode = generateKioskCode();
      const title = 'Annual Christmas Party 2026';
      const eventDate = '2026-12-18';
      const venue = 'Grand Ballroom';

      void (async () => {
        try {
          await setDoc(newRef, {
            title,
            eventDate,
            venue,
            ownerId: user.uid,
            kioskCode,
            kioskEnabled: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await setDoc(doc(db, 'publicEvents', newRef.id), {
            title,
            eventDate,
            venue,
            ownerId: user.uid,
            kioskEnabled: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `events/${newRef.id}`);
        }
      })();
    }
  }, [authReady, events.length, eventsLoaded, qrParams, user]);

  const activeEvent = useMemo(
    () => events.find((e) => e.id === activeEventId) ?? events[0] ?? null,
    [events, activeEventId]
  );

  // Backfill kioskCode & publicEvents header for existing events if missing
  useEffect(() => {
    if (qrParams || !authReady || !user || !activeEvent) return;
    if (backfilledEventsRef.current.has(activeEvent.id)) return;
    if (!activeEvent.kioskCode) {
      backfilledEventsRef.current.add(activeEvent.id);
      const nextCode = generateKioskCode();
      void (async () => {
        try {
          await updateDoc(doc(db, 'events', activeEvent.id), {
            kioskCode: nextCode,
            kioskEnabled: true,
            updatedAt: serverTimestamp(),
          });
          await setDoc(doc(db, 'publicEvents', activeEvent.id), {
            title: activeEvent.title,
            eventDate: activeEvent.eventDate,
            venue: activeEvent.venue,
            ownerId: user.uid,
            kioskEnabled: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(
            err,
            OperationType.WRITE,
            `events/${activeEvent.id}`
          );
        }
      })();
    }
  }, [activeEvent, authReady, qrParams, user]);

  // Attendees subscription
  useEffect(() => {
    if (qrParams || !authReady || !user || !activeEvent) {
      setAttendees([]);
      setAttendeesLoading(false);
      return;
    }

    setAttendeesLoading(true);
    const colPath = `events/${activeEvent.id}/attendees`;
    const q = query(
      collection(db, colPath),
      where('ownerId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: Attendee[] = snapshot.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            eventId: String(data.eventId ?? activeEvent.id),
            ownerId: String(data.ownerId ?? user.uid),
            employeeNo: String(data.employeeNo ?? ''),
            fullName: String(data.fullName ?? ''),
            department: String(data.department ?? 'General'),
            status: data.status === 'present' ? 'present' : 'absent',
            quantity: clampQuantity(Number(data.quantity ?? 1)),
            checkedInAt: data.checkedInAt ?? null,
            createdAt: data.createdAt ?? null,
            updatedAt: data.updatedAt ?? null,
          };
        });
        setAttendees(list);
        setAttendeesLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, colPath);
      }
    );

    return unsub;
  }, [activeEvent, authReady, qrParams, user]);

  // Real-time selfCheckins queue processor (merges single-QR phone check-ins into attendees)
  useEffect(() => {
    if (qrParams || !authReady || !user || !activeEvent) return;

    const colPath = `events/${activeEvent.id}/selfCheckins`;
    const q = query(
      collection(db, colPath),
      where('ownerId', '==', user.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) return;
        snapshot.docs.forEach((docSnap) => {
          if (processingCheckinsRef.current.has(docSnap.id)) return;
          processingCheckinsRef.current.add(docSnap.id);

          const data = docSnap.data() as SelfCheckInReceipt;
          const empNo = normalizeEmployeeNo(String(data.employeeNo ?? '')).slice(
            0,
            VALIDATION.EMP_NO_MAX
          );
          const fullName = String(data.fullName ?? '').slice(
            0,
            VALIDATION.FULL_NAME_MAX
          );
          const department =
            String(data.department ?? 'General').slice(
              0,
              VALIDATION.DEPARTMENT_MAX
            ) || 'General';
          const quantity = clampQuantity(Number(data.quantity ?? 1));

          if (!empNo || !fullName) {
            void deleteDoc(doc(db, colPath, docSnap.id));
            return;
          }

          const attendeeDocId = sanitizeEmployeeDocId(empNo);
          const attendeeRef = doc(
            db,
            `events/${activeEvent.id}/attendees`,
            attendeeDocId
          );

          void (async () => {
            try {
              const existingMatch = attendees.find(
                (a) => a.id === attendeeDocId
              );
              if (existingMatch) {
                await updateDoc(attendeeRef, {
                  fullName,
                  department,
                  status: 'present',
                  quantity,
                  checkedInAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              } else {
                await setDoc(attendeeRef, {
                  eventId: activeEvent.id,
                  ownerId: user.uid,
                  employeeNo: empNo,
                  fullName,
                  department,
                  status: 'present',
                  quantity,
                  checkedInAt: serverTimestamp(),
                  createdAt: serverTimestamp(),
                  updatedAt: serverTimestamp(),
                });
              }
              await deleteDoc(doc(db, colPath, docSnap.id));
              playSuccessChime(soundEnabled);
            } catch (err) {
              processingCheckinsRef.current.delete(docSnap.id);
              handleFirestoreError(err, OperationType.WRITE, colPath);
            }
          })();
        });
      },
      (error) => {
        handleFirestoreError(error, OperationType.LIST, colPath);
      }
    );

    return unsub;
  }, [activeEvent, attendees, authReady, qrParams, soundEnabled, user]);

  // Computed live KPI summary
  const metrics = useMemo(() => {
    const totalEmployees = attendees.length;
    let presentEmployees = 0;
    let absentEmployees = 0;
    let presentQuantity = 0;
    let totalExpectedQuantity = 0;

    for (const a of attendees) {
      totalExpectedQuantity += a.quantity;
      if (a.status === 'present') {
        presentEmployees += 1;
        presentQuantity += a.quantity;
      } else {
        absentEmployees += 1;
      }
    }

    const turnoutPct =
      totalEmployees > 0
        ? Math.round((presentEmployees / totalEmployees) * 100)
        : 0;

    return {
      totalEmployees,
      presentEmployees,
      absentEmployees,
      presentQuantity,
      totalExpectedQuantity,
      turnoutPct,
    };
  }, [attendees]);

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Unable to sign in with Google.'
      );
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
  };

  // Direct desk check-in handler (Employee No., Full Name, Department, Quantity)
  const handleDirectCheckIn = useCallback(
    async (data: {
      employeeNo: string;
      fullName: string;
      department: string;
      quantity: number;
    }): Promise<CheckInFeedback> => {
      if (!user || !activeEvent) {
        return {
          id: `${Date.now()}`,
          outcome: 'error',
          employeeNo: data.employeeNo,
          message: 'No active event selected.',
          timestamp: new Date(),
        };
      }

      const empNo = normalizeEmployeeNo(data.employeeNo).slice(
        0,
        VALIDATION.EMP_NO_MAX
      );
      const docId = sanitizeEmployeeDocId(empNo);
      const docPath = `events/${activeEvent.id}/attendees/${docId}`;
      const existingMatch = attendees.find((a) => a.id === docId);
      const safeQty = clampQuantity(data.quantity);

      try {
        if (existingMatch) {
          await updateDoc(doc(db, docPath), {
            fullName: data.fullName,
            department: data.department,
            status: 'present',
            quantity: safeQty,
            checkedInAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } else {
          await setDoc(doc(db, docPath), {
            eventId: activeEvent.id,
            ownerId: user.uid,
            employeeNo: empNo,
            fullName: data.fullName,
            department: data.department,
            status: 'present',
            quantity: safeQty,
            checkedInAt: serverTimestamp(),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }

        playSuccessChime(soundEnabled);
        return {
          id: `${Date.now()}`,
          outcome: 'checked_in',
          employeeNo: empNo,
          fullName: data.fullName,
          department: data.department,
          quantity: safeQty,
          message: existingMatch
            ? 'Marked Present'
            : 'Registered & Marked Present',
          timestamp: new Date(),
        };
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, docPath);
      }
    },
    [activeEvent, attendees, soundEnabled, user]
  );

  const handleToggleKioskEnabled = useCallback(async () => {
    if (!activeEvent) return;
    const nextEnabled = !activeEvent.kioskEnabled;
    try {
      await updateDoc(doc(db, 'events', activeEvent.id), {
        kioskEnabled: nextEnabled,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(doc(db, 'publicEvents', activeEvent.id), {
        kioskEnabled: nextEnabled,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `events/${activeEvent.id}`
      );
    }
  }, [activeEvent]);

  const handleRotateKioskCode = useCallback(async () => {
    if (!activeEvent) return;
    const nextCode = generateKioskCode();
    try {
      await updateDoc(doc(db, 'events', activeEvent.id), {
        kioskCode: nextCode,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(
        err,
        OperationType.UPDATE,
        `events/${activeEvent.id}`
      );
    }
  }, [activeEvent]);

  const handleToggleStatus = useCallback(
    async (attendee: Attendee, nextStatus: AttendeeStatus) => {
      if (!activeEvent) return;
      const docPath = `events/${activeEvent.id}/attendees/${attendee.id}`;
      try {
        if (nextStatus === 'present') {
          await updateDoc(doc(db, docPath), {
            status: 'present',
            quantity: attendee.quantity,
            checkedInAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          playSuccessChime(soundEnabled);
        } else {
          await updateDoc(doc(db, docPath), {
            status: 'absent',
            checkedInAt: null,
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [activeEvent, soundEnabled]
  );

  const handleUpdateQuantity = useCallback(
    async (attendee: Attendee, nextQty: number) => {
      if (!activeEvent) return;
      const docPath = `events/${activeEvent.id}/attendees/${attendee.id}`;
      try {
        await updateDoc(doc(db, docPath), {
          quantity: clampQuantity(nextQty),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, docPath);
      }
    },
    [activeEvent]
  );

  const handleDeleteAttendee = useCallback(
    async (attendee: Attendee) => {
      if (!activeEvent) return;
      const docPath = `events/${activeEvent.id}/attendees/${attendee.id}`;
      try {
        await deleteDoc(doc(db, docPath));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, docPath);
      }
    },
    [activeEvent]
  );

  const handleSaveEmployee = useCallback(
    async (payload: {
      employeeNo: string;
      fullName: string;
      department: string;
      quantity: number;
      status: AttendeeStatus;
    }) => {
      if (!user || !activeEvent) return;

      if (editingAttendee) {
        const docPath = `events/${activeEvent.id}/attendees/${editingAttendee.id}`;
        try {
          const nextCheckedInAt =
            payload.status === 'present'
              ? editingAttendee.status === 'absent'
                ? serverTimestamp()
                : editingAttendee.checkedInAt ?? serverTimestamp()
              : null;

          await updateDoc(doc(db, docPath), {
            fullName: payload.fullName,
            department: payload.department,
            quantity: clampQuantity(payload.quantity),
            status: payload.status,
            checkedInAt: nextCheckedInAt,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, docPath);
        }
        return;
      }

      const docId = sanitizeEmployeeDocId(payload.employeeNo);
      const docPath = `events/${activeEvent.id}/attendees/${docId}`;
      try {
        await setDoc(doc(db, docPath), {
          eventId: activeEvent.id,
          ownerId: user.uid,
          employeeNo: payload.employeeNo,
          fullName: payload.fullName,
          department: payload.department,
          status: payload.status,
          quantity: clampQuantity(payload.quantity),
          checkedInAt: payload.status === 'present' ? serverTimestamp() : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, docPath);
      }
    },
    [activeEvent, editingAttendee, user]
  );

  const handleImportRows = useCallback(
    async (rows: ParsedRosterRow[]) => {
      if (!user || !activeEvent) return;
      const colPath = `events/${activeEvent.id}/attendees`;
      try {
        const chunkSize = 400;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const batch = writeBatch(db);
          const chunk = rows.slice(i, i + chunkSize);
          for (const row of chunk) {
            const docId = sanitizeEmployeeDocId(row.employeeNo);
            const ref = doc(db, colPath, docId);
            batch.set(ref, {
              eventId: activeEvent.id,
              ownerId: user.uid,
              employeeNo: row.employeeNo,
              fullName: row.fullName,
              department: row.department,
              status: 'absent',
              quantity: clampQuantity(row.quantity),
              checkedInAt: null,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          }
          await batch.commit();
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, colPath);
      }
    },
    [activeEvent, user]
  );

  const handleLoadSampleRoster = useCallback(async () => {
    await handleImportRows(SAMPLE_CHRISTMAS_ROSTER);
  }, [handleImportRows]);

  const handleSaveEvent = useCallback(
    async (payload: { title: string; eventDate: string; venue: string }) => {
      if (!user) return;
      if (editingEvent) {
        const docPath = `events/${editingEvent.id}`;
        try {
          await updateDoc(doc(db, docPath), {
            title: payload.title,
            eventDate: payload.eventDate,
            venue: payload.venue,
            updatedAt: serverTimestamp(),
          });
          await updateDoc(doc(db, 'publicEvents', editingEvent.id), {
            title: payload.title,
            eventDate: payload.eventDate,
            venue: payload.venue,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, docPath);
        }
      } else {
        const newRef = doc(collection(db, 'events'));
        const kioskCode = generateKioskCode();
        const docPath = `events/${newRef.id}`;
        try {
          await setDoc(newRef, {
            title: payload.title,
            eventDate: payload.eventDate,
            venue: payload.venue,
            ownerId: user.uid,
            kioskCode,
            kioskEnabled: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await setDoc(doc(db, 'publicEvents', newRef.id), {
            title: payload.title,
            eventDate: payload.eventDate,
            venue: payload.venue,
            ownerId: user.uid,
            kioskEnabled: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          setActiveEventId(newRef.id);
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, docPath);
        }
      }
    },
    [editingEvent, user]
  );

  // Employee self-registration route (opened when scanning the ONE Event QR code)
  if (qrParams) {
    return (
      <SelfCheckInView eventId={qrParams.eventId} kioskCode={qrParams.code} />
    );
  }

  // Organizer previewing the mobile self-registration form
  if (previewSelfForm && activeEvent) {
    return (
      <SelfCheckInView
        eventId={activeEvent.id}
        kioskCode={activeEvent.kioskCode}
        onExitPreview={() => setPreviewSelfForm(false)}
      />
    );
  }

  // Loading auth splash
  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-500">
          Loading registration desk...
        </div>
      </div>
    );
  }

  // Unauthenticated Welcome / Sign-In Screen
  if (!user) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
        <header className="w-full max-w-[1200px] mx-auto px-6 py-5 flex items-center justify-between gap-8 border-b border-slate-200">
          <span className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            NoelCheck
          </span>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <span className="whitespace-nowrap shrink-0">Single Event QR</span>
            <span className="whitespace-nowrap shrink-0">Present &amp; Absent</span>
            <span className="whitespace-nowrap shrink-0">Headcount Quantity</span>
          </nav>
          <button
            type="button"
            onClick={() => void handleSignIn()}
            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Sign In
          </button>
        </header>

        <main className="flex-1 flex items-center py-12 px-6">
          <div className="w-full max-w-[1200px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-semibold text-emerald-900 tracking-wide mb-3">
                Christmas Party Registration Desk
              </p>
              <h1 className="font-display text-4xl sm:text-5xl font-semibold text-slate-900 tracking-tight leading-[1.1] max-w-xl [text-wrap:balance]">
                One QR code for 400 employees.
              </h1>
              <p className="mt-5 text-base text-slate-600 leading-relaxed max-w-lg">
                Display one shared Event QR code at your Christmas party entrance. Employees scan it on their phone and register directly with their Employee No., Full Name, and Department—updating Present, Absent, and Quantity totals in real time.
              </p>

              {authError && (
                <div className="mt-5 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 max-w-md">
                  {authError}
                </div>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={() => void handleSignIn()}
                  className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-emerald-900 hover:bg-emerald-950 rounded-lg transition-colors whitespace-nowrap"
                >
                  <QrCode className="w-4 h-4" />
                  Sign in with Google to Open Desk
                </button>
              </div>

              <div className="mt-10 pt-6 border-t border-slate-200 grid grid-cols-3 gap-6 max-w-lg">
                <div>
                  <div className="text-lg font-mono font-semibold text-slate-900 tabular-nums">
                    1 QR Code
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    For all employees
                  </div>
                </div>
                <div>
                  <div className="text-lg font-mono font-semibold text-slate-900 tabular-nums">
                    Present / Absent
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Live roster status
                  </div>
                </div>
                <div>
                  <div className="text-lg font-mono font-semibold text-slate-900 tabular-nums">
                    1–50 Qty
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Per-employee count
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-full min-h-[320px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-900">
                {!bannerFailed ? (
                  <img
                    src={HERO_BANNER_SRC}
                    alt="Winter pine branches and brass ornaments on slate stone for Christmas party registration"
                    referrerPolicy="no-referrer"
                    onError={() => setBannerFailed(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-10 text-center bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900">
                    <QrCode className="w-12 h-12 text-amber-400/80 mb-4" />
                    <p className="font-display text-2xl text-white">
                      NoelCheck Gala Desk
                    </p>
                    <p className="text-xs text-slate-300 mt-2">
                      Single-QR Employee Registration
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="no-print bg-white border-b border-slate-200">
        <div className="max-w-[1280px] mx-auto px-6 py-4 flex items-center justify-between gap-8">
          <span className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            NoelCheck
          </span>

          <nav
            aria-label="Primary sections"
            className="flex items-center gap-6 text-sm font-medium overflow-x-auto"
          >
            <button
              type="button"
              onClick={() => setActiveTab('desk')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'desk'
                  ? 'border-emerald-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Event QR &amp; Desk
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('roster')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'roster'
                  ? 'border-emerald-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              Roster &amp; Attendance
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('poster')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'poster'
                  ? 'border-emerald-900 text-slate-900 font-semibold'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              QR Poster
            </button>
          </nav>

          <button
            type="button"
            onClick={() => {
              setEditingAttendee(null);
              setEmpModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-900 hover:bg-emerald-950 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Employee
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-[1280px] w-full mx-auto px-6 py-7 space-y-6">
        {/* Workspace Event Header Toolbar */}
        <section className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
              {activeEvent?.title ?? 'Annual Christmas Party 2026'}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {activeEvent?.eventDate ?? '2026-12-18'}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                {activeEvent?.venue ?? 'Grand Ballroom'}
              </span>
              <span aria-hidden="true">·</span>
              <span>Organizer: {user.email}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {events.length > 1 && (
              <select
                value={activeEvent?.id ?? ''}
                onChange={(e) => setActiveEventId(e.target.value)}
                aria-label="Select active event"
                className="px-3 py-2 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-700"
              >
                {events.map((evt) => (
                  <option key={evt.id} value={evt.id}>
                    {evt.title}
                  </option>
                ))}
              </select>
            )}
            {activeEvent && (
              <button
                type="button"
                onClick={() => {
                  setEditingEvent(activeEvent);
                  setEventModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
              >
                <Settings2 className="w-3.5 h-3.5" />
                Event Details
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setEditingEvent(null);
                setEventModalOpen(true);
              }}
              className="px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              New Event
            </button>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </section>

        {/* Full-Width 4-Column KPI Strip */}
        <section
          aria-label="Attendance and quantity summary"
          className="no-print grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
            <div className="text-xs font-medium text-slate-500">
              Total Employees
            </div>
            <div className="mt-1.5 text-2xl font-mono font-semibold text-slate-900 tabular-nums">
              {metrics.totalEmployees}
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">
              Expected Qty: {metrics.totalExpectedQuantity}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
            <div className="text-xs font-medium text-emerald-800">
              Present
            </div>
            <div className="mt-1.5 text-2xl font-mono font-semibold text-emerald-800 tabular-nums">
              {metrics.presentEmployees}
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">
              {metrics.turnoutPct}% checked in
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
            <div className="text-xs font-medium text-red-700">
              Absent
            </div>
            <div className="mt-1.5 text-2xl font-mono font-semibold text-red-700 tabular-nums">
              {metrics.absentEmployees}
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">
              Pending arrival
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl px-5 py-4">
            <div className="text-xs font-medium text-slate-500">
              Present Quantity
            </div>
            <div className="mt-1.5 text-2xl font-mono font-semibold text-slate-900 tabular-nums">
              {metrics.presentQuantity}
            </div>
            <div className="mt-1 text-xs text-slate-500 tabular-nums">
              of {metrics.totalExpectedQuantity} total passes
            </div>
          </div>
        </section>

        {/* Active Workspace View */}
        {activeTab === 'desk' && activeEvent && (
          <>
            {!attendeesLoading && attendees.length === 0 && (
              <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Optional: Pre-load your employee roster to track who is still Absent
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Employees can scan the single QR code right away, or you can import your 400-employee CSV list first.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleLoadSampleRoster()}
                    className="px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-50 border border-amber-200 hover:bg-amber-100 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Load 12 Sample Employees
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportModalOpen(true)}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
                  >
                    Import CSV
                  </button>
                </div>
              </div>
            )}

            <SingleEventQrPanel
              event={activeEvent}
              attendees={attendees}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled((s) => !s)}
              onDirectCheckIn={handleDirectCheckIn}
              onUndoCheckIn={(emp) => handleToggleStatus(emp, 'absent')}
              onToggleKioskEnabled={handleToggleKioskEnabled}
              onRotateKioskCode={handleRotateKioskCode}
              onOpenPosterTab={() => setActiveTab('poster')}
              onPreviewSelfForm={() => setPreviewSelfForm(true)}
            />
          </>
        )}

        {activeTab === 'roster' && (
          <RosterTable
            attendees={attendees}
            loading={attendeesLoading}
            onToggleStatus={handleToggleStatus}
            onUpdateQuantity={handleUpdateQuantity}
            onEditAttendee={(emp) => {
              setEditingAttendee(emp);
              setEmpModalOpen(true);
            }}
            onDeleteAttendee={handleDeleteAttendee}
            onOpenImportModal={() => setImportModalOpen(true)}
            onOpenAddModal={() => {
              setEditingAttendee(null);
              setEmpModalOpen(true);
            }}
            onLoadSampleRoster={handleLoadSampleRoster}
            eventTitle={activeEvent?.title ?? 'Christmas Party'}
          />
        )}

        {activeTab === 'poster' && activeEvent && (
          <EventPosterView event={activeEvent} />
        )}
      </main>

      {/* Modals */}
      <EmployeeFormModal
        open={empModalOpen}
        editingAttendee={editingAttendee}
        onClose={() => {
          setEmpModalOpen(false);
          setEditingAttendee(null);
        }}
        onSave={handleSaveEmployee}
      />

      <ImportRosterModal
        open={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImportRows={handleImportRows}
      />

      <EventSetupModal
        open={eventModalOpen}
        editingEvent={editingEvent}
        onClose={() => {
          setEventModalOpen(false);
          setEditingEvent(null);
        }}
        onSave={handleSaveEvent}
      />
    </div>
  );
}
