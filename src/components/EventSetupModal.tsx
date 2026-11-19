import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { type PartyEvent, VALIDATION } from '../types/event';

interface EventSetupModalProps {
  open: boolean;
  editingEvent: PartyEvent | null;
  onClose: () => void;
  onSave: (payload: {
    title: string;
    eventDate: string;
    venue: string;
  }) => Promise<void>;
}

export function EventSetupModal({
  open,
  editingEvent,
  onClose,
  onSave,
}: EventSetupModalProps) {
  const [title, setTitle] = useState('Annual Christmas Party 2026');
  const [eventDate, setEventDate] = useState('2026-12-18');
  const [venue, setVenue] = useState('Grand Ballroom');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (editingEvent) {
      setTitle(editingEvent.title);
      setEventDate(editingEvent.eventDate);
      setVenue(editingEvent.venue);
    } else {
      setTitle('Annual Christmas Party 2026');
      setEventDate('2026-12-18');
      setVenue('Grand Ballroom');
    }
  }, [editingEvent, open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !eventDate.trim() || !venue.trim()) {
      setError('Please complete all event details.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        title: title.trim().slice(0, VALIDATION.TITLE_MAX),
        eventDate: eventDate.trim().slice(0, VALIDATION.DATE_MAX),
        venue: venue.trim().slice(0, VALIDATION.VENUE_MAX),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save event.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="event-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 id="event-modal-title" className="text-base font-semibold text-slate-900">
            {editingEvent ? 'Edit Event Settings' : 'Create Christmas Party Event'}
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
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="event-title-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Event Title
            </label>
            <input
              id="event-title-input"
              type="text"
              required
              maxLength={VALIDATION.TITLE_MAX}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800"
            />
          </div>

          <div>
            <label
              htmlFor="event-date-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Event Date
            </label>
            <input
              id="event-date-input"
              type="text"
              required
              maxLength={VALIDATION.DATE_MAX}
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              placeholder="2026-12-18"
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800"
            />
          </div>

          <div>
            <label
              htmlFor="event-venue-input"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Venue
            </label>
            <input
              id="event-venue-input"
              type="text"
              required
              maxLength={VALIDATION.VENUE_MAX}
              value={venue}
              onChange={(e) => setVenue(e.target.value)}
              className="w-full px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-800"
            />
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
              {saving ? 'Saving...' : editingEvent ? 'Save Settings' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
