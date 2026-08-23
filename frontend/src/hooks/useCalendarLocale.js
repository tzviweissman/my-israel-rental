/**
 * useCalendarLocale — the props every react-day-picker in this app needs to
 * speak the site's language.
 *
 * react-day-picker renders its own month name, weekday initials and
 * navigation. Left to itself it takes them from the *browser's* language,
 * not the site's, so a Hebrew page viewed on an English machine prints
 * "August 2026 / Su Mo Tu" and lays the arrows out left-to-right — meaning
 * the arrow that looks like "forward" goes backward.
 *
 * `labels` is a separate problem again: those strings are hardcoded English
 * inside the library and are NOT routed through `locale`, so a screen reader
 * announces "Go to next month" however the calendar is otherwise configured.
 *
 * Three components build a DayPicker (components/ui/calendar.jsx,
 * components/common/DateField.jsx, components/search/WhenPicker.jsx). This
 * hook exists so the fix lives once rather than drifting between them — a
 * fourth calendar should spread it too:
 *
 *     const cal = useCalendarLocale();
 *     <DayPicker {...cal} … />
 *
 * Spread it first so a caller with a genuine reason to differ can still
 * override any single prop after it.
 */
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { he as heLocale, enUS as enLocale } from 'date-fns/locale';

const useCalendarLocale = () => {
  const { t, i18n } = useTranslation();
  const isHebrew = (i18n.language || '').startsWith('he');
  return useMemo(() => ({
    locale: isHebrew ? heLocale : enLocale,
    dir: isHebrew ? 'rtl' : 'ltr',
    labels: {
      labelPrevious: () => t('calendar.previousMonth', 'Go to previous month'),
      labelNext: () => t('calendar.nextMonth', 'Go to next month'),
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [isHebrew, i18n.language]);
};

export default useCalendarLocale;
