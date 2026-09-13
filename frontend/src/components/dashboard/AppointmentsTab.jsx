/**
 * AppointmentsTab — the read/respond half of in-platform gig bookings.
 *
 * `POST /marketplace/gigs/{id}/book` shipped wired end to end from
 * GigDetail, and `PATCH /marketplace/bookings/{id}` — accept, decline,
 * complete, cancel — shipped with no caller at all. So a buyer could ask
 * a business for a slot and the business had no screen that showed the
 * request, let alone answered it (dead-ends audit 2026-09-08, #4).
 *
 * Both sides live in one tab because they are one conversation:
 *
 *   Requests to you  — provider side. Accept / Decline while it is
 *                      pending, Mark complete once it is accepted.
 *   Your requests    — buyer side, read-only, showing the status and
 *                      whatever the provider wrote back.
 *
 * A person can be on both sides at once (CLAUDE.md: roles are not
 * exclusive here — a landlord can also be a plumber), so neither section
 * is gated on role. Each simply doesn't render when it is empty.
 *
 * `expired` is a status the server computes lazily from `hold_expires_at`
 * rather than a row somebody wrote — see `_live_hold_query` in gigs.py. It
 * has no actions on purpose: the slot is already back on the calendar.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Loader2, CalendarCheck, Calendar, Clock, Mail, Phone, User, ExternalLink,
  Check, X, CheckCheck, Timer,
} from 'lucide-react';

// Same palette vocabulary as MyJobsTab's StatusPill — green for the good
// outcome, brand blue for "done", grey for everything that ended without
// happening. Green stays functional-only per CLAUDE.md.
const PILL = {
  pending: 'bg-amber-50 text-amber-700 border-amber-100',
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  completed: 'bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 text-[var(--brand-primary)] border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20',
  declined: 'bg-gray-100 text-gray-600 border-gray-200',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200',
  expired: 'bg-gray-100 text-gray-600 border-gray-200',
};

const StatusPill = ({ status }) => {
  const { t } = useTranslation();
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border whitespace-nowrap ${PILL[status] || PILL.cancelled}`}
      data-testid={`appointment-status-${status}`}
    >
      {t(`appointments.status_${status}`, status)}
    </span>
  );
};

/** Whole hours left on a hold, or null once it has run out. Never a
 *  guess: `hold_expires_at` is frozen onto the booking at creation. */
const hoursLeft = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return null;
  return Math.max(1, Math.floor(ms / 3600000));
};

