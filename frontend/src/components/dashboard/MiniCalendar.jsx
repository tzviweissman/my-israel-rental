import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Renders a single month grid with booked days highlighted, including
 * Airbnb-style handover/turnover visualization: when a checkout and a
 * check-in fall on the same day the cell is split with a bright white
 * separator so the lister can spot the cleaning turnover at a glance.
 *
 * `bookings` is an array of `{ id, start_date, end_date, status, renter_name }`.
 */
const STATUS_COLOR = {
  confirmed: '#16A34A',
  pending: '#0EA5E9',
  cancellation_requested: '#F59E0B',
};

const colorFor = (status) => STATUS_COLOR[status] || '#9CA3AF';

// Build YYYY-MM-DD from local-time components so we don't slip into the
// previous day for users east of UTC (Israel is UTC+2/+3).
const localIso = (year, month, day) => {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
};

const dayInfo = (year, month, day, bookings) => {
  const d = localIso(year, month, day);
  let outgoing = null;
  let incoming = null;
  let middle = null;
  for (const b of bookings) {
    if (b.end_date === d) outgoing = b;
    if (b.start_date === d) incoming = b;
    if (b.start_date < d && d < b.end_date) middle = b;
  }
  return { outgoing, incoming, middle };
};

const Cell = ({ children }) => (
  <div className="aspect-square relative rounded overflow-hidden flex items-center justify-center text-[9px] font-medium">
    {children}
  </div>
);

const MiniCalendar = ({ year, month, bookings = [] }) => {
  const { i18n } = useTranslation();
  const firstOfMonth = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstOfMonth.getDay();
  const locale = i18n.language === 'he' ? 'he-IL' : undefined;
  const monthLabel = firstOfMonth.toLocaleString(locale, { month: 'short', year: 'numeric' });
  const todayIso = (() => {
    const t = new Date();
    return localIso(t.getFullYear(), t.getMonth(), t.getDate());
  })();

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-2" data-testid={`mini-calendar-${year}-${month}`}>
      <div className="text-[11px] font-semibold text-gray-700 mb-1 text-center">{monthLabel}</div>
      <div className="grid grid-cols-7 gap-0.5 text-[9px] text-gray-400 text-center mb-0.5">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={`dow-${i}`}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((day, i) => {
          // Cells before the 1st of the month are empty padding — they can't
          // use an ISO date so we fall back to a stable padding-index key.
          if (day == null) return <div key={`pad-${i}`} />;
          const { outgoing, incoming, middle } = dayInfo(year, month, day, bookings);
          const isTurnover = outgoing && incoming;
          const dayIso = localIso(year, month, day);
          const isToday = dayIso === todayIso;
          const todayRing = isToday ? 'ring-2 ring-[var(--gold)]' : '';

          if (isTurnover) {
            return (
              <Cell key={dayIso}>
                <div className={`absolute inset-0 rounded ring-1 ring-gray-700/40 ${todayRing}`}>
                  <div
                    className="absolute inset-y-0 left-0 w-[44%]"
                    style={{ background: colorFor(outgoing.status) }}
                    title={`Check-out: ${outgoing.renter_name || 'Guest'}`}
                  />
                  <div
                    className="absolute inset-y-0 right-0 w-[44%]"
                    style={{ background: colorFor(incoming.status) }}
                    title={`Check-in: ${incoming.renter_name || 'Guest'}`}
                  />
                  <div className="absolute inset-y-0 left-[44%] w-[12%] bg-white" />
                </div>
                <span className="relative text-[8px] font-bold text-gray-700">{day}</span>
              </Cell>
            );
          }

          if (middle || outgoing || incoming) {
            const b = middle || outgoing || incoming;
            const bg = colorFor(b.status);
            return (
              <Cell key={dayIso}>
                <div className={`absolute inset-0 rounded ${todayRing}`} style={{ background: bg }} />
                <span className="relative text-white font-semibold">{day}</span>
              </Cell>
            );
          }

          return (
            <Cell key={dayIso}>
              <span className={`text-gray-500 ${isToday ? 'font-bold text-[var(--gold)]' : ''}`}>{day}</span>
            </Cell>
          );
        })}
      </div>
    </div>
  );
};

export default MiniCalendar;
