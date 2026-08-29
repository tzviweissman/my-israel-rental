/**
 * The three self-playing cards on /why-list.
 *
 * All the machinery — play-on-scroll, finished-by-default, reduced
 * motion — lives in DemoCard.jsx. These are only the mock UIs and the
 * copy, so a fourth card is a small addition rather than a fourth copy
 * of the decisions.
 *
 * NO NUMBERS ANYWHERE IN HERE, including dates. Not "Tue 2 Sep", not
 * "3 services", not a rating. Every figure a user sees comes from the
 * database; these are illustrations, and they sit in the most persuasive
 * position on the page. `scripts/check-get-found-card.mjs` fails on any
 * digit inside a card, which is why the booking card says "tomorrow
 * morning" rather than a date.
 */
import { useTranslation } from 'react-i18next';
import {
  Search, MapPin, Check, MessageSquare, Calendar, Image as ImageIcon,
} from 'lucide-react';
import DemoCard, { useBeats } from './DemoCard';

/** A grey placeholder line — the shape of content, never its content. */
const Bar = ({ w = '60%', mt = 0 }) => (
  <span
    className="block h-2 rounded-full"
    style={{ background: 'var(--brand-border)', width: w, marginTop: mt }}
  />
);

const rowStyle = (visible, lift = 6) => ({
  background: 'var(--surface)',
  border: '1px solid var(--brand-border)',
  opacity: visible ? 1 : 0,
  transform: visible ? 'none' : `translateY(${lift}px)`,
});

// --------------------------------------------------------------------------
// 1. Get found
// --------------------------------------------------------------------------

export function GetFoundCard() {
  const { t } = useTranslation();
  const { ref, shown, at } = useBeats(4);

  return (
    <DemoCard
      innerRef={ref}
      beat={shown}
      testid="get-found-card"
      title={t('whyList.getFoundTitle', 'Get found by people already looking')}
      body={t('whyList.getFoundBody',
        'Someone searches for what you do, in the area you work, and your business is one of the answers. No ads, no commission.')}
    >
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--brand-border)' }}
        data-testid="get-found-query"
      >
        <Search size={15} style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
        <span className="text-sm" dir="auto" style={{ color: at(1) ? 'var(--ink)' : 'var(--brand-muted)' }}>
          {at(1) ? t('whyList.getFoundQuery', 'cleaner in Jerusalem') : ' '}
        </span>
        {!at(1) && <span aria-hidden="true" className="gf-caret" style={{ background: 'var(--brand-primary)' }} />}
      </div>

      <div className="space-y-2" data-testid="get-found-results">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="rounded-xl px-3 py-2.5 flex items-center gap-3 gf-row"
            style={{ ...rowStyle(at(2)), transitionDelay: `${i * 70}ms` }}
          >
            <span className="w-7 h-7 rounded-lg shrink-0" style={{ background: 'var(--brand-border)' }} />
            <span className="flex-1"><Bar w="58%" /><Bar w="34%" mt={6} /></span>
          </div>
        ))}

        {/* Theirs. No rank, no count — a card in a list, not a claim
            about position. */}
        <div
          className="rounded-xl px-3 py-2.5 flex items-center gap-3 gf-row"
          style={{
            ...rowStyle(at(3), 8),
            border: '1.5px solid var(--gold)',
            boxShadow: at(3) ? '0 6px 18px -8px rgba(35,32,27,.28)' : 'none',
          }}
          data-testid="get-found-yours"
        >
          <span
            className="w-7 h-7 rounded-lg shrink-0 inline-flex items-center justify-center"
            style={{ background: 'var(--gold)', color: 'var(--ink)' }}
          >
            <Check size={14} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
              {t('whyList.getFoundYours', 'Your business')}
            </span>
            <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--brand-muted)' }}>
              <MapPin size={11} aria-hidden="true" />
              {t('whyList.getFoundArea', 'Jerusalem')}
            </span>
          </span>
        </div>
      </div>
    </DemoCard>
  );
}

// --------------------------------------------------------------------------
// 2. Bookings
// --------------------------------------------------------------------------

