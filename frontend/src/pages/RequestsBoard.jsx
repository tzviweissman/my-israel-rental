/**
 * RequestsBoard — the demand board at /requests.
 *
 * The inverse of /stays and /services: seekers post what they are looking
 * for, and owners/providers browse it. Structure cloned from JobsBoard —
 * URL-driven filters via useSearchParams so a filtered board is a
 * shareable link and the back button behaves.
 *
 * Public: anyone can read the board. Posting and contacting require an
 * account, which is what stops it being scraped for leads.
 *
 * Cards carry a poster block — shortened name, verified badge,
 * member-since — because identity drives response rate: an owner is far
 * likelier to answer a named, verified human than an anonymous card.
 *
 * That is IDENTITY, not contact. No phone, no email, no full surname, no
 * avatar, and no route to the person outside the existing chat flow. The
 * mockup's avatar is deliberately not rendered: the only photo on a user
 * is their Google `picture`, which today appears solely in the
 * self-facing "Continue as" banner and is therefore not an already-public
 * avatar. See `_poster_identity` in routes/marketplace/requests.py.
 */
import React, { useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { saveReturnPath } from '../hooks/useBackNavigation';
import { useTranslation } from 'react-i18next';
import RecentSearchesPanel from '../components/search/RecentSearchesPanel';
import Numerals from '../components/common/Numerals';
import { recordSearch } from '../utils/recentSearches';
import { toast } from 'sonner';
import formatDate from '../utils/formatDate';
import {
  Home, Wrench, LayoutGrid, MapPin, Coins, BedDouble, CalendarDays, ShieldCheck,
  Clock, MessageCircle, Loader2, Search, Plus, Users, Sparkles, KeyRound, ExternalLink,
  Map as MapIcon, Package,
} from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import RequestsMapView from '../components/requests/RequestsMapView';
import HeroBand from '../components/common/HeroBand';
import ListingsUnavailable from '../components/common/ListingsUnavailable';
import LightUpStreet from '../components/common/LightUpStreet';
import SITE_ASSETS from '../lib/siteAssets';

const BAND_IMAGE = SITE_ASSETS['scene8-requests-man'];

// Which side of the market. The board carries both now: seekers asking and
// owners/pros offering. This is a separate axis from rental-vs-service, so
// it gets its own row of tabs rather than being folded into TYPES — a
// combined list would need six entries and read as a menu.
const SIDES = [
  { key: '', labelKey: 'requests.sideAll', fallback: 'Everything', Icon: LayoutGrid },
  { key: 'want', labelKey: 'requests.sideWant', fallback: 'Requests', Icon: Search },
  { key: 'have', labelKey: 'requests.sideHave', fallback: 'Posts', Icon: KeyRound },
];

const TYPES = [
  { key: '', labelKey: 'requests.typeAll', fallback: 'All', Icon: LayoutGrid },
  { key: 'rental', labelKey: 'requests.typeRental', fallback: 'Rentals', Icon: Home },
  // Labelled by SIDE, not by one fixed word. The nav calls this
  // "Businesses" and this chip called it "Services", which is the same
  // thing named two ways one row apart. But the board has two sides and
  // they genuinely differ: a POST of this type is a business offering
  // something, while a REQUEST of this type is someone who needs a
  // service — "Businesses" would be the wrong noun for "I need a
  // plumber". So supply and the mixed view follow the nav, and the
  // demand side keeps the word that fits it.
  {
    key: 'service',
    labelKey: 'requests.typeService',
    fallback: 'Businesses',
    wantLabelKey: 'requests.typeServiceWant',
    wantFallback: 'Services',
    Icon: Wrench,
  },
  // N4. Items are on this board and not in the marketplace: one person
  // selling one sofa has no repeat supply and no meaningful review, and
  // needs a `sold` state a business listing does not have.
  { key: 'item', labelKey: 'requests.typeItem', fallback: 'Items', Icon: Package },
];

/** Days until an ISO timestamp, floored at 0. Null when unparseable. */
const daysUntil = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso) - new Date();
  return Number.isNaN(ms) ? null : Math.max(0, Math.ceil(ms / 86400000));
};

