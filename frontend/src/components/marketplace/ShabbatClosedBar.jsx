/**
 * "Closed for Shabbat. Orders open again Saturday at 18:36." (backend
 * shabbat.py). Shown on the business page and the order page while a
 * business that closes is closed. The reopening time is Israel time, read
 * from the ISO string itself so a phone abroad shows the same clock.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Moon } from 'lucide-react';

export default function ShabbatClosedBar({ closedNow, className = '' }) {
  const { t, i18n } = useTranslation();
  if (!closedNow?.until) return null;
  const he = (i18n.language || '').startsWith('he');
  const until = String(closedNow.until);
  const time = until.slice(11, 16);
  // Weekday of the reopening, from its Israel date.
  const [y, m, d] = until.slice(0, 10).split('-').map(Number);
  const day = new Intl.DateTimeFormat(he ? 'he-IL' : 'en-GB', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, d)));
  const saturdayNight = new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 6;
  const what = closedNow.kind === 'holiday'
    ? t('shabbatClosing.closedHoliday', 'Closed for the holiday.')
    : t('shabbatClosing.closedShabbat', 'Closed for Shabbat.');
  const when = he && saturdayNight
    ? t('shabbatClosing.opensMotzash', 'Orders open again on Saturday night at {{time}}.', { time })
    : t('shabbatClosing.opensAt', 'Orders open again {{day}} at {{time}}.', { day, time });
  return (
    <div role="note" className={`flex items-center gap-2 rounded-2xl px-4 py-3 text-sm ${className}`}
      style={{ background: 'var(--ink)', color: '#FFFFFF' }} data-testid="shabbat-closed">
      <Moon size={16} aria-hidden="true" className="shrink-0" />
      <span><strong className="font-semibold">{what}</strong> {when}</span>
    </div>
  );
}
