/**
 * Calendar sync, both ways (backend calendar_sync.py).
 *
 * Out: each business's bookings, classes and orders due, as a calendar
 * Google, Apple or Outlook subscribes to; one per appointment team member
 * too. In: the owner's own calendar's private address, whose busy times then
 * block booking times here.
 *
 * Folded, beside "Time I am not available", because it is set up once and
 * then left alone.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CalendarSync, Copy, ExternalLink, Loader2, Plus, RotateCcw, X } from 'lucide-react';

const BORDER = 'var(--brand-border)';
const MUTED = 'var(--brand-muted)';

export default function CalendarSyncPanel({ API, token }) {
  const { t, i18n } = useTranslation();
  const lng = (i18n.language || '').startsWith('he') ? 'he' : 'en';
  const auth = { headers: { Authorization: `Bearer ${token}` } };
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [url, setUrl] = useState('');
  const [adding, setAdding] = useState(false);

  const load = useCallback(() => {
    axios.get(`${API}/marketplace/calendar-sync`, { ...auth, params: { lng } })
      .then(({ data: d }) => setData(d)).catch(() => setData({ businesses: [], imports: [] }));
  }, [API, token, lng]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (open && !data) load(); }, [open, data, load]);

  const copy = async (text) => {
    try { await navigator.clipboard.writeText(text); toast.success(t('calSync.copied', 'Link copied')); } catch { toast.error(text); }
  };
  const webcal = (u) => u.replace(/^https:/, 'webcal:');
  const google = (u) => `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal(u))}`;

  const addImport = async () => {
    if (!url.trim() || adding) return;
    setAdding(true);
    try {
      const { data: r } = await axios.post(`${API}/marketplace/calendar-imports`, { url: url.trim() }, auth);
      toast.success(t('calSync.added', 'Connected. {{n}} busy times found.', { n: r.busy_times }));
      setUrl('');
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('calSync.addFailed', 'That calendar could not be read.'));
    } finally {
      setAdding(false);
    }
  };
  const removeImport = async (id) => {
    try { await axios.delete(`${API}/marketplace/calendar-imports/${id}`, auth); load(); } catch { /* the row stays */ }
  };
  const reset = async (businessId) => {
    if (!window.confirm(t('calSync.resetConfirm', 'Make new links? Calendars using the old links stop updating until you add the new ones.'))) return;
    await axios.post(`${API}/marketplace/businesses/${businessId}/calendar/reset`, null, auth).catch(() => {});
    load();
  };

  const linkBtn = 'inline-flex items-center gap-1.5 min-h-[36px] text-[13px] font-semibold underline underline-offset-4';
  const imports = data?.imports || [];

  return (
    <div className="mb-4 rounded-2xl border bg-white" style={{ borderColor: BORDER }} data-testid="calendar-sync-panel">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-start">
        <span className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          <CalendarSync size={15} style={{ color: MUTED }} aria-hidden="true" />
          {t('calSync.title', 'Your calendar')}
        </span>
        <span className="text-xs" style={{ color: MUTED }}>
          {imports.length ? t('calSync.connected', '{{n}} connected', { n: imports.length }) : t('calSync.setUp', 'set up')}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t pt-3 space-y-5" style={{ borderColor: BORDER }}>
          {data === null ? (
            <div className="py-4 text-center" style={{ color: MUTED }}><Loader2 className="animate-spin inline" size={16} /></div>
          ) : (
            <>
              <section>
                <h4 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('calSync.outTitle', 'See your bookings in your own calendar')}</h4>
                <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
                  {t('calSync.outBody', 'Appointments, classes and orders due appear in Google, Apple or Outlook calendar. Google updates subscribed calendars every few hours; Apple and Outlook about every hour.')}
                </p>
                {data.businesses.map((b) => (
                  <div key={b.business_id} className="mt-3">
                    <p className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                      <span className="font-semibold" style={{ color: 'var(--ink)' }}>{data.businesses.length > 1 ? b.name : ''}</span>
                      <button type="button" onClick={() => reset(b.business_id)} className="inline-flex items-center gap-1 underline underline-offset-4 min-h-[32px]" style={{ color: MUTED }}>
                        <RotateCcw size={12} aria-hidden="true" /> {t('calSync.reset', 'Make new links')}
                      </button>
                    </p>
                    <ul className="mt-1 grid gap-2">
                      {b.feeds.map((f) => (
                        <li key={f.team_id || 'all'} className="rounded-xl border px-3 py-2" style={{ borderColor: BORDER }}>
                          <span className="block text-[13px]" style={{ color: 'var(--ink)' }}>{f.label}</span>
                          <span className="flex flex-wrap gap-x-4">
                            <a href={google(f.url)} target="_blank" rel="noopener noreferrer" className={linkBtn} style={{ color: 'var(--gold)' }}>
                              <ExternalLink size={13} aria-hidden="true" /> {t('calSync.google', 'Add to Google Calendar')}
                            </a>
                            <a href={webcal(f.url)} className={linkBtn} style={{ color: 'var(--gold)' }}>
                              <ExternalLink size={13} aria-hidden="true" /> {t('calSync.apple', 'Add to Apple or Outlook')}
                            </a>
                            <button type="button" onClick={() => copy(f.url)} className={linkBtn} style={{ color: 'var(--gold)' }}>
                              <Copy size={13} aria-hidden="true" /> {t('calSync.copy', 'Copy link')}
                            </button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <p className="mt-3 text-[12px]" style={{ color: MUTED }}>
                  {t('calSync.private', 'Anyone with these links can see the bookings, so share each one only with the person it is for.')}
                </p>
              </section>

              <section>
                <h4 className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('calSync.inTitle', 'Block the times you are busy in your own calendar')}</h4>
                <p className="mt-1 text-[13px]" style={{ color: MUTED }}>
                  {t('calSync.inBody', 'Paste your calendar’s private address. Its busy times are checked every 15 minutes and nobody can book them here. Events marked free do not block anything.')}
                </p>
                <details className="mt-1 text-[13px]" style={{ color: MUTED }}>
                  <summary className="cursor-pointer min-h-[32px] flex items-center underline underline-offset-4">{t('calSync.where', 'Where do I find it?')}</summary>
                  <p className="mt-1">{t('calSync.whereGoogle', 'Google Calendar on a computer: Settings, then your calendar on the left, then copy the "Secret address in iCal format".')}</p>
                  <p className="mt-1">{t('calSync.whereApple', 'Apple Calendar on iPhone: tap Calendars, the (i) next to your calendar, turn on Public Calendar, then Share Link and copy it.')}</p>
                </details>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input dir="ltr" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/..."
                    className="flex-1 min-w-[220px] rounded-lg border px-3 min-h-[40px] text-sm" style={{ borderColor: BORDER, color: 'var(--ink)' }} />
                  <button type="button" onClick={addImport} disabled={adding || !url.trim()}
                    className="min-h-[40px] px-4 rounded-full border text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-40"
                    style={{ borderColor: BORDER, color: 'var(--ink)' }}>
                    {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {t('calSync.connect', 'Connect')}
                  </button>
                </div>
                {imports.length > 0 && (
                  <ul className="mt-3 grid gap-2">
                    {imports.map((i) => (
                      <li key={i.id} className="flex items-center gap-3 rounded-xl border px-3 py-2" style={{ borderColor: BORDER }}>
                        <span className="flex-1 min-w-0 text-[13px]">
                          <span dir="ltr" className="block truncate" style={{ color: 'var(--ink)' }}>{i.label}</span>
                          <span className="block" style={{ color: i.error ? '#B42318' : MUTED }}>
                            {i.error || t('calSync.busyCount', '{{n}} busy times blocked', { n: i.busy_times })}
                          </span>
                        </span>
                        <button type="button" onClick={() => removeImport(i.id)} className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-full" aria-label={t('calSync.remove', 'Disconnect')} style={{ color: MUTED }}>
                          <X size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
