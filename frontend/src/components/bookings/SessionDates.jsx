/**
 * "Upcoming dates" on a listing with tours or workshops (backend
 * routes/marketplace/sessions.py): each date with the places left, and a
 * reserve form (no account). A full date offers the waiting list instead.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, CalendarDays } from 'lucide-react';
import { API } from '../../lib/apiBase';

const field = 'w-full px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]';
const fieldStyle = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function SessionDates({ gig }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [dates, setDates] = useState(null);
  const [open, setOpen] = useState(null);
  const [f, setF] = useState({ seats: 1, name: '', phone: '', email: '' });
  const [busy, setBusy] = useState(false);
  const [waited, setWaited] = useState({});
  const lang = String(i18n.language || 'en').startsWith('he') ? 'he' : 'en';

  const load = () => axios.get(`${API}/marketplace/gigs/${gig.id}/sessions`).then(({ data }) => setDates(data || [])).catch(() => setDates([]));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if ((gig.sessions || []).length) load(); }, [gig.id]);
  if (!dates || !dates.length) return null;

  const label = (d) => new Date(`${d.date}T12:00:00`).toLocaleDateString(i18n.language, { weekday: 'long', day: 'numeric', month: 'long' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const reserve = async (d) => {
    setBusy(true);
    try {
      const { data } = await axios.post(`${API}/marketplace/gigs/${gig.id}/sessions/${d.id}/reserve`, {
        seats: Number(f.seats), name: f.name.trim(), phone: f.phone.trim() || null, email: f.email.trim() || null, lang });
      navigate(data.track_path);
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('sessions.failed', 'Could not reserve. Try again.'));
      load();
    } finally { setBusy(false); }
  };
  const wait = async (d) => {
    setBusy(true);
    try {
      await axios.post(`${API}/marketplace/gigs/${gig.id}/sessions/${d.id}/waitlist`, { name: f.name.trim(), email: f.email.trim(), lang });
      setWaited({ ...waited, [d.id]: true });
    } catch (err) {
      toast.error(err?.response?.data?.detail || t('waitlist.failed', 'Could not add you. Try again.'));
    } finally { setBusy(false); }
  };

  return (
    <section className="mt-6" data-testid="session-dates">
      <h2 className="text-lg font-bold mb-2 inline-flex items-center gap-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
        <CalendarDays size={18} aria-hidden="true" /> {t('sessions.title', 'Upcoming dates')}
      </h2>
      <ul className="space-y-2">
        {dates.map((d) => {
          const full = d.left <= 0;
          const isOpen = open === d.id;
          return (
            <li key={d.id} className="rounded-xl border bg-white p-3" style={{ borderColor: 'var(--brand-border)' }} data-testid={`session-${d.id}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{label(d)}{d.time ? ` · ${d.time}` : ''}</p>
                  {d.note && <p className="text-xs" dir="auto" style={{ color: 'var(--brand-muted)' }}>{d.note}</p>}
                  <p className="text-xs mt-0.5" style={{ color: full ? '#B42318' : 'var(--brand-muted)' }}>
                    {full ? t('sessions.full', 'Full') : t('sessions.left', '{{n}} of {{total}} places left', { n: d.left, total: d.places })}
                  </p>
                </div>
                <button type="button" onClick={() => setOpen(isOpen ? null : d.id)} className="shrink-0 px-4 min-h-[44px] rounded-full text-sm font-semibold border"
                        style={full ? { borderColor: 'var(--brand-border)', color: 'var(--ink)' } : { background: 'var(--action)', color: 'var(--action-ink)', borderColor: 'var(--action)' }}
                        data-testid={`session-open-${d.id}`}>
                  {full ? t('sessions.waitBtn', 'Waiting list') : t('sessions.reserve', 'Reserve')}
                </button>
              </div>
              {isOpen && (waited[d.id] ? (
                <p className="text-xs mt-2" style={{ color: '#2E7D4F' }}>{t('sessions.waiting', "You're on the list. We'll email you if a place opens.")}</p>
              ) : (
                <form onSubmit={(e) => { e.preventDefault(); if (full) wait(d); else reserve(d); }} className="mt-3 space-y-2" data-testid={`session-form-${d.id}`}>
                  {!full && (
                    <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--ink)' }}>
                      {t('sessions.seats', 'Places')}
                      <select value={f.seats} onChange={set('seats')} className="px-3 py-2 rounded-lg border text-sm bg-white min-h-[44px]" style={fieldStyle}>
                        {Array.from({ length: Math.min(d.left, 20) }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                  )}
                  <input required minLength={2} maxLength={80} dir="auto" value={f.name} onChange={set('name')} placeholder={t('quote.name', 'Your name')} className={field} style={fieldStyle} data-testid="session-name" />
                  <div className="grid grid-cols-2 gap-2">
                    {!full && <input type="tel" maxLength={40} value={f.phone} onChange={set('phone')} placeholder={t('quote.phone', 'Phone')} className={field} style={fieldStyle} dir="ltr" />}
                    <input type="email" required={full} maxLength={200} value={f.email} onChange={set('email')} placeholder={t('quote.email', 'Email')} className={field} style={fieldStyle} dir="ltr" data-testid="session-email" />
                  </div>
                  <button type="submit" disabled={busy} className="w-full inline-flex items-center justify-center gap-2 min-h-[44px] rounded-full text-sm font-semibold disabled:opacity-60"
                          style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid={`session-submit-${d.id}`}>
                    {busy && <Loader2 size={14} className="animate-spin" />} {full ? t('sessions.tellMe', 'Tell me if a place opens') : t('sessions.confirm', 'Reserve my places')}
                  </button>
                </form>
              ))}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