export function TakeBookingsCard() {
  const { t } = useTranslation();
  const { ref, shown, at } = useBeats(4);

  return (
    <DemoCard
      innerRef={ref}
      beat={shown}
      flip
      testid="take-bookings-card"
      title={t('whyList.bookingsTitle', 'Take bookings without a phone call')}
      body={t('whyList.bookingsBody',
        'A request arrives with what they need and when. You accept it, and it is in your calendar — no missed call, no chasing.')}
    >
      {/* The request. Arrives, then is answered — the whole point is that
          nothing was dialled. */}
      <div
        className="rounded-xl px-3 py-3 gf-row"
        style={rowStyle(at(1), 8)}
        data-testid="bookings-request"
      >
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-7 h-7 rounded-lg shrink-0 inline-flex items-center justify-center"
            style={{ background: 'rgb(var(--brand-primary-rgb) / 0.12)', color: 'var(--brand-primary)' }}
          >
            <MessageSquare size={14} aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {t('whyList.bookingsNew', 'New request')}
          </span>
        </div>
        <Bar w="82%" />
        <Bar w="46%" mt={6} />
        <div className="flex items-center gap-1.5 mt-2.5 text-[11px]" style={{ color: 'var(--brand-muted)' }}>
          <Calendar size={11} aria-hidden="true" />
          {t('whyList.bookingsWhen', 'Tomorrow morning')}
        </div>
      </div>

      {/* Accept, then accepted. Two beats rather than one so the reader
          sees a decision being made, not a state that was always there. */}
      <div className="mt-3 flex items-center gap-2">
        <span
          className="px-3 py-1.5 rounded-full text-xs font-semibold gf-row"
          style={{
            background: at(3) ? 'var(--gold)' : 'var(--brand-primary)',
            color: at(3) ? 'var(--ink)' : '#fff',
            opacity: at(2) ? 1 : 0,
            transform: at(2) ? 'none' : 'translateY(6px)',
          }}
          data-testid="bookings-accept"
        >
          {at(3)
            ? t('whyList.bookingsAccepted', 'Booked')
            : t('whyList.bookingsAccept', 'Accept')}
        </span>
        {at(3) && (
          <span className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--brand-muted)' }}>
            <Check size={12} aria-hidden="true" />
            {t('whyList.bookingsInCalendar', 'In your calendar')}
          </span>
        )}
      </div>
    </DemoCard>
  );
}

// --------------------------------------------------------------------------
// 3. Your own page
// --------------------------------------------------------------------------

export function LivePageCard() {
  const { t } = useTranslation();
  const { ref, shown, at } = useBeats(4);

  return (
    <DemoCard
      innerRef={ref}
      beat={shown}
      testid="live-page-card"
      title={t('whyList.pageTitle', 'A page of your own, without building one')}
      body={t('whyList.pageBody',
        'Your services, your area and your photos on a page you can send to anyone — or print as a QR code. It is made from what you already filled in.')}
    >
      {/* A browser frame that assembles itself. No time claim in the copy
          and no digits in here — "ten minutes" would be a promise nobody
          measured. */}
      <div
        className="rounded-xl overflow-hidden"
        style={{ border: '1px solid var(--brand-border)', background: 'var(--surface)' }}
        data-testid="live-page-frame"
      >
        <div
          className="flex items-center gap-1.5 px-3 py-2"
          style={{ background: 'var(--bg)', borderBottom: '1px solid var(--brand-border)' }}
        >
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full" style={{ background: 'var(--brand-border)' }} />
          ))}
          <span
            className="ms-2 flex-1 h-3 rounded-full gf-row"
            style={{ background: 'var(--brand-border)', opacity: at(1) ? 1 : 0 }}
          />
        </div>

        <div className="p-3">
          {/* cover */}
          <span
            className="block rounded-lg gf-row"
            style={{
              height: 56,
              background: 'rgb(var(--brand-primary-rgb) / 0.10)',
              opacity: at(1) ? 1 : 0,
              transform: at(1) ? 'none' : 'translateY(6px)',
            }}
          >
            <span className="h-full w-full flex items-center justify-center">
              <ImageIcon size={16} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
            </span>
          </span>

          {/* name + area */}
          <span
            className="block mt-2.5 gf-row"
            style={{ opacity: at(2) ? 1 : 0, transform: at(2) ? 'none' : 'translateY(6px)' }}
          >
            <span className="block text-sm font-semibold" style={{ color: 'var(--ink)' }} dir="auto">
              {t('whyList.getFoundYours', 'Your business')}
            </span>
            <span className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--brand-muted)' }}>
              <MapPin size={11} aria-hidden="true" />
              {t('whyList.getFoundArea', 'Jerusalem')}
            </span>
          </span>

          {/* the services, arriving last */}
          <span className="block mt-2.5 space-y-1.5">
            {[0, 1].map((i) => (
              <span
                key={i}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 gf-row"
                style={{
                  border: '1px solid var(--brand-border)',
                  opacity: at(3) ? 1 : 0,
                  transform: at(3) ? 'none' : 'translateY(6px)',
                  transitionDelay: `${i * 80}ms`,
                }}
              >
                <span className="w-5 h-5 rounded shrink-0" style={{ background: 'var(--brand-border)' }} />
                <Bar w={i === 0 ? '52%' : '38%'} />
              </span>
            ))}
          </span>
        </div>
      </div>
    </DemoCard>
  );
}
