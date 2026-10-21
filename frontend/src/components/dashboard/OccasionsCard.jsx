/**
 * Customers → two ready-made reasons to email customers (backend
 * routes/marketplace/occasions.py): the next holiday, and customers who have
 * not been back in a while. Each opens the email composer with a message
 * ready to finish; the parts only the business can write are left in
 * [square brackets], and nothing sends until they are replaced.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { CalendarHeart, UserRoundCheck } from 'lucide-react';

const btn = 'inline-flex items-center gap-1.5 px-4 min-h-[44px] rounded-full border text-sm font-semibold bg-white';
const line = { borderColor: 'var(--brand-border)', color: 'var(--ink)' };

export default function OccasionsCard({ API, auth, biz, onCompose }) {
  const { t, i18n } = useTranslation();
  const [data, setData] = useState(null);
  const he = String(i18n.language || '').startsWith('he');

  useEffect(() => {
    setData(null);
    axios.get(`${API}/marketplace/businesses/${biz.id}/messages/occasions`, auth)
      .then(({ data: d }) => setData(d)).catch(() => setData(false));
  }, [API, auth, biz.id]);
  if (!data) return null;

  const fmt = (iso, lng, opts) => new Intl.DateTimeFormat(lng === 'he' ? 'he-IL' : 'en-GB', opts).format(new Date(`${iso}T00:00`));
  const holiday = (data.holidays || [])[0];
  const lapsed = Number(data.lapsed?.['90'] || 0);
  if (!holiday && !lapsed) return null;

  // The message in either language, so "Written in" can swap it while it is untouched.
  const ready = (key, extra) => (lng) => {
    const tl = i18n.getFixedT(lng);
    const vars = { name: (lng === 'he' && biz.name_he) || biz.name || '', ...extra(lng) };
    return { subject: tl(`${key}.subject`, vars), body: tl(`${key}.body`, vars) };
  };
  const open = (kind, make, more) => {
    const lang = he ? 'he' : 'en';
    onCompose({ kind, lang, make, ...make(lang), ...more });
  };
  const writeHoliday = () => open('all', ready(`messages.occasion.${holiday.key}`,
    (lng) => ({ date: fmt(holiday.date, lng, { weekday: 'long', day: 'numeric', month: 'long' }) })));
  const writeWinBack = () => open('lapsed', ready('messages.occasion.winBack', () => ({})), { days: 90 });

  return (
    <section className="rounded-2xl border p-4 mb-4 grid gap-3 sm:grid-cols-2" style={{ borderColor: 'var(--brand-border)', background: 'var(--surface, #F9FAFB)' }} data-testid="occasions-card">
      {holiday && (
        <div className="flex gap-3 items-start">
          <CalendarHeart size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--gold)' }} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {holiday.days_away === 0
                ? t('messages.occasion.today', '{{holiday}} is today', { holiday: t(`messages.holiday.${holiday.key}`) })
                : t('messages.occasion.soon', '{{holiday}} is in {{count}} days', { holiday: t(`messages.holiday.${holiday.key}`), count: holiday.days_away })}
            </p>
            <p className="text-xs mb-2" style={{ color: 'var(--brand-muted)' }}>
              {t('messages.occasion.holidayHint', 'Tell your customers your holiday hours and what you offer for it.')}
            </p>
            <button type="button" onClick={writeHoliday} className={btn} style={line} data-testid="occasion-holiday">
              {t('messages.occasion.writeHoliday', 'Write a holiday message')}
            </button>
          </div>
        </div>
      )}
      {lapsed > 0 && (
        <div className="flex gap-3 items-start">
          <UserRoundCheck size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--gold)' }} aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              {t('messages.occasion.lapsed', { count: lapsed })}
            </p>
            <p className="text-xs mb-2" style={{ color: 'var(--brand-muted)' }}>
              {t('messages.occasion.lapsedHint', 'A short note with something new often brings people back.')}
            </p>
            <button type="button" onClick={writeWinBack} className={btn} style={line} data-testid="occasion-winback">
              {t('messages.occasion.writeWinBack', 'Write a message to bring them back')}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
