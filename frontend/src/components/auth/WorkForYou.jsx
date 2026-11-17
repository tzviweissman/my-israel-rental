/**
 * What MyIsraelRental does for a business, in its own card under the sign-up card (Tzvi, 12 Nov 2026, from
 * polsia.com; 16 Nov 2026: "put the stream under the sign-up card", AuthShell's `below`).
 *
 *  - a stream of real work, typed out like a terminal, newest first: the texts and emails the site sent, its instant
 *    replies, the replies it drafted, the ads businesses kept and the pages and websites built for them
 *    (GET /api/site/work, routes/site_visits.py). Nothing names anyone: the kind of work and the business's area. With
 *    too little to show the server sends nothing and the stream is left out: never invented, never repeated.
 *  - as each line lands, a small example of what that kind of work looks like (marked as an example: the real
 *    message is private), and the matching job in the list below lights up. No map: nothing tied to one country,
 *    since the site will open in America (Tzvi, 16 Nov 2026).
 *  - the last row waits for the visitor: "Next: your business".
 *  - every job in one list, each one a feature the site has today.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Check, Globe, Mail, Megaphone, MessageSquare, Star } from 'lucide-react';
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
  ad_made: { '': 'Made an ad for a business' },
  page_built: { '': "Built a business's page and put it live" },
  site_built: { '': 'Built a business its own website' },
};
// Which job in the list an event proves.
function jobOf(e) {
  if (e.kind === 'review_asked') return 'reviews';
  if (e.kind === 'ad_made') return 'ads';
  if (e.kind === 'page_built' || e.kind === 'site_built') return 'page';
  if (e.kind === 'auto_reply' || e.kind === 'reply_drafted') return 'replies';
  if (e.channel === 'email' && (e.kind === 'received' || e.kind === 'confirmed')) return 'receipts';
  if (e.channel === 'text' || e.kind === 'reminder_sent') return 'texts';
  return '';
}
// What that kind of message looks like. Wording only, no names or amounts: an example, labelled as one.
const SAMPLE = {
  order_alert: ['New order just came in.', 'Confirm'],
  received: ['Thanks. Your order arrived and is being prepared.', ''],
  received_email: ['Your receipt', ''],
  confirmed: ['Your order is confirmed. See you soon.', ''],
  confirmed_email: ['Your order is confirmed', ''],
  review_asked: ['How did we do? Leave us a review.', 'stars'],
  reminder_sent: ['Reminder: your booking is tomorrow.', ''],
  auto_reply: ['Thanks for your message. We will get back to you shortly.', ''],
  reply_drafted: ['Hi, yes, we have availability this week.', 'draft'],
  ad_made: ['Fresh this week', 'ad'],
  page_built: ['Your business, online', 'page'],
  site_built: ['Your business, online', 'page'],
};

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

function useWork() {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    fetch(`${API}/site/work`).then((r) => (r.ok ? r.json() : null)).then((d) => setEvents((d && d.events) || [])).catch(() => {});
  }, []);
  return events;
}

export default function WorkForYou({ className = '' }) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const events = useWork();
  // The newest few, newest typed first (Tzvi, 16 Nov 2026: "it should start with things that are the most recent").
  const play = useMemo(() => events.slice(0, SHOW), [events]);
  const lines = useMemo(() => play.map((e) => {
    const words = WORDS[e.kind] || {};
    const key = e.channel in words ? e.channel : Object.keys(words)[0];
    if (key === undefined) return '';
    // No "how long ago": a line from 12 hours ago next to one from 2 days ago made the site look quiet (Tzvi, 16 Nov
    // 2026). The server only sends the last WORK_DAYS days, newest first.
    return [t(`workForYou.event.${e.kind}${key ? `_${key}` : ''}`, words[key]), e.area ? areaLabel(e.area, t) : ''].filter(Boolean).join(' · ');
  }), [play, t]);

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
    <div className={className} data-testid="work-for-you">
      {lines.length > 0 && (
        <div
          className="relative h-[340px] overflow-hidden rounded-xl"
          dir="auto"
          style={{ background: 'var(--ink, #111827)', color: '#E5E7EB', fontFamily: MONO }}
          data-testid="work-live-line"
        >
          <div className="relative flex h-full flex-col p-4 sm:p-5">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em]" style={{ color: '#9CA3AF' }}>
              <span className="relative flex h-2 w-2" aria-hidden="true">
                {!reduced && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: '#34D399' }} />}
                <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: '#34D399' }} />
              </span>
              {t('workForYou.streamTitle', 'Lately, for businesses on the site')}
            </div>
            <span className="sr-only">{t('workForYou.liveLabel', 'Just done for a business on MyIsraelRental:')} {lines.join('. ')}</span>
            {/* Newest on top, typed first; each older one is typed in below it, fading with age. */}
            <ul className="mt-3 flex min-h-0 flex-1 flex-col gap-2 overflow-hidden text-[13px] leading-snug [mask-image:linear-gradient(to_bottom,#000_75%,transparent)]" aria-hidden="true">
              {visible.map((line, idx) => idx).map((idx, pos) => (
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
