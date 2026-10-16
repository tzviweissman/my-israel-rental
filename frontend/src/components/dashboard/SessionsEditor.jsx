/**
 * Listing editor → "Tours and workshops: dates with limited places"
 * (backend sessions.py) and whether the listing takes quote requests
 * (quotes.py). Folded to one line until opened.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, CalendarDays, ChevronDown, ChevronUp } from 'lucide-react';

const box = 'px-3 py-2 rounded-lg border text-sm bg-white min-h-[40px]';
const boxStyle = { borderColor: 'var(--brand-border)' };

export function cleanSessions(list) {
  return (list || []).filter((s) => s.date && Number(s.places) > 0).map((s) => ({
    id: s.id, date: s.date, time: s.time || null, places: Math.min(500, Math.max(1, parseInt(s.places, 10) || 1)), note: String(s.note || '').trim().slice(0, 120),
  }));
}

export default function SessionsEditor({ sessions, onSessions, quotesOn, onQuotesOn, showQuotes }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState((sessions || []).length > 0);
  const add = () => {
    const ids = new Set((sessions || []).map((s) => s.id));
    let n = (sessions || []).length + 1;
    while (ids.has(`d${n}`)) n += 1;
    const last = (sessions || [])[sessions.length - 1];
    onSessions([...(sessions || []), { id: `d${n}`, date: '', time: last?.time || '10:00', places: last?.places || 10, note: last?.note || '' }]);
  };
  const upd = (i, patch) => onSessions(sessions.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  return (
    <div className="rounded-lg border" style={boxStyle} data-testid="edit-listing-sessions">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-2 px-3 min-h-[44px] text-start text-sm font-semibold text-gray-700">
        <span className="inline-flex items-center gap-2"><CalendarDays size={15} /> {t('sessions.editorTitle', 'Dates with limited places, and quotes')}</span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-4 text-sm">
          <div>
            <p className="font-semibold text-gray-700">{t('sessions.editorDates', 'Tour or workshop dates')}</p>
            <p className="text-xs text-gray-600 mb-2">{t('sessions.editorHint', 'Each date with how many places it has. People reserve without an account; a full date takes a waiting list.')}</p>
            <ul className="space-y-2">
              {(sessions || []).map((s, i) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <input type="date" value={s.date} onChange={(e) => upd(i, { date: e.target.value })} className={box} style={boxStyle} aria-label={t('waitlist.day', 'Day')} data-testid={`session-date-${i}`} />
                  <input type="time" value={s.time || ''} onChange={(e) => upd(i, { time: e.target.value })} className={box} style={boxStyle} aria-label={t('bookingTrack.time', 'Time')} />
                  <label className="inline-flex items-center gap-1">
                    <input type="number" min="1" max="500" value={s.places} onChange={(e) => upd(i, { places: e.target.value })} className={`${box} w-20`} style={boxStyle} data-testid={`session-places-${i}`} />
                    {t('sessions.placesWord', 'places')}
                  </label>
                  <input value={s.note || ''} maxLength={120} dir="auto" onChange={(e) => upd(i, { note: e.target.value })} placeholder={t('sessions.notePh', 'Note, e.g. meet at Jaffa Gate')} className={`${box} flex-1 min-w-[10rem]`} style={boxStyle} />
                  <button type="button" onClick={() => onSessions(sessions.filter((_, j) => j !== i))} className="grid place-content-center w-10 h-10 text-red-700" aria-label={t('team.remove', 'Remove')}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
            {(sessions || []).length < 60 && (
              <button type="button" onClick={add} className="mt-1 inline-flex items-center gap-1 min-h-[40px] font-semibold" style={{ color: 'var(--ink)' }} data-testid="session-add">
                <Plus size={14} /> {t('sessions.addDate', 'Add a date')}
              </button>
            )}
          </div>
          {showQuotes && (
            <label className="flex items-start gap-2 min-h-[44px]">
              <input type="checkbox" checked={!!quotesOn} onChange={(e) => onQuotesOn(e.target.checked)} className="mt-1" data-testid="quotes-on" />
              <span>
                <span className="font-semibold text-gray-700">{t('quotes.toggle', 'Take quote requests')}</span>
                <span className="block text-xs text-gray-600">{t('quotes.toggleHint', 'Customers describe a job with photos and you reply with a price. For work a fixed price list cannot cover.')}</span>
              </span>
            </label>
          )}
        </div>
      )}
    </div>
  );
}