const money = (amount, currency) => {
  if (!amount) return null;
  const sym = currency === 'USD' ? '$' : '₪';
  return `${sym}${Number(amount).toLocaleString()}`;
};

export const RequestCard = ({ request: r, onOpen, t }) => {
  const isRental = r.request_type === 'rental';
  const isItem = r.request_type === 'item';
  const isSold = r.item_status === 'sold';
  // Supply-side post. Everything user-facing on this card has to follow it:
  // an "Available" post is not a request, and calling its poster a seeker
  // would be plainly wrong to the person reading it.
  const isOffer = r.post_kind === 'have';
  const expiresIn = daysUntil(r.expires_at);
  const budget = money(r.budget_amount, r.budget_currency);

  return (
    /* A ROW, NOT A CARD.
       Three equal cards side by side is the most generic shape a list of
       anything can take, and it fought this content in particular: the
       requests are different lengths, so the middle card stood taller
       than its neighbours and the row stopped lining up at all.
       Demand also reads differently from merchandise. People scan a list
       of what others are asking for; they do not browse it. A row puts
       the type, the ask and who is asking on one line, so ten of them can
       be taken in at a glance instead of three. */
    <article
      className="grid gap-x-5 gap-y-2 py-5 items-start cursor-pointer
                 sm:grid-cols-[auto_minmax(0,1fr)_260px]
                 hover:bg-[rgb(var(--brand-primary-rgb)/0.03)] transition-colors"
      style={{ borderBottom: '1px solid var(--brand-border)' }}
      role="button"
      tabIndex={0}
      onClick={() => onOpen(r.id)}
      onKeyDown={(e) => { if (e.key === 'Enter') onOpen(r.id); }}
      data-testid={`request-card-${r.id}`}
    >
      <div className="flex sm:flex-col items-center sm:items-start gap-2 sm:pt-0.5">
        {/* Which side of the market, stated before what it is about. A
            reader scanning the board needs to know "someone is offering"
            versus "someone is asking" before anything else on the card. */}
        <span className={`rc-badge ${isOffer ? 'rc-badge-offer' : 'rc-badge-want'}`}>
          {isOffer ? <KeyRound size={11} aria-hidden="true" /> : <Search size={11} aria-hidden="true" />}
          {isOffer ? t('requests.badgeHave', 'Post') : t('requests.badgeWant', 'Request')}
        </span>
        <span className={`rc-badge ${isItem ? 'rc-badge-item' : isRental ? 'rc-badge-rental' : 'rc-badge-service'}`}>
          {isItem ? <Package size={11} aria-hidden="true" />
            : isRental ? <Home size={11} aria-hidden="true" />
              : <Wrench size={11} aria-hidden="true" />}
          {isItem ? t('requests.item', 'Item')
            : isRental ? t('requests.rental', 'Rental')
              : t('requests.service', 'Service')}
        </span>
        {/* Sold stays ON the board rather than disappearing (it is out of
            the default view, but a shared link still resolves). A buyer
            who arrives late is better served by this than by a 404. */}
        {isSold && (
          <span className="rc-badge rc-badge-sold" data-testid={`request-sold-${r.id}`}>
            {t('requests.soldBadge', 'Sold')}
          </span>
        )}
        <span className="text-[11px] font-semibold" style={{ color: 'var(--brand-muted)' }}>
          {isItem
            ? t(`requests.condition_${r.condition}`, (r.condition || '').replace(/-/g, ' '))
            : isRental ? (r.rental_kind || '') : (r.category || '').replace(/-/g, ' ')}
        </span>
      </div>

      <div className="min-w-0 flex gap-4">
      {/* An item's photo, in the row rather than above it. The row layout
          exists because demand is SCANNED, not browsed, and a full-width
          image per post would turn ten scannable lines into ten cards
          again. A thumbnail beside the title is enough to tell a sofa
          from a fridge, which is all the photo has to do here.

          Items only: a request for a plumber has no photo and a blank
          square in its place would read as a broken image. */}
      {isItem && (r.photos || []).length > 0 && (
        <img
          src={r.photos[0]}
          alt=""
          loading="lazy"
          className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover shrink-0"
          style={{ background: 'var(--bg)', opacity: isSold ? 0.55 : 1 }}
          data-testid={`request-card-photo-${r.id}`}
        />
      )}
      <div className="min-w-0 flex-1">
      {/* C6 — two lines, then ellipsis. Titles run to 140 characters and
          an unclamped one took three lines on a phone, which pushes the
          chips and the status row down and makes rows of wildly different
          heights out of what should scan as a list. `title` carries the
          full text for anyone who wants it without opening the post. */}
      <h3
        className="text-[17px] font-semibold mb-1.5 rc-title"
        style={{ color: 'var(--ink)' }}
        title={r.title}
      >
        {r.title}
      </h3>

      <div className="rc-chips">
        {r.area && (
          <span className="rc-chip rc-chip-key">
            <MapPin size={12} aria-hidden="true" />{r.area}
          </span>
        )}
        {/* The same field means opposite things on the two sides of this
            board. On a wanted post `bedrooms_min` is a floor and the money
            is a ceiling; on an offer the flat has exactly that many rooms
            and that is the rent being asked. Rendering the wanted wording
            for both put "3+ bd" and "up to 6,000" on a three-room flat
            offered at 6,000, which reads as a seeker's advert. */}
        {isRental && r.bedrooms_min > 0 && (
          <span className="rc-chip">
            <BedDouble size={12} aria-hidden="true" />
            {isOffer
              ? t('requests.bedroomsAvail', '{{n}} bd', { n: r.bedrooms_min })
              : t('requests.bedroomsMin', '{{n}}+ bd', { n: r.bedrooms_min })}
          </span>
        )}
        {budget && (
          <span className="rc-chip rc-chip-key">
            <Coins size={12} aria-hidden="true" />
            {isOffer
              ? t('requests.asking', 'asking {{amount}}', { amount: budget })
              : t('requests.upTo', 'up to {{amount}}', { amount: budget })}
          </span>
        )}
        {/* C3 — "Flexible" is information, so it gets a chip of its own.
            Showing nothing would make a flexible seeker look identical to
            one who simply never answered, and those are opposite signals
            to an owner deciding whether to reply. `before` is prefixed so
            a deadline does not read as a fixed date. */}
        {r.listing_id && (
          <a
            href={`/property/${r.listing_id}`}
            className="rc-chip rc-chip-link"
            onClick={(e) => e.stopPropagation()}
            data-testid="request-listing-link"
          >
            <ExternalLink size={12} aria-hidden="true" />
            {t('requests.viewListing', 'View the listing')}
          </a>
        )}
        {r.date_mode === 'flexible' ? (
          <span className="rc-chip">
            <Sparkles size={12} aria-hidden="true" />
            {t('requests.dateFlexible', "I'm flexible")}
          </span>
        ) : (r.move_in_date || r.preferred_date) ? (
          <span className="rc-chip">
            <CalendarDays size={12} aria-hidden="true" />
            {/* An offer's date is always the day the place comes free, so
                it always takes "from" — a bare date there is ambiguous
                between "available then" and "must go by then", which are
                opposite meanings to someone deciding whether to enquire.
                A seeker's date only takes "by" when they set a deadline. */}
            {isOffer
              ? t('requests.dateFromPrefix', 'from {{date}}', { date: formatDate(r.move_in_date || r.preferred_date) })
              : r.date_mode === 'before'
                ? t('requests.dateByPrefix', 'by {{date}}', { date: formatDate(r.move_in_date || r.preferred_date) })
                : formatDate(r.move_in_date || r.preferred_date)}
          </span>
        ) : null}
      </div>

        {/* The clamp lives in .rc-note, not here — two rules claiming the
            same property is what let them disagree in the first place. */}
        {r.description && <p className="rc-note">{r.description}</p>}
      </div>
      </div>

      {/* Who is asking. Identity, not contact — a shortened name, a
          verified badge and a joined year, all derived server-side. It is
          load-bearing for response rate: an owner is far likelier to
          answer a named, verified human than an anonymous card. There is
          no avatar and no way to reach them from here; chat is the only
          channel. */}
      {/* Right-hand column: who is asking, how long is left, and the one
          action. Grouped so the eye can run down a single edge. */}
      <div className="sm:text-right sm:min-w-[190px] flex flex-col sm:items-end gap-2">
      {/* Always rendered, even with nothing in it. Not every poster
          resolves to a display name, and when this line appeared on some
          rows and not others it shoved their status row and button 27px
          down the row — a column of buttons at ragged heights. An empty
          slot of a fixed height costs one line of space and buys a
          straight edge. */}
      <div className="rc-poster rc-poster-slot !mt-0 !pt-0 !border-0" data-testid={`request-poster-${r.id}`}>
        {r.poster_display_name && (
          <>
          <span className="rc-poster-name">{r.poster_display_name}</span>
          {r.poster_verified && (
            <span className="rc-verified" title={t('requests.verifiedHint', 'Email verified')}>
              <ShieldCheck size={11} aria-hidden="true" />
              {t('requests.verified', 'Verified')}
            </span>
          )}
            {r.poster_member_since && (
              <span className="rc-poster-since">
                {t('requests.memberSince', 'Member since {{year}}', { year: r.poster_member_since })}
              </span>
            )}
          </>
        )}
      </div>

      <div className="rc-foot !mt-0 !pt-0 !border-0 flex-col sm:items-end gap-2">
        <span className="rc-status">
          <span className="dot" aria-hidden="true" />
          {t('requests.open', 'Open')}
          {/* C1 — the response count. Airtasker shows it and it is the
              strongest signal a two-sided board has: a board that looks
              alive attracts the supply side, who are the ones deciding
              whether this place is worth checking again.

              Only when it is above zero. "0 responses" is a true fact that
              argues against the request, and every board starts there — it
              would be attached to every new post at the exact moment it
              does the most damage. `> 0` rather than truthiness because 0
              is a number React renders happily. */}
          {r.contact_count > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <Users size={12} aria-hidden="true" />
              <span className="rc-responses">
                {r.contact_count === 1
                  ? t('requests.responsesOne', '1 response')
                  : t('requests.responses', '{{n}} responses', { n: r.contact_count })}
              </span>
            </>
          )}
          {expiresIn != null && (
            <>
              <span aria-hidden="true">·</span>
              <Clock size={12} aria-hidden="true" />
              {/* "expires in 1 days" reads as broken, and the Hebrew was
                  worse - "1 ימים" is not a thing anyone writes. Both
                  languages have a shorter, better word for it.
                  This was a hand-written ternary that only THIS call site
                  had, so the dashboard tab and the detail page still said
                  "1 days"; it is a real plural key now and all three read
                  from it. */}
              {t('requests.expiresIn', 'expires in {{count}} days', { count: expiresIn })}
            </>
          )}
        </span>
        <div className="flex items-center gap-2">
          {/* Only when the poster opted in. The href is our own tracked
              redirect, not a wa.me link — the number is never in this
              payload, so the board cannot leak it to a scraper, and the
              click gets counted on the way past.
              stopPropagation because the whole row is a click target and
              this goes somewhere else entirely. */}
          {r.whatsapp_available && (
            <a
              href={`${API}/marketplace/requests/${encodeURIComponent(r.id)}/contact-whatsapp`
                + `?text=${encodeURIComponent(isOffer
                  ? t('requests.waPrefillOffer', 'Hi! I saw your post on the MyIsraelRental marketplace.')
                  : t('requests.waPrefillRequest', 'Hi! I saw your request on the MyIsraelRental marketplace.'))}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="btn btn-whatsapp inline-flex items-center gap-1.5 !py-2 !px-3.5 !text-[13px]"
              data-testid={`request-whatsapp-${r.id}`}
            >
              <MessageCircle size={13} aria-hidden="true" />
              {t('requests.messageWhatsapp', 'WhatsApp')}
            </a>
          )}
          <span className="btn-blue-solid inline-flex items-center gap-1.5 !py-2 !px-4 !text-[13px]">
            <MessageCircle size={13} aria-hidden="true" />
            {isOffer
              ? t('requests.messageOwner', 'Message owner')
              : t('requests.messageSeeker', 'Message seeker')}
          </span>
        </div>
      </div>
      </div>
    </article>
  );
};

const RequestsBoard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  // Kept separate from "no results", the same lesson as /stays: a failed
  // fetch and an empty board need different advice.
  const [loadError, setLoadError] = useState(false);
  const [qDraft, setQDraft] = useState(searchParams.get('q') || '');
  // Suggestions are only offered while the field has focus and is empty:
  // once someone is typing, their own half-written query is a better guide
  // than last week's, and a panel over the results is just in the way.
  const [qFocused, setQFocused] = useState(false);
  const [recentKey, setRecentKey] = useState(0);

  const type = searchParams.get('type') || '';
  const side = searchParams.get('side') || '';
  // C5 — list or map. In the URL like the other filters, so a map view of
  // one neighbourhood is a link someone can send to a colleague.
  const view = searchParams.get('view') === 'map' ? 'map' : 'list';
  const area = searchParams.get('area') || '';
  const q = searchParams.get('q') || '';

  const patchUrl = useCallback((patch) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      Object.entries(patch).forEach(([k, v]) => {
        if (v) next.set(k, v); else next.delete(k);
      });
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  // Defined after patchUrl on purpose: a useCallback that closes over a
  // `const` declared further down hits the temporal dead zone and takes
  // the whole page to the error boundary on first render.
  const runSearch = React.useCallback((value) => {
    const clean = String(value ?? '').trim();
    setQDraft(clean);
    patchUrl({ q: clean });
    // Recorded on COMMIT, not per keystroke — otherwise the history fills
    // with every prefix of one word.
    if (clean) { recordSearch('requests', clean); setRecentKey((k) => k + 1); }
    setQFocused(false);
  }, [patchUrl]);

  useEffect(() => {
    setLoading(true);
    const params = {};
    if (type) params.request_type = type;
    if (side) params.post_kind = side;
    if (area) params.area = area;
    if (q) params.q = q;
    axios.get(`${API}/marketplace/requests`, { params })
      .then((r) => { setRequests(r.data || []); setLoadError(false); })
      .catch(() => { setRequests([]); setLoadError(true); })
      .finally(() => setLoading(false));
  }, [type, side, area, q]);

  const openRequest = (id) => navigate(`/requests/${id}`);

  // C4 — everyone goes straight to the wizard, signed in or not. The
  // account is asked for at the last step, once they can see what it is
  // for. Posting still requires one; only the timing of the ask changed.
  const postHref = '/requests/post';

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="requests-board-page">
      <PageMeta
        title="Housing & services requests | MyIsraelRental"
        description="See what renters and homeowners across Israel are looking for right now — and answer the ones you can help with. Free to post, free to browse."
        path="/requests"
      />

      <HeroBand
        image={BAND_IMAGE}
        title={t('requests.heroTitle', 'Whether you need it or')}
        accent={t('requests.heroAccent', 'have it.')}
        lede={t(
          'requests.heroLede',
          'Say what you are looking for, or what you have coming free. Renters, owners and pros find each other here — instead of losing it all in a hundred WhatsApp groups.',
        )}
        headlineTestId="requests-hero-title"
        testId="requests-band"
      />

      <div className="hero-panel-float">
        <div className="hero-panel">
          {/* Side filter — which half of the market. Sits above the type
              tabs because it is the coarser cut: a renter and an owner want
              opposite halves of this board, and neither wants to scroll
              past the other's posts to find their own. */}
          <div className="flex justify-center mb-3">
            <div className="wh-tabs" role="tablist" aria-label={t('requests.filterBySide', 'Filter by requests or posts')}>
              {SIDES.map(({ key, labelKey, fallback, Icon }) => (
                <button
                  key={key || 'all'}
                  type="button"
                  role="tab"
                  className="wh-tab inline-flex items-center gap-1.5"
                  aria-selected={side === key}
                  onClick={() => patchUrl({ side: key })}
                  data-testid={`requests-side-${key || 'all'}`}
                >
                  <Icon size={13} aria-hidden="true" />
                  {t(labelKey, fallback)}
                </button>
              ))}
            </div>
          </div>

          {/* List / Map. Same control the Stays page uses, in the same
              place, because an owner arriving from Stays should not have to
              learn a second way to do the same thing. */}
          <div className="flex justify-center mb-3">
            <div className="wh-tabs" role="tablist" aria-label={t('requests.viewToggle', 'List or map')}>
              {[['list', 'requests.viewList', 'List', LayoutGrid], ['map', 'requests.viewMap', 'Map', MapIcon]].map(
                ([key, k, fallback, Icon]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    className="wh-tab inline-flex items-center gap-1.5"
                    aria-selected={view === key}
                    onClick={() => patchUrl({ view: key === 'list' ? '' : key })}
                    data-testid={`requests-view-${key}`}
                  >
                    <Icon size={13} aria-hidden="true" />
                    {t(k, fallback)}
                  </button>
                ),
              )}
            </div>
          </div>

          {/* Segmented type filter — the board's primary cut. */}
          <div className="flex justify-center mb-3">
            <div className="wh-tabs" role="tablist" aria-label={t('requests.filterByType', 'Filter requests by type')}>
              {TYPES.map(({ key, labelKey, fallback, wantLabelKey, wantFallback, Icon }) => {
                const demand = side === 'want' && wantLabelKey;
                return (
                  <button
                    key={key || 'all'}
                    type="button"
                    role="tab"
                    className="wh-tab inline-flex items-center gap-1.5"
                    aria-selected={type === key}
                    onClick={() => patchUrl({ type: key })}
                    data-testid={`requests-type-${key || 'all'}`}
                  >
                    <Icon size={13} aria-hidden="true" />
                    {demand ? t(wantLabelKey, wantFallback) : t(labelKey, fallback)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* The input sets `outline-none` and nothing replaced it, so
                tabbing to the search box moved focus somewhere invisible.
                The ring goes on the wrapper via focus-within, because the
                input is transparent and it is the pill that reads as the
                control. Keyboard users can now see where they are. */}
            <div className="relative flex-1 min-w-[220px] flex items-center gap-2 bg-white border rounded-full px-4 py-2.5
                            focus-within:ring-2 focus-within:ring-offset-1 focus-within:ring-[rgb(var(--brand-primary-rgb)/0.55)]"
                 style={{ borderColor: 'var(--brand-border)' }}>
              <Search size={15} style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
              <input
                value={qDraft}
                onChange={(e) => setQDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') runSearch(qDraft); }}
                onFocus={() => setQFocused(true)}
                onBlur={() => setQFocused(false)}
                className="flex-1 bg-transparent text-sm outline-none"
                placeholder={t('requests.searchPlaceholder', 'Search the board — e.g. "3BR Ramat Eshkol", "mover Jerusalem"')}
                aria-label={t('requests.searchLabel', 'Search requests')}
                data-testid="requests-search-input"
              />
              <RecentSearchesPanel
                scope="requests"
                open={qFocused && !qDraft.trim()}
                refreshKey={recentKey}
                onPick={runSearch}
                onDismiss={() => setQFocused(false)}
                testid="requests-recent-searches"
              />
            </div>
            {/* Two actions in one row used to be blue and gold, so colour
                said nothing about which one mattered. One action colour
                now: blue is the CTA everywhere on the site, so posting
                takes it and searching steps back to a quiet outline. Gold
                stays what it is elsewhere, an emphasis colour, not a
                second competing "click me". */}
            <button
              type="button"
              onClick={() => runSearch(qDraft)}
              // `btn` as well as `btn-ghost`. btn-ghost is a MODIFIER - it
              // sets colours only - and the pill radius, flex centring and
              // weight all live on `.btn`. Used alone it rendered as a bare
              // square box between a pill-shaped input and a pill-shaped
              // CTA, which is what it looked like: an unstyled element.
              className="btn btn-ghost !py-[9px] !px-5 !text-sm"
              data-testid="requests-search-btn"
            >
              {t('requests.search', 'Search')}
            </button>
            <button
              type="button"
              onClick={() => { saveReturnPath(); navigate(postHref); }}
              className="btn-blue-solid !py-2.5 !px-5 !text-sm inline-flex items-center gap-1.5"
              data-testid="requests-post-cta"
            >
              <Plus size={14} aria-hidden="true" />
              {t('requests.postCta', 'Post to the marketplace')}
            </button>
          </div>
        </div>
      </div>

      <section className="max-w-6xl mx-auto px-4 pt-11 pb-20">
        <div className="section-rhead flex items-baseline justify-between gap-4 mb-5">
          <h2 className="text-gray-900">
            <Numerals>
              {loading
                ? t('requests.loading', 'Loading requests…')
                : t('requests.count', '{{n}} open on the board', { n: requests.length })}
            </Numerals>
          </h2>
          {(area || q || type) && (
            <button
              type="button"
              onClick={() => { setQDraft(''); setSearchParams(new URLSearchParams(), { replace: true }); }}
              className="text-xs font-semibold hover:underline"
              style={{ color: 'var(--brand-primary)' }}
              data-testid="requests-clear"
            >
              {t('requests.clearAll', 'Clear filters')}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin" size={28} style={{ color: 'var(--brand-primary)' }} />
          </div>
        ) : loadError ? (
          <ListingsUnavailable onRetry={() => window.location.reload()} />
        ) : requests.length === 0 ? (
          <div className="text-center py-16" data-testid="requests-empty">
            <p className="text-xl font-bold" style={{ color: 'var(--ink)' }}>
              {t('requests.emptyTitle', 'Nothing on the board here yet')}
            </p>
            <p className="text-sm mt-2 mb-6" style={{ color: 'var(--brand-muted)' }}>
              {t('requests.emptyBody', 'Be the first — post what you are looking for, or what you have available.')}
            </p>
            <button type="button" onClick={() => { saveReturnPath(); navigate(postHref); }} className="btn-blue-solid" data-testid="requests-empty-cta">
              {t('requests.postCta', 'Post to the marketplace')}
            </button>
          </div>
        ) : view === 'map' ? (
          // The map reads the SAME `requests` the list does, so every
          // filter above it already applies. A map with its own fetch would
          // drift from the list the first time a filter changed.
          <RequestsMapView requests={requests} onPinClick={openRequest} />
        ) : (
          <div style={{ borderTop: '1px solid var(--brand-border)' }} data-testid="requests-grid">
            {requests.map((r) => (
              <RequestCard key={r.id} request={r} onOpen={openRequest} t={t} />
            ))}
          </div>
        )}
      </section>

      {/* Closing band, aimed at the owners and tradespeople reading the
          board rather than at the seekers posting to it. The picture is
          the argument: a dark street where the windows come on under your
          pointer, because "somewhere out there people are looking" is
          exactly what this page sells and a photograph says it faster
          than a paragraph. */}
      <LightUpStreet testId="requests-lightup">
        <h2
          className="text-2xl sm:text-3xl lg:text-4xl font-bold max-w-[20ch] mx-auto"
          style={{ fontFamily: 'var(--font-head)', color: '#fff', textShadow: '0 2px 24px rgba(4,12,17,.75)' }}
        >
          {t('requests.lightUpTitle', 'Behind one of these windows, someone is looking for a place like yours.')}
        </h2>
        <p
          className="text-sm sm:text-base mt-4 max-w-[46ch] mx-auto"
          style={{ color: 'rgba(255,255,255,.86)', textShadow: '0 1px 16px rgba(4,12,17,.8)' }}
        >
          {t('requests.lightUpBody', 'Requests are posted by people who have already decided to move. Answering one takes a message.')}
        </p>
      </LightUpStreet>
    </div>
  );
};

export default RequestsBoard;