const BookingCard = ({ booking, side, API, token, onChanged, highlighted }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState('');

  const isProvider = side === 'provider';
  const left = booking.status === 'pending' ? hoursLeft(booking.hold_expires_at) : null;

  const patch = async (status) => {
    setBusy(true);
    try {
      await axios.patch(
        `${API}/marketplace/bookings/${booking.id}`,
        { status, reply: reply.trim() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success({
        accepted: t('appointments.toastAccepted', 'Accepted. The customer has been told.'),
        declined: t('appointments.toastDeclined', 'Declined, and the time is free again.'),
        completed: t('appointments.toastCompleted', 'Marked complete.'),
        cancelled: t('appointments.toastCancelled', 'Cancelled, and the time is free again.'),
      }[status] || t('appointments.toastUpdated', 'Updated'));
      onChanged?.();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('appointments.updateFailed', 'Could not update that booking'));
    } finally {
      setBusy(false);
    }
  };

  const when = [booking.preferred_date, booking.time_slot].filter(Boolean).join(' · ');

  return (
    <div
      id={`appointment-${booking.id}`}
      className={`bg-white border rounded-2xl shadow-sm p-4 sm:p-5 transition-colors ${
        highlighted ? 'border-[var(--brand-primary)] ring-2 ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20' : 'border-gray-100'
      }`}
      data-testid={`appointment-card-${booking.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-base font-bold text-gray-900 truncate" dir="auto">
              {booking.gig_title || t('appointments.untitled', 'Your listing')}
            </h3>
            <StatusPill status={booking.status} />
          </div>
          {booking.other_party && (
            <p className="text-sm text-gray-600 inline-flex items-center gap-1" dir="auto">
              <User size={12} aria-hidden="true" />
              {isProvider
                ? t('appointments.from', { defaultValue: 'From {{name}}', name: booking.other_party })
                : t('appointments.with', { defaultValue: 'With {{name}}', name: booking.other_party })}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-gray-600">
            {booking.tier_name && (
              <span className="inline-flex items-center gap-1" dir="auto">
                <CalendarCheck size={12} aria-hidden="true" /> {booking.tier_name}
              </span>
            )}
            {when && (
              <span className="inline-flex items-center gap-1">
                <Calendar size={12} aria-hidden="true" /> {when}
              </span>
            )}
            {booking.duration_minutes ? (
              <span className="inline-flex items-center gap-1">
                <Clock size={12} aria-hidden="true" />
                {t('appointments.minutes', { defaultValue: '{{n}} min', n: booking.duration_minutes })}
              </span>
            ) : null}
            {left !== null && (
              <span className="inline-flex items-center gap-1 text-amber-700" data-testid={`appointment-hold-${booking.id}`}>
                <Timer size={12} aria-hidden="true" />
                {t('appointments.holdLeft', { defaultValue: '{{n}}h left to answer', n: left })}
              </span>
            )}
          </div>
        </div>
        {booking.gig_id && (
          <button
            type="button"
            onClick={() => navigate(`/businesses/${booking.gig_id}`)}
            className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-gray-200 bg-white hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-colors"
            data-testid={`appointment-view-${booking.id}`}
          >
            <ExternalLink size={11} aria-hidden="true" /> {t('appointments.viewListing', 'View listing')}
          </button>
        )}
      </div>

      {booking.message && (
        <p className="mt-3 text-sm text-gray-800 whitespace-pre-line leading-relaxed" dir="auto" data-testid={`appointment-message-${booking.id}`}>
          {booking.message}
        </p>
      )}

      {/* Contact details are only returned to the provider — the person who
          typed them typed them for exactly one reader. */}
      {isProvider && (booking.contact_email || booking.contact_phone) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-600">
          {booking.contact_email && (
            <a href={`mailto:${booking.contact_email}`} className="inline-flex items-center gap-1 hover:text-[var(--brand-primary)]" dir="ltr">
              <Mail size={12} aria-hidden="true" /> {booking.contact_email}
            </a>
          )}
          {booking.contact_phone && (
            <a href={`tel:${booking.contact_phone}`} className="inline-flex items-center gap-1 hover:text-[var(--brand-primary)]" dir="ltr">
              <Phone size={12} aria-hidden="true" /> {booking.contact_phone}
            </a>
          )}
        </div>
      )}

      {booking.provider_reply && (
        <div className="mt-3 rounded-xl bg-gray-50 border border-gray-100 p-3">
          <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">
            {isProvider
              ? t('appointments.yourReply', 'Your note')
              : t('appointments.theirReply', 'Their reply')}
          </p>
          <p className="text-sm text-gray-800 whitespace-pre-line" dir="auto">{booking.provider_reply}</p>
        </div>
      )}

      {isProvider && ['pending', 'accepted'].includes(booking.status) && (
        <div className="mt-4 border-t border-gray-100 pt-3">
          <label className="sr-only" htmlFor={`appointment-reply-${booking.id}`}>
            {t('appointments.replyLabel', 'Note back to the customer')}
          </label>
          <textarea
            id={`appointment-reply-${booking.id}`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            dir="auto"
            placeholder={t('appointments.replyPh', 'Add a note back (optional) — when you can come, what you need from them…')}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm mb-2"
            data-testid={`appointment-reply-${booking.id}`}
          />
          <div className="flex flex-wrap gap-2">
            {booking.status === 'pending' && (
              <>
                <button
                  type="button"
                  onClick={() => patch('accepted')}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-60"
                  data-testid={`appointment-accept-${booking.id}`}
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} aria-hidden="true" />}
                  {t('appointments.accept', 'Accept')}
                </button>
                <button
                  type="button"
                  onClick={() => patch('declined')}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:border-red-300 hover:text-red-600 disabled:opacity-60"
                  data-testid={`appointment-decline-${booking.id}`}
                >
                  <X size={12} aria-hidden="true" /> {t('appointments.decline', 'Decline')}
                </button>
              </>
            )}
            {booking.status === 'accepted' && (
              <>
                <button
                  type="button"
                  onClick={() => patch('completed')}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white hover:opacity-90 disabled:opacity-60"
                  data-testid={`appointment-complete-${booking.id}`}
                >
                  {busy ? <Loader2 size={12} className="animate-spin" /> : <CheckCheck size={12} aria-hidden="true" />}
                  {t('appointments.complete', 'Mark complete')}
                </button>
                <button
                  type="button"
                  onClick={() => patch('cancelled')}
                  disabled={busy}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 bg-white hover:border-red-300 hover:text-red-600 disabled:opacity-60"
                  data-testid={`appointment-cancel-${booking.id}`}
                >
                  <X size={12} aria-hidden="true" /> {t('appointments.cancelBooking', 'Cancel')}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const AppointmentsTab = ({ API, token }) => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const [incoming, setIncoming] = useState([]);
  const [mine, setMine] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const h = { headers: { Authorization: `Bearer ${token}` } };
    const [p, c] = await Promise.all([
      axios.get(`${API}/marketplace/bookings?role=provider`, h).then((r) => r.data).catch(() => []),
      axios.get(`${API}/marketplace/bookings?role=client`, h).then((r) => r.data).catch(() => []),
    ]);
    setIncoming(Array.isArray(p) ? p : []);
    setMine(Array.isArray(c) ? c : []);
    setLoading(false);
  }, [API, token]);

  useEffect(() => { load(); }, [load]);

  // The notification deep-link names one booking. Scroll to it once the
  // rows exist — before that there is nothing with that id to find.
  useEffect(() => {
    if (loading || !highlightId) return;
    const el = document.getElementById(`appointment-${highlightId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [loading, highlightId, incoming, mine]);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-[var(--brand-primary)]" />
      </div>
    );
  }

  if (!incoming.length && !mine.length) {
    return (
      <div className="bg-white border border-gray-100 rounded-2xl p-8 text-center" data-testid="appointments-empty">
        <p className="text-gray-700 font-semibold mb-1">{t('appointments.empty', 'No booking requests yet.')}</p>
        <p className="text-sm text-gray-500">
          {t('appointments.emptyHint', 'When someone books one of your services on the site — or you book one — it shows up here.')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="appointments-tab">
      {incoming.length > 0 && (
        <section data-testid="appointments-incoming">
          <h2 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-head)' }}>
            {t('appointments.incomingTitle', 'Requests to you')}
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            {t('appointments.incomingLede', 'A pending request holds the time on your calendar until you answer it.')}
          </p>
          <div className="space-y-3">
            {incoming.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                side="provider"
                API={API}
                token={token}
                onChanged={load}
                highlighted={b.id === highlightId}
              />
            ))}
          </div>
        </section>
      )}

      {mine.length > 0 && (
        <section data-testid="appointments-mine">
          <h2 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'var(--font-head)' }}>
            {t('appointments.mineTitle', 'Your requests')}
          </h2>
          <p className="text-sm text-gray-600 mb-3">
            {t('appointments.mineLede', 'Services you asked to book, and what the business said.')}
          </p>
          <div className="space-y-3">
            {mine.map((b) => (
              <BookingCard
                key={b.id}
                booking={b}
                side="client"
                API={API}
                token={token}
                onChanged={load}
                highlighted={b.id === highlightId}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default AppointmentsTab;
