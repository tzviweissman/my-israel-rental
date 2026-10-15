/**
 * "Book a class" on the member's own pass page (backend
 * routes/marketplace/classes.py). The pass link is the credential.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { API } from '../../lib/apiBase';

export default function MemberClasses({ token }) {
  const { t, i18n } = useTranslation();
  const lang = String(i18n.language || 'en').startsWith('he') ? 'he' : 'en';
  const [d, setD] = useState(null);
  const [busy, setBusy] = useState(null);
  const url = `${API}/marketplace/memberships/me/${encodeURIComponent(token)}/classes`;
  const load = useCallback(() => axios.get(url).then(({ data }) => setD(data)).catch(() => setD(false)), [url]);
  useEffect(() => { load(); }, [load]);

  if (d === null) return <div className="py-4 text-center"><Loader2 className="animate-spin inline" size={16} /></div>;
  if (!d || d.classes.length === 0) return null;

  const act = async (s, cancel) => {
    setBusy(s.id);
    try {
      if (cancel) await axios.delete(`${url}/${s.id}`);
      else {
        const { data } = await axios.post(`${url}/${s.id}`);
        toast.success(data.status === 'booked' ? t('classes.youreIn', 'Booked: {{c}}', { c: s.title }) : t('classes.onWaitlist', 'On the waiting list for {{c}}', { c: s.title }));
      }
      await load();
    } catch (e) { toast.error(e?.response?.data?.detail || t('classes.failed', 'Could not save. Try again.')); } finally { setBusy(null); }
  };
  const fmtDay = (x) => new Intl.DateTimeFormat(lang === 'he' ? 'he-IL' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(`${x}T00:00`));
  const byDay = d.classes.reduce((acc, s) => { (acc[s.date] = acc[s.date] || []).push(s); return acc; }, {});

  return (
    <section className="rounded-2xl border bg-white p-4 mt-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="member-classes">
      <h2 className="text-base font-bold mb-1" style={{ color: 'var(--ink)' }}>{t('classes.bookTitle', 'Book a class')}</h2>
      {!d.can_book && <p className="text-xs mb-2" style={{ color: 'var(--brand-muted)' }}>{t('classes.activeFirst', 'You can book once your membership is active.')}</p>}
      <div className="space-y-3">
        {Object.entries(byDay).map(([day, list]) => (
          <div key={day}>
            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--brand-muted)' }}>{fmtDay(day)}</p>
            <ul className="space-y-1.5">
              {list.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-2 rounded-xl border p-2.5" style={{ borderColor: 'var(--brand-border)', opacity: s.cancelled ? 0.6 : 1 }} data-testid="member-class">
                  <span className="min-w-0 text-start">
                    <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }}>{s.start} · {s.title}</span>
                    <span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>
                      {s.cancelled ? t('classes.cancelled', 'Cancelled')
                        : s.my_status === 'booked' ? t('classes.youAreBooked', 'You are booked')
                          : s.my_status === 'waitlist' ? t('classes.waitPos', 'Waiting list, number {{n}}', { n: s.waitlist_position })
                            : s.spots_left > 0 ? t('classes.left', '{{n}} places left', { n: s.spots_left }) : t('classes.full', 'Full')}
                      {s.instructor && ` · ${s.instructor}`}
                    </span>
                  </span>
                  {!s.cancelled && (s.my_status ? (
                    <button type="button" disabled={busy === s.id} onClick={() => act(s, true)} className="shrink-0 px-3 min-h-[40px] rounded-full border text-xs font-semibold" style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }} data-testid="class-unbook">
                      {s.my_status === 'booked' ? t('classes.cancelBooking', 'Cancel') : t('classes.leaveWaitlist', 'Leave the list')}
                    </button>
                  ) : d.can_book && (
                    <button type="button" disabled={busy === s.id} onClick={() => act(s, false)} className="shrink-0 px-3 min-h-[40px] rounded-full text-xs font-semibold"
                            style={s.spots_left > 0 ? { background: 'var(--action)', color: 'var(--action-ink)' } : { border: '1px solid var(--ink)', color: 'var(--ink)' }} data-testid="class-book">
                      {s.spots_left > 0 ? t('classes.book', 'Book') : t('classes.joinWaitlist', 'Join the waiting list')}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
