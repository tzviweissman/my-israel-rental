/**
 * "Usually busy" on the business page (backend busy_times.py, Tzvi, 16 Oct
 * 2026, from Google's popular times). One weekday at a time, a bar per
 * hour, from the business's own check-ins and appointments over 12 weeks.
 * Renders nothing until there is enough to show a real pattern.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Clock } from 'lucide-react';
import { API } from '../../lib/apiBase';

export default function BusyTimes({ businessId }) {
  const { t, i18n } = useTranslation();
  const [d, setD] = useState(null);
  // Israel's day and hour, whatever the visitor's own clock says.
  const il = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short', hour: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date()).reduce((a, x) => ({ ...a, [x.type]: x.value }), {});
    return { day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), hour: Number(parts.hour) };
  }, []);
  const [day, setDay] = useState(il.day);
  useEffect(() => {
    if (!businessId) return;
    axios.get(`${API}/marketplace/businesses/${businessId}/busy-times`).then(({ data }) => setD(data)).catch(() => setD(null));
  }, [businessId]);
  const days = useMemo(() => (d?.enough ? Object.keys(d.days).map(Number).sort((a, b) => a - b) : []), [d]);
  useEffect(() => { if (days.length && !days.includes(day)) setDay(days[0]); }, [days, day]);
  if (!d?.enough || !days.length) return null;

  const he = i18n.language?.startsWith('he');
  const dayName = (n) => new Intl.DateTimeFormat(he ? 'he-IL' : 'en-GB', { weekday: 'short' }).format(new Date(2026, 0, 4 + n));
  const hours = d.days[String(day)] || {};
  const keys = Object.keys(hours).map(Number);
  const from = Math.min(...keys);
  const to = Math.max(...keys);
  const span = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const nowHour = il.hour;
  const today = il.day === day;
  const level = (v) => (v >= 70 ? t('busy.busy', 'Usually busy') : v >= 35 ? t('busy.some', 'Usually a little busy') : t('busy.quiet', 'Usually quiet'));
  const nowVal = today && nowHour >= from && nowHour <= to ? (hours[String(nowHour)] || 0) : undefined;

  return (
    <section className="mt-6 rounded-2xl border bg-white p-4" style={{ borderColor: 'var(--brand-border)' }} data-testid="busy-times">
      <h2 className="text-base font-semibold inline-flex items-center gap-2" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
        <Clock size={16} aria-hidden="true" /> {t('busy.title', 'Busy times')}
      </h2>
      <div className="mt-3 flex gap-1 overflow-x-auto" role="tablist">
        {days.map((n) => (
          <button key={n} type="button" role="tab" aria-selected={n === day} onClick={() => setDay(n)}
                  className="px-3 min-h-[36px] rounded-full text-xs font-semibold shrink-0"
                  style={n === day ? { background: 'var(--ink)', color: 'var(--action-ink)' } : { color: 'var(--brand-muted)' }}>{dayName(n)}</button>
        ))}
      </div>
      {nowVal !== undefined && <p className="text-sm mt-3" style={{ color: 'var(--ink)' }} data-testid="busy-now"><b>{t('busy.now', 'Now:')}</b> {level(nowVal)}</p>}
      <div className="mt-3 flex items-end gap-1 h-24" dir="ltr" aria-hidden="true">
        {span.map((h) => {
          const v = hours[String(h)] || 0;
          return (
            <div key={h} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${h}:00 · ${level(v)}`}>
              <div className="w-full rounded-t" style={{ height: `${Math.max(v, 4)}%`, background: today && h === nowHour ? 'var(--gold)' : 'rgba(36,175,235,.33)' }} />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] mt-1" dir="ltr" style={{ color: 'var(--brand-muted)' }}>
        <span>{from}:00</span><span>{to + 1}:00</span>
      </div>
      <p className="sr-only">{span.map((h) => `${h}:00 ${level(hours[String(h)] || 0)}`).join(', ')}</p>
      <p className="text-[11px] mt-2" style={{ color: 'var(--brand-muted)' }}>{t('busy.source', 'From visits and appointments over the last {{n}} weeks.', { n: d.weeks })}</p>
    </section>
  );
}
