/**
 * What MyIsraelRental does for a business, on the join page (Tzvi, 12 Nov 2026, from polsia.com):
 *
 *  - a live line of real work, one event at a time, typed out like a terminal: the texts and emails the site
 *    sent, its instant replies and the replies it drafted (GET /api/site/work, routes/site_visits.py). Nothing
 *    names anyone: the kind of message, the business's area, how long ago. With too little to show the server
 *    sends nothing and the line is left out: never invented.
 *  - every job in one list, shown at once (not lit up line by line as you scroll: Tzvi ruled that overused,
 *    20 Oct 2026), each one a feature the site has today.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from 'motion/react';
import { Check } from 'lucide-react';
import { API } from '../../lib/apiBase';
import { areaLabel } from '../../utils/areaNames';

const JOBS = [
  ['texts', 'Texts your customers.'],
  ['receipts', 'Sends their receipts.'],
  ['replies', 'Drafts your replies.'],
  ['ads', 'Makes your ads.'],
  ['page', 'Builds your page.'],
  ['reviews', 'Asks for reviews.'],
];
const WORDS = {
  order_alert: { text: 'Texted a business its new order, with one-tap Confirm', email: 'Emailed a business its new order, with one-tap Confirm' },
  received: { text: 'Texted a customer that their order arrived', email: 'Emailed a customer their receipt' },
  confirmed: { text: 'Texted a customer that their order is confirmed', email: 'Emailed a customer their confirmation' },
  review_asked: { '': 'Asked a happy customer for a review' },
  reminder_sent: { '': 'Sent a customer a booking reminder' },
  auto_reply: { '': "Answered a customer's message straight away" },
  reply_drafted: { '': 'Drafted a reply for a customer who was waiting' },
};

function ago(at, lang) {
  const s = Math.max(0, (Date.now() - new Date(at).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}

function LiveLine() {
  const { t, i18n } = useTranslation();
  const reduced = useReducedMotion();
  const [events, setEvents] = useState([]);
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    fetch(`${API}/site/work`).then((r) => (r.ok ? r.json() : null)).then((d) => setEvents((d && d.events) || [])).catch(() => {});
  }, []);
  const lang = (i18n.language || 'en').startsWith('he') ? 'he' : 'en';
  const e = events.length ? events[i % events.length] : null;
  const words = e ? (WORDS[e.kind] || {}) : {};
  const key = e ? (e.channel in words ? e.channel : Object.keys(words)[0]) : '';
  const line = e && key !== undefined
    ? [t(`workForYou.event.${e.kind}${key ? `_${key}` : ''}`, words[key]), e.area ? areaLabel(e.area, t) : '', ago(e.at, lang)].filter(Boolean).join(' · ')
    : '';
  // Typed out one letter at a time, held, then the next event. Still for anyone who asked for less motion.
  useEffect(() => {
    if (!line) return undefined;
    if (reduced) {
      setShown(line.length);
      const id = setTimeout(() => setI((n) => n + 1), 4500);
      return () => clearTimeout(id);
    }
    if (shown < line.length) {
      const id = setTimeout(() => setShown((n) => n + 1), 28);
      return () => clearTimeout(id);
    }
    const id = setTimeout(() => { setShown(0); setI((n) => n + 1); }, 2800);
    return () => clearTimeout(id);
  }, [line, shown, reduced]);
  if (!line) return null;
  return (
    <div className="flex items-start sm:items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[13px] leading-snug" dir="auto"
      style={{ background: 'var(--ink, #111827)', color: '#E5E7EB', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}
      data-testid="work-live-line">
      <span className="relative flex h-2 w-2 shrink-0 max-sm:mt-1.5" aria-hidden="true">
        {!reduced && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: '#34D399' }} />}
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#34D399' }} />
      </span>
      <span className="sr-only">{t('workForYou.liveLabel', 'Just done for a business on MyIsraelRental:')}</span>
      <span className="min-w-0 max-sm:min-h-[2.6em] sm:truncate" aria-live="off">
        <span aria-hidden="true" style={{ color: '#9CA3AF' }}>&gt; </span>
        {line.slice(0, shown)}
        <span aria-hidden="true" className={reduced ? '' : 'animate-pulse'} style={{ color: '#9CA3AF' }}>▍</span>
      </span>
    </div>
  );
}

export default function WorkForYou({ className = '' }) {
  const { t } = useTranslation();
  return (
    <div className={className} data-testid="work-for-you">
      <LiveLine />
      <div className="mt-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-primary-dark, #0F5E8F)' }}>
          {t('workForYou.title', 'For your business, MyIsraelRental')}
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm" style={{ color: 'var(--ink, #111827)' }}>
          {JOBS.map(([k, en]) => (
            <li key={k} className="flex items-start gap-1.5">
              <Check size={15} className="mt-0.5 shrink-0" style={{ color: 'var(--brand-primary, #167AB8)' }} aria-hidden="true" />
              <span>{t(`workForYou.job.${k}`, en)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-base font-semibold [@media(max-height:700px)]:hidden" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink, #111827)' }}>
          {t('workForYou.close', 'One place. Every job.')}
        </p>
      </div>
    </div>
  );
}
