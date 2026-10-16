/**
 * Cancel or change an appointment from the customer's own status link
 * (backend routes/marketplace/appointment_reminders.py), which the reminder
 * email points to. No account: the link is the key.
 *
 * Change: pick a day and one of the listing's free times; the new time goes
 * to the business to accept, as a new request would. Times are built from
 * the listing's weekly hours in Israel time, minus what is taken, with this
 * booking's own time counted as free.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, CalendarClock, XCircle } from 'lucide-react';
import { API } from '../../lib/apiBase';

const KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const toMin = (s) => { const [h, m] = String(s || '').split(':').map(Number); return h * 60 + m; };
const hhmm = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

function ilNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, min: Number(p.hour) * 60 + Number(p.minute) };
}

export default function ChangeBooking({ token, data, onChanged }) {
  const { t, i18n } = useTranslation();
  const [mode, setMode] = useState(null);       // null | 'move' | 'cancel'
  const [taken, setTaken] = useState({});
  const [day, setDay] = useState('');
  const [time, setTime] = useState('');
  const [busy, setBusy] = useState(false);
  const base = `${API}/marketplace/bookings/track/${encodeURIComponent(token)}`;

  useEffect(() => {
    if (mode !== 'move' || !data.gig_id) return;
    axios.get(`${API}/marketplace/gigs/${data.gig_id}/taken-slots`).then(({ data: d }) => setTaken(d || {})).catch(() => setTaken({}));
  }, [mode, data.gig_id]);

  // The next 60 days that have at least one free time.
  const days = useMemo(() => {
    if (mode !== 'move') return [];
    const weekly = data.weekly_availability || {};
    const step = data.slot_minutes || 30;
    const dur = data.duration_minutes || step;
    const now = ilNow();
    const own = new Set();
    if (data.preferred_date && data.time_slot) {
      for (let m = Math.floor(toMin(data.time_slot) / step) * step; m < toMin(data.time_slot) + dur; m += step) own.add(`${data.preferred_date} ${hhmm(m)}`);
    }
    const out = [];
    const start = new Date(`${now.day}T12:00:00`);
    for (let i = 0; i < 60 && out.length < 21; i += 1) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const gone = new Set((taken[iso] || []).filter((s) => !own.has(`${iso} ${s}`)));
      const slots = [];
      (weekly[KEYS[d.getDay()]] || []).forEach((w) => {
        for (let m = toMin(w.start); m + dur <= toMin(w.end); m += step) {
          if (iso === now.day && m <= now.min) continue;
          const s = hhmm(m);
          // Every grid step the appointment would cover must be free.
          let free = true;
          for (let k = Math.floor(m / step) * step; k < m + dur; k += step) if (gone.has(hhmm(k))) free = false;
          if (free && !(iso === data.preferred_date && s === data.time_slot)) slots.push(s);
        }
      });
      if (slots.length) out.push({ iso, label: d.toLocaleDateString(i18n.language, { weekday: 'short', day: 'numeric', month: 'short' }), slots });
    }
    return out;
  }, [mode, data, taken, i18n.language]);

  useEffect(() => { if (days.length && !days.find((d) => d.iso === day)) { setDay(days[0].iso); setTime(''); } }, [days, day]);

  const act = async (path, body) => {
    setBusy(true);
    try {
      await axios.post(`${base}/${path}`, body);
      toast.success(path === 'cancel' ? t('bookingTrack.cancelledToast', 'Your appointment is cancelled') : t('bookingTrack.movedToast', 'Sent. The business will confirm the new time.'));
      setMode(null);
      onChanged();
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('bookingTrack.changeFailed', 'Could not change it. Try again.'));
      if (err?.response?.status === 409) axios.get(`${API}/marketplace/gigs/${data.gig_id}/taken-slots`).then(({ data: d }) => setTaken(d || {})).catch(() => {});
    } finally { setBusy(false); }
  };

  if (!data.can_change) return null;
  const btn = 'inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full border text-sm font-semibold';
  const current = days.find((d) => d.iso === day);
  return (
    <section className="mt-4 rounded-2xl border bg-white p-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="booking-change">
      {mode === null && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={btn} style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} onClick={() => setMode('move')} data-testid="booking-change-move">
            <CalendarClock size={15} /> {t('bookingTrack.changeTime', 'Change the time')}
          </button>
          <button type="button" className={btn} style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} onClick={() => setMode('cancel')} data-testid="booking-change-cancel">
            <XCircle size={15} /> {t('bookingTrack.cancel', 'Cancel')}
          </button>
        </div>
      )}
      {mode === 'cancel' && (
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('bookingTrack.cancelSure', 'Cancel this appointment?')}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>{t('bookingTrack.cancelNote', 'The business is told, and the time is freed for someone else.')}</p>
          <div className="flex gap-2 mt-3">
            <button type="button" disabled={busy} onClick={() => act('cancel')} className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60"
                    style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="booking-cancel-confirm">
              {busy && <Loader2 size={14} className="animate-spin" />} {t('bookingTrack.cancelYes', 'Yes, cancel it')}
            </button>
            <button type="button" onClick={() => setMode(null)} className="px-3 min-h-[44px] text-sm underline" style={{ color: 'var(--brand-muted)' }}>{t('bookingTrack.keepIt', 'Keep it')}</button>
          </div>
        </div>
      )}
      {mode === 'move' && (
        <div>
          <p className="text-sm font-semibold mb-2" style={{ color: 'var(--ink)' }}>{t('bookingTrack.pickNew', 'Pick a new time')}</p>
          {!days.length ? <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('bookingTrack.noTimes', 'No free times in the coming weeks. Message the business instead.')}</p> : (
            <>
              <div className="flex gap-1.5 overflow-x-auto pb-1" role="radiogroup" aria-label={t('bookingTrack.day', 'Day')}>
                {days.map((d) => (
                  <button key={d.iso} type="button" role="radio" aria-checked={day === d.iso} onClick={() => { setDay(d.iso); setTime(''); }}
                          className="shrink-0 px-3 min-h-[40px] rounded-full border text-xs font-semibold whitespace-nowrap"
                          style={day === d.iso ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : { borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>{d.label}</button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3" role="radiogroup" aria-label={t('bookingTrack.time', 'Time')} data-testid="booking-change-times">
                {(current?.slots || []).map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={time === s} onClick={() => setTime(s)} dir="ltr"
                          className="px-3 min-h-[40px] rounded-lg border text-sm tabular-nums"
                          style={time === s ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : { borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>{s}</button>
                ))}
              </div>
            </>
          )}
          <div className="flex gap-2 mt-3">
            <button type="button" disabled={busy || !time} onClick={() => act('move', { date: day, time })}
                    className="inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-50"
                    style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="booking-move-confirm">
              {busy && <Loader2 size={14} className="animate-spin" />} {t('bookingTrack.askNew', 'Ask for this time')}
            </button>
            <button type="button" onClick={() => setMode(null)} className="px-3 min-h-[44px] text-sm underline" style={{ color: 'var(--brand-muted)' }}>{t('bookingTrack.back', 'Back')}</button>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--brand-muted)' }}>{t('bookingTrack.moveNote', 'The business confirms the new time. Until then your booking shows as waiting.')}</p>
        </div>
      )}
    </section>
  );
}
