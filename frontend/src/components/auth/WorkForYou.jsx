/**
 * What MyIsraelRental does for a business, on the join and sign-in pages (Tzvi, 12 Nov 2026, from polsia.com;
 * made the main thing on the panel 16 Nov 2026, replacing the photo sphere: "make that thing the main theme").
 *
 *  - a live stream of real work, typed out like a terminal, newest on top: the texts and emails the site sent, its
 *    instant replies and the replies it drafted (GET /api/site/work, routes/site_visits.py). Nothing names anyone:
 *    the kind of message, the business's area, how long ago. With too little to show the server sends nothing and
 *    the stream is left out: never invented, never repeated to look busier.
 *  - as each line lands, a small example of what that kind of message looks like (marked as an example: the real
 *    message is private), its city blinks on a faint map of Israel, and the matching job in the list below lights up.
 *  - the last row waits for the visitor: "Next: your business".
 *  - every job in one list, each one a feature the site has today.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Globe, Mail, Megaphone, MessageSquare, Star } from 'lucide-react';
import { API } from '../../lib/apiBase';
import { areaLabel } from '../../utils/areaNames';
import { LOCATION_OPTIONS } from '../../constants/locations';

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
  ad_made: { '': 'Made an ad for a business' },
  page_built: { '': "Built a business's page and put it live" },
};
// Which job in the list an event proves.
function jobOf(e) {
  if (e.kind === 'review_asked') return 'reviews';
  if (e.kind === 'ad_made') return 'ads';
  if (e.kind === 'page_built') return 'page';
  if (e.kind === 'auto_reply' || e.kind === 'reply_drafted') return 'replies';
  if (e.channel === 'email' && (e.kind === 'received' || e.kind === 'confirmed')) return 'receipts';
  if (e.channel === 'text' || e.kind === 'reminder_sent') return 'texts';
  return '';
}
// What that kind of message looks like. Wording only, no names or amounts: an example, labelled as one.
const SAMPLE = {
  order_alert: ['New order just came in.', 'Confirm'],
  received: ['Thanks! Your order arrived and is being prepared.', ''],
  received_email: ['Your receipt', ''],
  confirmed: ['Your order is confirmed. See you soon!', ''],
  confirmed_email: ['Your order is confirmed', ''],
  review_asked: ['How did we do? Leave us a review.', 'stars'],
  reminder_sent: ['Reminder: your booking is tomorrow.', ''],
  auto_reply: ['Thanks for your message! We will get back to you shortly.', ''],
  reply_drafted: ['Hi! Yes, we have availability this week.', 'draft'],
  ad_made: ['Fresh this week', 'ad'],
  page_built: ['Your business, online', 'page'],
};

// City -> [lng, lat]. An area matches by city name, or by a neighbourhood listed under that city.
const CITY = {
  Jerusalem: [35.21, 31.77], 'Tel Aviv': [34.78, 32.08], Haifa: [34.99, 32.79], Beersheba: [34.79, 31.25],
  Netanya: [34.86, 32.32], Ashdod: [34.65, 31.8], Ashkelon: [34.57, 31.67], 'Petah Tikva': [34.89, 32.09],
  'Rishon LeZion': [34.79, 31.96], 'Ramat Gan': [34.82, 32.07], Herzliya: [34.84, 32.16], Raanana: [34.87, 32.18],
  'Kfar Saba': [34.91, 32.18], Modiin: [35.01, 31.9], 'Beit Shemesh': [34.99, 31.75], Eilat: [34.95, 29.56],
  'Bnei Brak': [34.83, 32.08], Tiberias: [35.53, 32.79], Safed: [35.5, 32.96], Nahariya: [35.1, 33.01],
  Hadera: [34.92, 32.43], Rehovot: [34.81, 31.89], Holon: [34.78, 32.01], 'Bat Yam': [34.75, 32.02],
  'Maale Adumim': [35.3, 31.78], Acre: [35.08, 32.93], Caesarea: [34.9, 32.5], 'Zichron Yaakov': [34.95, 32.57],
};
function cityOf(area) {
  const a = (area || '').toLowerCase().trim();
  if (!a) return null;
  const hit = Object.keys(CITY).find((c) => a.startsWith(c.toLowerCase()) || a.includes(` ${c.toLowerCase()}`));
  if (hit) return hit;
  for (const g of LOCATION_OPTIONS) {
    if (CITY[g.city] && g.neighborhoods.some((n) => n.toLowerCase() === a)) return g.city;
  }
  return null;
}
// Plain projection onto a 100 x 230 box: Israel runs about 1.7 degrees wide and 3.9 tall.
const px = ([lng, lat]) => [((lng - 34.2) / 1.7) * 100, ((33.35 - lat) / 3.9) * 230];
const OUTLINE = [
  [35.1, 33.09], [35.2, 33.08], [35.35, 33.06], [35.5, 33.12], [35.57, 33.28], [35.62, 33.24], [35.65, 33.05],
  [35.63, 32.9], [35.65, 32.7], [35.57, 32.62], [35.55, 32.4], [35.52, 32.1], [35.55, 31.8], [35.47, 31.45],
  [35.42, 31.1], [35.38, 30.9], [35.25, 30.6], [35.15, 30.2], [35.05, 29.9], [34.98, 29.55], [34.9, 29.49],
  [34.85, 29.8], [34.7, 30.2], [34.55, 30.6], [34.4, 30.9], [34.25, 31.22], [34.35, 31.32], [34.48, 31.6],
  [34.65, 31.82], [34.75, 32.05], [34.82, 32.3], [34.88, 32.55], [34.95, 32.75], [35.0, 32.82], [35.07, 32.88],
  [35.08, 32.95],
].map((p) => px(p).map((v) => v.toFixed(1)).join(',')).join(' ');

function ago(at, lang) {
  const s = Math.max(0, (Date.now() - new Date(at).getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  if (s < 3600) return rtf.format(-Math.max(1, Math.round(s / 60)), 'minute');
  if (s < 86400) return rtf.format(-Math.round(s / 3600), 'hour');
  return rtf.format(-Math.round(s / 86400), 'day');
}

const SHOW = 5;
const MONO = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function Sample({ e }) {
  const { t } = useTranslation();
  const email = e.channel === 'email';
  const key = SAMPLE[`${e.kind}_${e.channel}`] ? `${e.kind}_${e.channel}` : e.kind;
  const [msg, extra] = SAMPLE[key] || ['', ''];
  if (!msg) return null;
  if (extra === 'ad' || extra === 'page') {
    const ad = extra === 'ad';
    return (
      <div className="w-[176px] sm:w-[210px] rounded-2xl p-3 text-[12.5px] leading-snug shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)]"
        style={{ background: '#FFFFFF', color: 'var(--ink, #111827)', fontFamily: 'var(--font-body, inherit)' }}>
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#666666' }}>
          {ad ? <Megaphone size={12} aria-hidden="true" /> : <Globe size={12} aria-hidden="true" />}
          {ad ? t('workForYou.sampleAd', 'Ad') : t('workForYou.samplePage', 'Web page')}
          <span className="ms-auto normal-case tracking-normal font-normal">{t('workForYou.sampleExample', 'example')}</span>
        </div>
        {ad ? (
          <div className="relative overflow-hidden rounded-lg p-3 text-white" style={{ background: 'linear-gradient(135deg, #0F5E8F, #167AB8 55%, #24AFEB)', aspectRatio: '4 / 3' }}>
            <p className="text-[15px] font-semibold leading-tight" style={{ fontFamily: 'var(--font-head)' }}>{t(`workForYou.sample.${key}`, msg)}</p>
            <div className="mt-2 h-1.5 w-2/3 rounded-full bg-white/50" aria-hidden="true" />
            <span className="absolute bottom-2.5 start-3 rounded-full bg-white px-2.5 py-0.5 text-[10px] font-semibold" style={{ color: '#111827' }}>
              {t('workForYou.sampleOrder', 'Order now')}
            </span>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border" style={{ borderColor: '#E3E3E3' }}>
            <div className="flex gap-1 px-2 py-1.5" style={{ background: '#F3F4F6' }} aria-hidden="true">
              {[0, 1, 2].map((n) => <span key={n} className="h-1.5 w-1.5 rounded-full" style={{ background: '#D1D5DB' }} />)}
            </div>
            <div className="p-2.5">
              <p className="font-semibold" style={{ fontFamily: 'var(--font-head)' }}>{t(`workForYou.sample.${key}`, msg)}</p>
              <div className="mt-2 h-10 rounded-md" style={{ background: 'rgba(36,175,235,0.18)' }} aria-hidden="true" />
              <div className="mt-2 h-1.5 w-3/4 rounded-full" style={{ background: '#E3E3E3' }} aria-hidden="true" />
            </div>
          </div>
        )}
      </div>
    );
  }
  const Icon = email ? Mail : MessageSquare;
  return (
    <div className="w-[176px] sm:w-[210px] rounded-2xl p-3 text-[12.5px] leading-snug shadow-[0_12px_32px_-8px_rgba(0,0,0,0.5)]"
      style={{ background: '#FFFFFF', color: 'var(--ink, #111827)', fontFamily: 'var(--font-body, inherit)' }}>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em]" style={{ color: '#666666' }}>
        <Icon size={12} aria-hidden="true" />
        {email ? t('workForYou.sampleEmail', 'Email') : t('workForYou.sampleText', 'Text message')}
        <span className="ms-auto normal-case tracking-normal font-normal">{t('workForYou.sampleExample', 'example')}</span>
      </div>
      {email ? (
        <div className="rounded-lg border p-2.5" style={{ borderColor: '#E3E3E3' }}>
          <p className="font-semibold">{t(`workForYou.sample.${key}`, msg)}</p>
          <div className="mt-2 space-y-1.5" aria-hidden="true">
            <div className="h-1.5 w-full rounded-full" style={{ background: '#E3E3E3' }} />
            <div className="h-1.5 w-3/4 rounded-full" style={{ background: '#E3E3E3' }} />
            <div className="h-1.5 w-1/2 rounded-full" style={{ background: '#E3E3E3' }} />
          </div>
          {extra === 'Confirm' && (
            <span className="mt-2.5 inline-block rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: '#000', color: '#fff' }}>
              {t('workForYou.sampleConfirm', 'Confirm')}
            </span>
          )}
        </div>
      ) : (
        <div className="rounded-2xl rounded-ss-sm px-3 py-2" style={{ background: '#F3F4F6' }}>
          {extra === 'draft' && (
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide" style={{ color: 'var(--brand-primary-dark, #0F5E8F)' }}>
              {t('workForYou.sampleDraft', 'Draft, ready to send')}
            </span>
          )}
          {t(`workForYou.sample.${key}`, msg)}
          {extra === 'Confirm' && (
            <span className="mt-2 block w-fit rounded-full px-3 py-1 text-[11px] font-semibold" style={{ background: '#000', color: '#fff' }}>
              {t('workForYou.sampleConfirm', 'Confirm')}
            </span>
          )}
          {extra === 'stars' && (
            <span className="mt-1.5 flex gap-0.5" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((n) => <Star key={n} size={13} fill="#F5B301" stroke="#F5B301" />)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

function IsraelMap({ cities, ping }) {
  return (
    <svg viewBox="-4 -4 108 238" className="pointer-events-none absolute inset-y-4 end-4 h-[calc(100%-2rem)] w-auto opacity-90" aria-hidden="true">
      <polygon points={OUTLINE} fill="rgba(36,175,235,0.06)" stroke="rgba(36,175,235,0.35)" strokeWidth="0.8" strokeLinejoin="round" />
      {cities.map((c) => {
        const [x, y] = px(CITY[c]);
        return <circle key={c} cx={x} cy={y} r="1.6" fill="rgba(229,231,235,0.55)" />;
      })}
      {ping && CITY[ping.city] && (() => {
        const [x, y] = px(CITY[ping.city]);
        return (
          <g key={ping.n}>
            <circle cx={x} cy={y} r="2.6" fill="#34D399" />
            <circle cx={x} cy={y} r="3" fill="none" stroke="#34D399" strokeWidth="1">
              <animate attributeName="r" from="3" to="16" dur="1.6s" repeatCount="2" />
              <animate attributeName="opacity" from="0.9" to="0" dur="1.6s" repeatCount="2" />
            </circle>
          </g>
        );
      })()}
    </svg>
  );
}

function useWork() {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    fetch(`${API}/site/work`).then((r) => (r.ok ? r.json() : null)).then((d) => setEvents((d && d.events) || [])).catch(() => {});
  }, []);
  return events;
}

export default function WorkForYou({ className = '', fill = false }) {
  const { t, i18n } = useTranslation();
  const reduced = useReducedMotion();
  const lang = (i18n.language || 'en').startsWith('he') ? 'he' : 'en';
  const events = useWork();
  // The newest few, played oldest first so each new line lands on top and the list ends newest-first.
  const play = useMemo(() => events.slice(0, SHOW).reverse(), [events]);
  const lines = useMemo(() => play.map((e) => {
    const words = WORDS[e.kind] || {};
    const key = e.channel in words ? e.channel : Object.keys(words)[0];
    if (key === undefined) return '';
    return [t(`workForYou.event.${e.kind}${key ? `_${key}` : ''}`, words[key]), e.area ? areaLabel(e.area, t) : '', ago(e.at, lang)].filter(Boolean).join(' · ');
  }), [play, t, lang]);
  const cities = useMemo(() => [...new Set(play.map((e) => cityOf(e.area)).filter(Boolean))], [play]);

  // k: the line being typed (lines 0..k-1 are done); shown: letters of line k so far. k === lines.length: all done.
  const [k, setK] = useState(0);
  const [shown, setShown] = useState(0);
  const [lit, setLit] = useState('');
  const [round, setRound] = useState(0);
  useEffect(() => { setK(reduced ? lines.length : 0); setShown(0); }, [lines, reduced]);
  useEffect(() => {
    if (!lines.length || reduced) return undefined;
    if (k >= lines.length) {
      // Hold the full list, then play it again from the top.
      const id = setTimeout(() => { setK(0); setShown(0); setRound((r) => r + 1); }, 7000);
      return () => clearTimeout(id);
    }
    if (shown < lines[k].length) {
      const id = setTimeout(() => setShown((n) => n + 1), 24);
      return () => clearTimeout(id);
    }
    setLit(jobOf(play[k]));
    const id = setTimeout(() => { setK((n) => n + 1); setShown(0); }, 2600);
    return () => clearTimeout(id);
  }, [k, shown, lines, play, reduced]);
  useEffect(() => {
    if (!lit) return undefined;
    const id = setTimeout(() => setLit(''), 2200);
    return () => clearTimeout(id);
  }, [lit]);

  const current = !reduced && k < play.length ? play[k] : null;
  const typedDone = current && shown >= (lines[k] || '').length;
  const visible = lines.slice(0, reduced ? lines.length : Math.min(k + 1, lines.length));

  return (
    <div className={`${fill ? 'flex min-h-0 flex-1 flex-col' : ''} ${className}`} data-testid="work-for-you">
      {lines.length > 0 && (
        <div
          className={`relative overflow-hidden rounded-2xl ${fill ? 'min-h-[300px] flex-1' : 'h-[380px]'}`}
          dir="auto"
          style={{ background: 'var(--ink, #111827)', color: '#E5E7EB', fontFamily: MONO }}
          data-testid="work-live-line"
        >
          <IsraelMap cities={cities} ping={current && typedDone ? null : current && { city: cityOf(current.area), n: `${round}-${k}` }} />
          <div className="relative flex h-full flex-col p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: '#9CA3AF' }}>
              <span className="relative flex h-2 w-2" aria-hidden="true">
                {!reduced && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: '#34D399' }} />}
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#34D399' }} />
              </span>
              {t('workForYou.streamTitle', 'Live: done for businesses on the site')}
            </div>
            <span className="sr-only">{t('workForYou.liveLabel', 'Just done for a business on MyIsraelRental:')} {lines.join('. ')}</span>
            {/* Newest on top: the line being typed is first, the finished ones below it, fading with age. */}
            <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden text-[13px] leading-snug max-w-[78%] [mask-image:linear-gradient(to_bottom,#000_75%,transparent)]" aria-hidden="true">
              {visible.map((line, idx) => idx).reverse().map((idx, pos) => (
                <motion.li
                  key={`${round}-${idx}`}
                  layout={!reduced}
                  initial={reduced ? false : { opacity: 0, y: -8 }}
                  animate={{ opacity: Math.max(0.35, 1 - pos * 0.17), y: 0 }}
                  transition={{ duration: 0.35 }}
                >
                  <span style={{ color: '#9CA3AF' }}>&gt; </span>
                  {idx === k && !reduced ? lines[idx].slice(0, shown) : lines[idx]}
                  {idx === k && !reduced && <span className="animate-pulse" style={{ color: '#9CA3AF' }}>▍</span>}
                </motion.li>
              ))}
            </ul>
            {/* The bottom band always keeps room for the example, so it never lands on the lines above. */}
            <div className="flex min-h-[132px] shrink-0 items-end justify-between gap-3 pt-3">
              <div className="flex items-center gap-2 text-[13px] font-semibold" style={{ color: '#7DD3FC' }} data-testid="work-next-you">
                <span style={{ color: '#9CA3AF' }}>&gt;</span>
                {t('workForYou.nextYou', 'Next: your business')}
                <span className={reduced ? '' : 'animate-pulse'}>▍</span>
              </div>
              <AnimatePresence>
                {current && typedDone && (
                  <motion.div
                    key={`${round}-${k}`}
                    className="relative z-10 shrink-0"
                    initial={{ opacity: 0, y: 12, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    aria-hidden="true"
                  >
                    <Sample e={current} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
      <div className="mt-4 shrink-0">
        <p className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-primary-dark, #0F5E8F)' }}>
          {t('workForYou.title', 'For your business, MyIsraelRental')}
        </p>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm" style={{ color: 'var(--ink, #111827)' }}>
          {JOBS.map(([key, en]) => (
            <li key={key} className="flex items-start gap-1.5 rounded-md px-1 -mx-1 transition-colors duration-500"
              style={{ background: lit === key ? 'rgba(36,175,235,0.18)' : 'transparent' }} data-lit={lit === key || undefined}>
              <Check size={15} className="mt-0.5 shrink-0 transition-transform duration-500" aria-hidden="true"
                style={{ color: 'var(--brand-primary, #167AB8)', transform: lit === key ? 'scale(1.35)' : 'none' }} />
              <span>{t(`workForYou.job.${key}`, en)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
