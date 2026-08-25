/**
 * "You sent a WhatsApp lead — did it get booked?" (spec S3b)
 *
 * The site hands a visitor to WhatsApp and then goes blind. Whatever was
 * agreed happened somewhere we cannot see, so from that moment the calendar
 * is guesswork: the slot still shows as free, someone else requests it, and
 * the owner has two customers for one hour. No amount of clever availability
 * logic fixes a calendar that is missing the bookings.
 *
 * One question closes that loop, and it is only worth asking because the
 * answer is cheap. **No is a single tap and nothing else happens.** Yes needs
 * a date and a time, because there is genuinely no way for us to know when
 * the appointment is — inventing one would put a wrong entry on a working
 * calendar, which is worse than the gap it was meant to fill.
 *
 * Renders nothing when there is nothing to ask about. A prompt that is always
 * on screen stops being read.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { MessageCircle, Check, X, Loader2 } from 'lucide-react';
import { API } from '../../App';
import formatDate from '../../utils/formatDate';

// Next round hour, in the provider's own local time — which is the same
// timezone the slot strings are written in. A default nobody has to fix in
// the common case beats an empty field.
function nextRoundHour() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return `${String(d.getHours()).padStart(2, '0')}:00`;
}

function todayIso() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export default function LeadOutcomePanel({ token }) {
  const { t } = useTranslation();
  const [leads, setLeads] = useState([]);
  const [openId, setOpenId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [when, setWhen] = useState({ date: todayIso(), time: nextRoundHour() });

  const load = useCallback(async () => {
    try {
      const { data } = await axios.get(`${API}/marketplace/leads/awaiting-answer`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLeads(Array.isArray(data) ? data : []);
    } catch {
      // Silent. This is a helpful extra on a working dashboard; an error
      // banner here would be louder than the thing it replaces.
      setLeads([]);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const answer = async (lead, booked) => {
    setBusyId(lead.id);
    try {
      await axios.post(
        `${API}/marketplace/leads/${lead.id}/answer`,
        booked
          ? { booked: true, date: when.date, time_slot: when.time,
              duration_minutes: lead.default_duration }
          : { booked: false },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      // Drop it locally rather than refetching: the row disappearing the
      // instant it is tapped is the whole feel of a one-tap control.
      setLeads((prev) => prev.filter((l) => l.id !== lead.id));
      setOpenId(null);
      toast.success(booked
        ? t('leadOutcome.savedYes', 'Added to your calendar.')
        : t('leadOutcome.savedNo', 'Thanks — noted.'));
    } catch (err) {
      const detail = err.response?.data?.detail;
      toast.error(detail || t('leadOutcome.failed', 'Could not save that — try again.'));
    } finally {
      setBusyId(null);
    }
  };

  if (!leads.length) return null;

  return (
    <div
      className="bg-white border rounded-2xl p-5"
      style={{ borderColor: 'var(--brand-border)' }}
      data-testid="lead-outcome-panel"
    >
      <h3 className="text-sm font-bold mb-1" style={{ color: 'var(--ink)' }}>
        {t('leadOutcome.title', 'Did these get booked?')}
      </h3>
      <p className="text-xs mb-4" style={{ color: 'var(--brand-muted)' }}>
        {t('leadOutcome.why',
          'Answering keeps your calendar honest, so nobody books a time you have already given away.')}
      </p>

      <ul className="space-y-3">
        {leads.map((lead) => {
          const open = openId === lead.id;
          const busy = busyId === lead.id;
          return (
            <li
              key={lead.id}
              className="rounded-xl border p-3"
              style={{ borderColor: 'var(--brand-border)' }}
              data-testid={`lead-outcome-${lead.id}`}
            >
              <div className="flex items-start gap-2.5 flex-wrap">
                <MessageCircle size={16} className="shrink-0 mt-0.5" style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
                    {lead.gig_title || t('leadOutcome.aListing', 'One of your listings')}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                    {t('leadOutcome.sentOn', {
                      defaultValue: 'WhatsApp enquiry on {{date}}',
                      date: formatDate(lead.created_at),
                    })}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : lead.id)}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-full text-sm font-semibold border transition-colors disabled:opacity-50"
                    style={{
                      borderColor: 'var(--brand-primary)',
                      color: open ? '#FFFFFF' : 'var(--brand-primary)',
                      backgroundColor: open ? 'var(--brand-primary)' : '#FFFFFF',
                    }}
                    data-testid={`lead-yes-${lead.id}`}
                  >
                    {t('leadOutcome.yes', 'Yes')}
                  </button>
                  {/* The one-tap half. Nothing is created, nothing is asked. */}
                  <button
                    type="button"
                    onClick={() => answer(lead, false)}
                    disabled={busy}
                    className="px-3 py-1.5 rounded-full text-sm font-medium border transition-colors disabled:opacity-50"
                    style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-muted)' }}
                    data-testid={`lead-no-${lead.id}`}
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : t('leadOutcome.no', 'No')}
                  </button>
                </div>
              </div>

              {open && (
                <div className="mt-3 pt-3 border-t flex items-end gap-2 flex-wrap"
                     style={{ borderColor: 'var(--brand-border)' }}>
                  {/* Pre-filled with today and the next round hour: most of
                      these are answered the morning after, about a job that
                      is imminent. */}
                  <label className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                    <span className="block mb-1">{t('leadOutcome.date', 'Date')}</span>
                    <input
                      type="date"
                      value={when.date}
                      onChange={(e) => setWhen((w) => ({ ...w, date: e.target.value }))}
                      className="px-2 py-1.5 rounded-lg border text-sm"
                      style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
                      data-testid={`lead-date-${lead.id}`}
                    />
                  </label>
                  <label className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                    <span className="block mb-1">{t('leadOutcome.time', 'Time')}</span>
                    <input
                      type="time"
                      value={when.time}
                      onChange={(e) => setWhen((w) => ({ ...w, time: e.target.value }))}
                      className="px-2 py-1.5 rounded-lg border text-sm"
                      style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
                      data-testid={`lead-time-${lead.id}`}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => answer(lead, true)}
                    disabled={busy || !when.date || !when.time}
                    className="px-3 py-2 rounded-full text-sm font-semibold text-white inline-flex items-center gap-1.5 disabled:opacity-50"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                    data-testid={`lead-confirm-${lead.id}`}
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {t('leadOutcome.block', 'Block this time')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenId(null)}
                    className="p-2 rounded-full"
                    aria-label={t('leadOutcome.cancel', 'Cancel')}
                    style={{ color: 'var(--brand-muted)' }}
                  >
                    <X size={14} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
