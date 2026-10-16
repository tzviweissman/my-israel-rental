/**
 * Two quiet buttons under a confirmed time: Google Calendar, and an .ics
 * file for Apple / Outlook (utils/calendarLinks.js). Renders nothing when
 * the time is unknown.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarPlus } from 'lucide-react';
import { eventTimes, googleCalendarUrl, downloadIcs } from '../../utils/calendarLinks';

export default function AddToCalendar({ uid, title, day, time, minutes = 60, location = '', compact = false }) {
  const { t } = useTranslation();
  const times = eventTimes(day, time, minutes);
  if (!times) return null;
  const event = { uid, title, ...times, location, details: typeof window !== 'undefined' ? window.location.href : '' };
  const btn = `inline-flex items-center gap-1.5 rounded-full border font-semibold ${compact ? 'px-2.5 min-h-[36px] text-xs' : 'px-3.5 min-h-[40px] text-sm'}`;
  const style = { borderColor: 'var(--brand-border)', color: 'var(--ink)', background: '#fff' };
  return (
    <div className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'mt-4'}`} data-testid="add-to-calendar">
      <a href={googleCalendarUrl(event)} target="_blank" rel="noopener noreferrer" className={btn} style={style} data-testid="add-to-google">
        <CalendarPlus size={compact ? 13 : 15} aria-hidden="true" /> {t('calendarAdd.google', 'Google Calendar')}
      </a>
      <button type="button" onClick={() => downloadIcs(event)} className={btn} style={style} data-testid="add-to-ics">
        <CalendarPlus size={compact ? 13 : 15} aria-hidden="true" /> {t('calendarAdd.apple', 'Apple / Outlook')}
      </button>
    </div>
  );
}
