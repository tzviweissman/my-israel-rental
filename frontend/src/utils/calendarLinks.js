/**
 * "Add to calendar" for a confirmed appointment, tour date or class
 * (Tzvi, 16 Oct 2026, from Calendly and Booksy). Google gets a link; Apple
 * and Outlook get an .ics file made in the browser, so no account and no
 * server round trip. Times are Israel time, written out in UTC.
 * The email carries the same Google link (backend utils/calendar_link.py).
 */

// Israel's offset from UTC at that wall time, as the browser's Intl reports it.
function israelOffsetMinutes(day, time) {
  const guess = new Date(`${day}T${time}:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  }).formatToParts(guess).reduce((a, p) => ({ ...a, [p.type]: p.value }), {});
  const asIl = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute);
  return Math.round((asIl - guess.getTime()) / 60000);
}

export function eventTimes(day, time, minutes = 60) {
  if (!day || !time || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{1,2}:\d{2}$/.test(time)) return null;
  const t = time.padStart(5, '0');
  const start = new Date(new Date(`${day}T${t}:00Z`).getTime() - israelOffsetMinutes(day, t) * 60000);
  if (Number.isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + Math.max(15, Number(minutes) || 60) * 60000);
  return { start, end };
}

const stamp = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

export function googleCalendarUrl({ title, start, end, details = '', location = '' }) {
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates: `${stamp(start)}/${stamp(end)}` });
  if (details) q.set('details', details);
  if (location) q.set('location', location);
  return `https://calendar.google.com/calendar/render?${q}`;
}

const icsEscape = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (m) => `\\${m}`);

export function icsText({ uid, title, start, end, details = '', location = '' }) {
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MyIsraelRental//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT', `UID:${uid}@myisraelrental`, `DTSTAMP:${stamp(new Date())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${icsEscape(title)}`, details && `DESCRIPTION:${icsEscape(details)}`, location && `LOCATION:${icsEscape(location)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT2H', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(title)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

export function downloadIcs(event) {
  const blob = new Blob([icsText(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${String(event.title || '').replace(/[^\w\u0590-\u05FF -]+/g, '').trim().slice(0, 40) || 'event'}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
