/**
 * The public page for one business (spec M4).
 *
 * There is deliberately no public page for a PERSON. What a customer
 * chooses is a business, and merging them would put a plumber's reviews
 * on a bakery — which is the same reason ratings and verification are
 * per business (M5).
 *
 * Reachable by slug or by id: the spec allows either as canonical and the
 * short-link table already points at /business/{id}, so both resolve and
 * neither will ever break.
 */
import React, { useContext, useEffect, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Star, BadgeCheck, MapPin, Loader2, MessageCircle, LayoutGrid, List, Zap, Search, CreditCard, Globe } from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import ServiceCard from '../components/marketplace/ServiceCard';
import GoodToKnow from '../components/marketplace/GoodToKnow';
import SiteFooter from '../components/common/SiteFooter';
import { buildCollections } from '../utils/businessCollections';
import { localizedTitle, localizedDescription } from '../utils/gigLocale';
import { getGigCover } from '../utils/gigAvailability';
import { visitorHeaders } from '../utils/visitorId';
import BusinessCoverBand, { BusinessLogoMark } from '../components/marketplace/BusinessCoverBand';
import SafeImage from '../components/common/SafeImage';
import { prettyArea } from '../utils/areaNames';
import { accentFor, accentColors } from '../utils/businessAccent';
import useCoverScrim from '../hooks/useCoverScrim';

/* The list column is CAPPED, and that cap is the whole point of the row.
   The row puts the price at the far end so the eye can ladder down a column
   comparing prices — which is the one thing a long list is good at, and it
   only works while the ladder is short. Un-capped, a 1280px page stretched
   each row to ~1540px and left 1,300px of empty white between a service's
   name and its price: the two facts a customer is actually comparing, placed
   as far apart as the screen allows.
   720px keeps the title and the price in one glance at every width, and the
   rows stay the shape they were designed as — a phone-density list, not a
   full-bleed table. */
const LIST_CLASS = 'flex flex-col gap-2 max-w-[720px]';

// First screenful and each subsequent step. Twelve fills a desktop grid
// three rows deep and a phone list well past the fold, without asking
// for twenty-five photos nobody has scrolled to.
const PAGE_SIZE = 12;

// How many of a collection show before "See all". Six is what the
// WhatsApp catalog this was modelled on uses, and it is about right:
// enough to show the group has range, few enough that four groups still
// fit on one screen.
const COLLECTION_PREVIEW = 6;

// Past this many services, browsing stops being enough and the page
// needs tools: jump-to-section chips and a filter. Below it they are
// clutter — chips over three sections is furniture, not navigation.
const CATALOG_TOOLS_MIN = 16;

/**
 * @param {object|null} business  K3 — render THIS business instead of fetching
 *   one. The page editor passes the real payload with the owner's pending
 *   edits applied to it, so the preview is this component and not a second
 *   drawing of it. Undefined everywhere else, which is the route's case.
 * @param {boolean} preview  true when this is being shown inside the editor
 *   rather than being visited.
 */
const BusinessPage = ({ business: injected = null, preview = false }) => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { token } = useContext(AuthContext);
  const [fetched, setFetched] = useState(null);
  const [missing, setMissing] = useState(false);
  /* An injected business wins outright and nothing is requested. Merging
     the two would give the editor a race it cannot win: the fetch would
     land after an edit and quietly put the saved value back on screen,
     which is the one thing an owner must never see a preview do. */
  const biz = injected || fetched;
  /* The route has a slug in the URL; the editor does not. Both need one for
     the stored layout choice below, and `undefined` in that key would give
     every previewed business the same entry. */
  const pageSlug = injected ? (injected.slug || injected.id) : slug;
  // null means "follow the automatic default for this many services".
  // A stored choice wins, per business: the threshold is a starting
  // point, not a cage (spec C2).
  const [layout, setLayout] = useState(null);
  /* C8 — how many services are on screen. "Show more" rather than
     infinite scroll: infinite scroll keeps the footer permanently out of
     reach, and the footer is where B7's "Add yours — free" band lives.
     It also leaves the page crawlable, which endless scroll does not. */
  const [shown, setShown] = useState(PAGE_SIZE);
  // Which collections the reader has opened in full (C1's "See all N").
  const [expanded, setExpanded] = useState(() => new Set());
  // C4 — filters this business's own services, in whichever language
  // they were written.
  const [query, setQuery] = useState('');

  useEffect(() => {
    // The editor supplies the payload; there is nothing to go and get.
    if (injected) return undefined;
    let cancelled = false;
    (async () => {
      try {
        // See utils/visitorId — this header is what makes a refresh not
        // count as a second visitor.
        const { data } = await axios.get(
          `${API}/marketplace/business/${encodeURIComponent(slug)}`,
          { headers: visitorHeaders() },
        );
        if (!cancelled) setFetched(data);
      } catch {
        if (!cancelled) setMissing(true);
      }
    })();
    return () => { cancelled = true; };
  }, [slug, injected]);

  /* Split out of the fetch above so the editor gets the same remembered
     layout the visitor would see. Reading it inside the fetch meant it was
     only ever read on a fetch, and the preview would ignore a choice the
     owner had already made on their own page. */
  useEffect(() => {
    if (!pageSlug) return;
    try {
      setLayout(localStorage.getItem(`biz-layout:${pageSlug}`));
    } catch { /* private mode: fall back to the automatic default */ }
  }, [pageSlug]);

  /* K2 — how much scrim this cover needs, sampled from the photo itself.

     Declared HERE, above every early return, because `useCoverScrim` is a
     hook: React counts hooks per render, and calling it after `if (missing)`
     or `if (!biz)` meant a loading render ran fewer hooks than a loaded one.
     That is "Rendered more hooks than during the previous render", and it
     took the whole page to the error boundary.

     `biz` is null on those early renders and the hook handles null by
     returning the default, so nothing is lost by hoisting it. */
  const coverSrc = biz
    ? (biz.cover_url || (Array.isArray(biz.listings) && biz.listings[0]
        ? getGigCover(biz.listings[0]) : null))
    : null;
  const scrim = useCoverScrim(coverSrc);

  if (missing) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6 text-center"
        style={{ background: 'var(--bg)' }}>
        <div>
          <p className="text-lg font-bold" style={{ color: 'var(--ink)' }}>
            {t('businessPage.gone', 'This business is no longer listed')}
          </p>
          <button type="button" onClick={() => navigate('/businesses')}
            className="mt-4 text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}>
            {t('businessPage.browse', 'Browse businesses')}
          </button>
        </div>
      </div>
    );
  }

  if (!biz) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" size={20} style={{ color: 'var(--brand-muted)' }} />
      </div>
    );
  }

  /* B1 — the page had no way to contact the business at all. A visitor
     who arrived from the owner's own flyer, liked what they saw and
     wanted to hire them had nothing to click; the only contact control
     on screen was the site-wide WhatsApp bubble, which reaches
     MyIsraelRental rather than the business.

     Chat-only by rule: the thread goes through the site, and no phone
     number or email appears here or in the API behind it.

     The conversation is keyed by the business's first listing because
     that is what the chat backend already resolves and labels with the
     business name — a thread keyed by anything else would arrive
     unlabelled in the owner's inbox. */
  const primaryListing = (biz.listings || [])[0];
  const canMessage = !!(primaryListing && biz.owner_user_id);

  const messageBusiness = () => {
    const here = `/business/${biz.slug || biz.id}`;
    if (!token) {
      // Comes straight back here after signing in, so the intent that
      // brought them is not lost on the way.
      navigate(`/auth/login?redirect=${encodeURIComponent(here)}`);
      return;
    }
    navigate(`/chat/${primaryListing.id}?with=${encodeURIComponent(biz.owner_user_id)}`);
  };

  const messageLabel = t('businessPage.message', 'Message');

  /* C2 — the layout follows how much there is. A grid of squares is
     right for a handful and becomes a wall at fifteen; compact rows fit
     six to eight on a phone screen where the grid fits two. The counts
     come from the spec's table. */
  const listingCount = (biz.listings || []).length;

  /* B4 — the page opened with a 64px logo floating in a white bar on a
     wide column, which makes a business with one service look abandoned.
     A cover band is the shape people already read as a storefront, from
     Facebook and Google Business.

     No business has a cover image yet, so the band falls back through
     what actually exists: a cover if one is ever set, else the first
     listing's photo, else CoverPlaceholder's deterministic tint - the
     same tint the cards use, so the page hangs together. Real data or a
     designed blank; never a grey box. */
  const bandImage = biz.cover_url || (primaryListing ? getGigCover(primaryListing) : null);

  /* A wide grid amplifies empty space. Under four listings the column
     narrows, so a small catalogue reads as deliberate rather than as a
     page that failed to load the rest. */
  const columnWidth = listingCount < 4 ? 'max-w-[900px]' : 'max-w-5xl';
  const autoLayout = listingCount <= 6 ? 'grid' : 'list';
  const effectiveLayout = layout || autoLayout;
  /* C4 — search across BOTH languages. A Hebrew shopper searching
     "עוגה" must find a service whose title was written in English and
     translated, and the reverse; matching only the displayed string
     would hide half the catalogue from half the customers. */
  const q = query.trim().toLowerCase();
  const matches = (g) => {
    if (!q) return true;
    const fields = [
      g.title, g.title_he, localizedTitle(g, i18n),
      g.description, g.description_he, localizedDescription(g, i18n),
    ];
    return fields.some((f) => String(f || '').toLowerCase().includes(q));
  };
  const searching = q.length > 0;
  const searchResults = searching ? (biz.listings || []).filter(matches) : [];

  /* C5 — the owner's own pick, above everything. Their judgement about
     what sells beats any ordering we could invent, and three is the cap
     precisely so it stays a judgement. Stale ids are skipped, same as in
     collections: a pinned service that was later deleted should vanish
     rather than leave a gap. */
  const pinned = (biz.pinned_service_ids || [])
    .map((id) => (biz.listings || []).find((g) => g.id === id))
    .filter(Boolean)
    .slice(0, 3);

  const { groups, mode: groupMode } = buildCollections(biz.listings, biz.collections, { t });
  // While searching, sections would fragment a handful of results across
  // four headings. One list answers the question that was asked.
  const grouped = groupMode !== 'flat' && !searching;
  const showCatalogTools = listingCount >= CATALOG_TOOLS_MIN;

  const visibleListings = (biz.listings || []).slice(0, shown);
  const remaining = listingCount - visibleListings.length;

  const chooseLayout = (next) => {
    setLayout(next);
    try { localStorage.setItem(`biz-layout:${pageSlug}`, next); } catch { /* private mode */ }
  };
  // member_since is the joining YEAR, already computed by the API.
  const isNewHere = String(biz.member_since || '') === String(new Date().getFullYear());

  // Real data only: fall back through what the business actually has
  // rather than inventing a line for it.
  /* Cover first, for the same reason the short-link card prefers it: a
     share image is a wide rectangle, and a logo centred in one is a
     small mark on a lot of empty space. */
  const shareImage = biz.cover_url || biz.logo_url
    || (primaryListing ? getGigCover(primaryListing) : null) || undefined;
  // Where they work, as a human would say it. Two things this must not
  // do, both of which it did:
  //   * omit nationwide. A business that only ticked "all of Israel" has
  //     an EMPTY `areas`, so the card said nothing about the one fact
  //     that sells them.
  //   * print raw slugs. `areas` stores canonical slugs now, and
  //     `.join(', ')` on them put "jerusalem, bet-shemesh" into a share
  //     card. prettyArea is what turns those back into place names.
  const areaSummary = [
    biz.serves_nationwide ? t('serviceArea.chipNationwide', 'All of Israel') : null,
    ...(biz.areas || []).map((a) => prettyArea(a, t)),
  ].filter(Boolean).join(', ');
  const shareDescription =
    biz.description?.slice(0, 155)
    || [ (biz.categories || [])[0], areaSummary ].filter(Boolean).join(' · ')
    || `${biz.name} on MyIsraelRental.`;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 'var(--nav-h, 68px)' }}
      data-testid="business-page">
      {/* B2 — the picture a share card shows. Logo first, else the first
          listing's cover, else PageMeta's branded default.

          Caveat worth knowing: react-helmet writes these tags in the
          BROWSER, and WhatsApp's crawler does not run JavaScript. It is
          served the static index.html, so a link pasted into a chat still
          previews with the generic site title and logo no matter what is
          passed here. Fixing that needs the tags present in the HTML
          before any JS runs. This still helps in-app browsers and any
          scraper that executes scripts. */}
      {/* Not in the editor. PageMeta writes into the HOST document's head
          via react-helmet — a portal does not change that — so a preview
          would retitle the dashboard the owner is standing in and rewrite
          the share tags of a page nobody is on. */}
      {!preview && (
        <PageMeta
          title={`${biz.name} — MyIsraelRental`}
          description={shareDescription}
          image={shareImage}
          path={`/business/${biz.slug || biz.id}`}
        />
      )}

      <div className={`${columnWidth} mx-auto px-4 py-8`}>
        <div className="rounded-2xl border bg-white overflow-hidden mb-6"
          style={{ borderColor: 'var(--brand-border)' }}>
          {/* Cover band. Short enough not to push the name below the
              fold on a phone, tall enough to read as a header. */}
          <div className="relative h-28 sm:h-40" data-testid="business-cover-band">
            {bandImage ? (
              <>
                <SafeImage
                  src={bandImage}
                  name={biz.name}
                  category={(biz.categories || [])[0]}
                  className="w-full h-full object-cover"
                />
                {/* K2 — a scrim confined to the band's lower edge, where the
                    logo tile and the business name sit. Not a wash over the
                    whole picture: the owner uploaded a photo to be looked at.

                    Light-on-dark is the safe direction. White text with a
                    scrim is readable over almost anything, whereas guessing
                    "this photo is bright, use dark text" and being wrong
                    gives you unreadable text on somebody's storefront. */}
                <div
                  className="absolute inset-x-0 bottom-0 pointer-events-none transition-opacity duration-500"
                  style={{
                    height: '58%',
                    // K2 — strength derived from the photo's own lower band.
                    // A night shot needs barely any; a white-tiled kitchen
                    // needs a lot. `scrim` falls back to the fixed value on
                    // any sampling failure, so this can only improve on the
                    // previous behaviour, never break it.
                    background: `linear-gradient(to top, rgba(0,0,0,${scrim}) 0%, rgba(0,0,0,${scrim * 0.33}) 55%, rgba(0,0,0,0) 100%)`,
                  }}
                  data-testid="business-cover-scrim"
                  data-scrim={scrim.toFixed(2)}
                />
              </>
            ) : (
              <BusinessCoverBand
                name={biz.name}
                accent={accentFor(biz)}
                className="w-full h-full"
              />
            )}
          </div>

          {/* K1 — the accent, always visible.
              The fallback band alone was not enough: `bandImage` falls back
              to the first listing's photo, so any business with a single
              photo anywhere never showed its accent at all, and the choice
              would have looked broken to the owner who made it.
              A hairline under the cover is the storefront's brand line. It
              reads with or without a photo, and it is deliberately thin —
              the accent should feel like the business signed the page, not
              like the site painted it. */}
          <div
            aria-hidden="true"
            style={{ height: 3, background: accentColors(biz).rule }}
            data-testid="business-accent-rule"
            data-accent={accentFor(biz)}
          />

          {/* The logo overlaps the band's lower edge - the storefront
              pattern - so it needs the negative margin and the padding
              below to make room for it. */}
          <div className="px-5 pb-5">
            <div className="flex items-start gap-4 -mt-10 sm:-mt-12">
              {/* `relative` + z-10 so the tile sits ABOVE the band rather
                  than being clipped by the card's rounded corner, which
                  is what sliced its edge off at phone width. The ring
                  replaces a 4px border: a border eats into the 80px box
                  and shrank the artwork inside it. */}
              <div
                className="relative z-10 w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden shrink-0 bg-white ring-4 shadow-sm"
                style={{ '--tw-ring-color': 'var(--surface)' }}
                data-testid="business-logo"
              >
                {biz.logo_url
                  ? <SafeImage
                      src={biz.logo_url}
                      name={biz.name}
                      category={(biz.categories || [])[0]}
                      className="w-full h-full object-cover"
                    />
                  : <BusinessLogoMark name={biz.name} className="w-full h-full" />}
              </div>
              <div className="min-w-0 flex-1 pt-10 sm:pt-14">
              <h1 className="text-2xl font-bold flex items-center gap-2 flex-wrap"
                style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
                {biz.name}
                {/* M5 — verification belongs to the BUSINESS. Someone
                    verified as a property owner is not thereby a verified
                    plumber, so this badge is never borrowed from the
                    person's own identity check. */}
                {biz.verified && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{ background: '#E3F3EA', color: '#1F8A50' }}
                    data-testid="business-verified">
                    <BadgeCheck size={13} /> {t('businessPage.verified', 'Verified')}
                  </span>
                )}
              </h1>

              <div className="flex items-center gap-3 mt-1 flex-wrap text-sm"
                style={{ color: 'var(--brand-muted)' }}>
                {/* Stars for THIS business only. A five-star landlord must
                    not read as a five-star plumber. */}
                {biz.rating_count > 0 ? (
                  <span className="inline-flex items-center gap-1" data-testid="business-rating">
                    <Star size={14} style={{ color: 'var(--gold)' }} fill="currentColor" />
                    <strong style={{ color: 'var(--ink)' }}>{biz.rating_avg}</strong>
                    {t('businessPage.reviews', '({{n}} reviews)', { n: biz.rating_count })}
                  </span>
                ) : isNewHere ? (
                  /* B3 — the second line a visitor read used to be "No
                     reviews yet": the first fact learned about the
                     business was an absence, which is a poor opening and
                     is not information anyone needed. A business that
                     joined this year gets a neutral statement of fact
                     instead; one that joined earlier gets nothing, because
                     calling a year-old business "new" would be false. */
                  <span data-testid="business-new-here">
                    {t('businessPage.newHere', 'New on MyIsraelRental')}
                  </span>
                ) : null}
                {/* B5 — response time, from the same rolling average that
                    feeds the badge on their cards, so the two cannot
                    disagree. Absent until there are enough replies to mean
                    anything; a claim we cannot stand behind is worse than
                    none. */}
                {biz.response_bucket && (
                  <span className="inline-flex items-center gap-1 font-semibold" style={{ color: '#1F8A50' }}
                    data-testid="business-response">
                    <Zap size={13} />
                    {biz.response_bucket === '1h'
                      ? t('businessPage.replies1h', 'Usually replies within an hour')
                      : t('businessPage.replies24h', 'Usually replies within a day')}
                  </span>
                )}
              </div>

              {/* B5 — the description had been a single small line. It is
                  the only thing on the page in the business's own voice,
                  so it gets room to be read. */}
              {biz.description && (
                <p className="mt-3 text-[15px] leading-relaxed max-w-2xl" style={{ color: 'var(--ink)' }}
                  data-testid="business-about">
                  {biz.description}
                </p>
              )}

              {/* P1 — the owner's own payment links.
                  Secondary by construction: outline, not filled. Messaging
                  the business is still the one filled action on this
                  region, and a payment button competing with it would push
                  people to pay before they have agreed what for.
                  Each is labelled with the provider it goes to, so nobody
                  presses a generic "Pay" and lands somewhere unexpected. */}
              {Array.isArray(biz.payment_links) && biz.payment_links.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2" data-testid="business-payment-links">
                  <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>
                    {t('businessPage.payVia', 'Pay this business via')}
                  </span>
                  {biz.payment_links.map((p) => (
                    <a
                      key={p.url}
                      href={p.url}
                      target="_blank"
                      // `noopener` because the destination is owner-supplied:
                      // without it the payment page can reach back through
                      // window.opener and navigate this tab.
                      rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors hover:bg-black/[0.03]"
                      style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)' }}
                      data-testid={`business-payment-link-${p.label}`}
                    >
                      <CreditCard size={13} aria-hidden="true" />
                      {p.label}
                    </a>
                  ))}
                </div>
              )}

              {/* Areas as chips rather than a comma list: a business
                  covering six neighbourhoods reads as a paragraph
                  otherwise, and the one a visitor is scanning for is
                  buried in it. */}
              {((biz.areas || []).length > 0 || biz.serves_nationwide) && (
                <div className="mt-3 flex flex-wrap gap-1.5" data-testid="business-areas">
                  {/* Nationwide leads, because it is the larger claim and
                      the cities after it are then read as "and they are
                      based here" rather than as the limit. Gold: the two
                      are different kinds of fact, and a visitor scanning
                      for "do they come to me" should find this first. */}
                  {biz.serves_nationwide && (
                    <span
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: 'var(--gold)', color: 'var(--ink)' }}
                      data-testid="business-nationwide"
                    >
                      <Globe size={11} /> {t('serviceArea.chipNationwide', 'All of Israel')}
                    </span>
                  )}
                  {(biz.areas || []).map((a) => (
                    <span key={a}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
                      style={{ background: 'rgb(var(--brand-primary-rgb) / 0.08)', color: 'var(--brand-primary)' }}>
                      <MapPin size={11} /> {prettyArea(a, t)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Sits in the header so it is on screen the moment the page
                opens, without scrolling. Hidden on mobile, where the
                sticky bar below carries it instead of stacking two
                copies into the first screenful. */}
            {canMessage && (
              /* Same top offset as the text column. Without it the flex
                 row's negative margin lifts the button onto the cover
                 photo, where gold on a dark image is invisible. */
              <div className="hidden sm:block shrink-0 pt-10 sm:pt-14">
                <button
                    type="button"
                    onClick={messageBusiness}
                    className="btn-gold inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm"
                    data-testid="business-message-header"
                  >
                    <MessageCircle size={16} aria-hidden="true" /> {messageLabel}
                  </button>
              </div>
            )}
            </div>
          </div>
        </div>

        {/* C6 — facts in their own band, above the catalogue and never
            interleaved with it. Renders nothing at all when the business
            has filled none of it in. */}
        <GoodToKnow business={biz} />

        {/* B8 — was a small grey caption reading "What they offer", which
            is both third person and too quiet to be a section heading.
            A real heading, in the site's own voice. */}
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <h2 className="text-xl font-bold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
            {t('businessPage.services', 'Services')}
          </h2>
          {/* Only worth offering once there is enough for the choice to
              matter; below that the grid is simply right. */}
          {listingCount > 6 && (
            <div className="flex items-center gap-1 p-1 rounded-lg"
              style={{ background: 'rgb(var(--brand-primary-rgb) / 0.07)' }}
              data-testid="business-layout-toggle">
              {[['grid', LayoutGrid, t('businessPage.viewGrid', 'Grid')],
                ['list', List, t('businessPage.viewList', 'List')]].map(([key, Icon, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => chooseLayout(key)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
                    effectiveLayout === key ? 'bg-white shadow-sm' : ''
                  }`}
                  style={{ color: effectiveLayout === key ? 'var(--brand-primary)' : 'var(--brand-muted)' }}
                  aria-pressed={effectiveLayout === key}
                  data-testid={`business-layout-${key}`}
                >
                  <Icon size={13} aria-hidden="true" /> {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* C5 — first, and not repeated: a pinned service still appears
            in its collection below, because removing it from there would
            make the section it belongs to look incomplete. */}
        {!searching && pinned.length > 0 && (
          <section className="mb-8" data-testid="business-pinned">
            <h3 className="text-base font-bold mb-3" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
              {t('businessPage.mostPopular', 'Start here')}
            </h3>
            <div className={effectiveLayout === 'list' ? LIST_CLASS : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'}>
              {pinned.map((g) => (
                <ServiceCard key={g.id} gig={g} variant={effectiveLayout === 'list' ? 'list' : 'grid'}
                  i18n={i18n} t={t} onClick={() => navigate(`/businesses/${g.id}`)} />
              ))}
            </div>
          </section>
        )}

        {/* C3 + C4 — only for a catalogue big enough to need them. */}
        {showCatalogTools && (
          <div
            className="sticky z-30 -mx-4 px-4 py-2 mb-4 backdrop-blur"
            style={{ top: 'var(--nav-h, 68px)', background: 'rgb(239 233 220 / 0.92)' }}
            data-testid="business-catalog-tools"
          >
            <div className="relative mb-2">
              <Search
                size={15}
                className="absolute top-1/2 -translate-y-1/2 start-3"
                style={{ color: 'var(--brand-muted)' }}
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('businessPage.searchThis', 'Search this business')}
                className="w-full ps-9 pe-3 py-2 rounded-lg border text-sm bg-white"
                style={{ borderColor: 'var(--brand-border)' }}
                data-testid="business-search"
              />
            </div>

            {/* Jump-to-section chips. Hidden while searching: there are
                no sections to jump to then. */}
            {!searching && groups.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-0.5" data-testid="business-collection-chips">
                {groups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => {
                      const el = document.querySelector(`[data-testid="collection-${g.id}"]`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    className="px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap border shrink-0"
                    style={{ borderColor: 'var(--brand-border)', background: 'var(--surface)', color: 'var(--brand-primary)' }}
                    data-testid={`chip-${g.id}`}
                  >
                    {g.name} · {g.services.length}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {searching ? (
          searchResults.length === 0 ? (
            /* A dead end is the worst possible answer here: they wanted
               something this business might well do, and the page just
               says no. Offer the person instead. */
            <div className="text-center py-8" data-testid="business-search-empty">
              <p className="text-sm mb-3" style={{ color: 'var(--brand-muted)' }}>
                {t('businessPage.noMatches', 'Nothing matches “{{q}}”.', { q: query.trim() })}
              </p>
              {canMessage && (
                <button
                  type="button"
                  onClick={messageBusiness}
                  className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-sm"
                  data-testid="business-search-message"
                >
                  <MessageCircle size={16} aria-hidden="true" /> {t('businessPage.askThem', 'Ask them directly')}
                </button>
              )}
            </div>
          ) : (
            <div className={effectiveLayout === 'list' ? LIST_CLASS : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'}
              data-testid="business-search-results">
              {searchResults.map((g) => (
                <ServiceCard key={g.id} gig={g} variant={effectiveLayout === 'list' ? 'list' : 'grid'}
                  i18n={i18n} t={t} onClick={() => navigate(`/businesses/${g.id}`)} />
              ))}
            </div>
          )
        ) : biz.listings.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="business-empty">
            {t('businessPage.nothingYet', 'Nothing listed yet.')}
          </p>
        ) : grouped ? (
          /* C1 — sections. Owner-defined when they exist, otherwise
             auto-grouped by category past the threshold. Each shows six
             with "See all" rather than everything, so four collections
             still fit on a screen. */
          <div className="space-y-8" data-testid="business-collections">
            {groups.map((group) => {
              const isOpen = expanded.has(group.id);
              const visible = isOpen ? group.services : group.services.slice(0, COLLECTION_PREVIEW);
              const hidden = group.services.length - visible.length;
              return (
                <section key={group.id} data-testid={`collection-${group.id}`}>
                  <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
                    <div>
                      <h3 className="text-base font-bold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
                        {group.name}
                      </h3>
                      {group.description && (
                        <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>{group.description}</p>
                      )}
                    </div>
                    {hidden > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => new Set(prev).add(group.id))}
                        className="text-sm font-semibold whitespace-nowrap"
                        style={{ color: 'var(--brand-primary)' }}
                        data-testid={`collection-see-all-${group.id}`}
                      >
                        {t('businessPage.seeAll', 'See all {{n}}', { n: group.services.length })}
                      </button>
                    )}
                  </div>

                  {effectiveLayout === 'list' ? (
                    <div className={LIST_CLASS}>
                      {visible.map((g) => (
                        <ServiceCard key={g.id} gig={g} variant="list" i18n={i18n} t={t}
                          onClick={() => navigate(`/businesses/${g.id}`)} />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                      {visible.map((g) => (
                        <ServiceCard key={g.id} gig={g} variant="grid" i18n={i18n} t={t}
                          onClick={() => navigate(`/businesses/${g.id}`)} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        ) : effectiveLayout === 'list' ? (
          <div className={LIST_CLASS} data-testid="business-listings-list">
            {visibleListings.map((g) => (
              <ServiceCard
                key={g.id}
                gig={g}
                variant="list"
                i18n={i18n}
                t={t}
                onClick={() => navigate(`/businesses/${g.id}`)}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" data-testid="business-listings-grid">
            {visibleListings.map((g) => (
              <ServiceCard
                key={g.id}
                gig={g}
                variant="grid"
                i18n={i18n}
                t={t}
                onClick={() => navigate(`/businesses/${g.id}`)}
              />
            ))}
          </div>
        )}

        {!grouped && remaining > 0 && (
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setShown((n) => n + PAGE_SIZE)}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold border"
              style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)', background: 'var(--surface)' }}
              data-testid="business-show-more"
            >
              {t('businessPage.showMore', 'Show {{n}} more', { n: Math.min(remaining, PAGE_SIZE) })}
            </button>
          </div>
        )}

        {/* B7 — the highest-intent placement on the site for this CTA.
            The people who read a competitor's business page to the end
            are overwhelmingly other local business owners, which is
            exactly the audience we want and nowhere else reaches them at
            that moment. Quiet on purpose: it sits under someone else's
            storefront and must not compete with it. */}
        <div
          className="mt-10 rounded-2xl border px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
          style={{ background: 'var(--surface)', borderColor: 'var(--brand-border)' }}
          data-testid="business-add-yours"
        >
          <p className="text-sm" style={{ color: 'var(--ink)' }}>
            {t('businessPage.addYours', 'Are you a business? Add yours — free.')}
          </p>
          <button
            type="button"
            onClick={() => navigate('/signup')}
            className="text-sm font-semibold whitespace-nowrap"
            style={{ color: 'var(--brand-primary)' }}
            data-testid="business-add-yours-cta"
          >
            {t('businessPage.addYoursCta', 'Add your business')} →
          </button>
        </div>

        {/* Repeated for anyone who has read to the end — asking them to
            scroll back up to act is how intent gets lost. */}
        {canMessage && (
          <div className="mt-10 mb-24 sm:mb-10 flex justify-center">
            <button
                    type="button"
                    onClick={messageBusiness}
                    className="btn-gold inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm"
                    data-testid="business-message-bottom"
                  >
                    <MessageCircle size={16} aria-hidden="true" /> {messageLabel}
                  </button>
          </div>
        )}
      </div>

      {/* The attribution, and the reason this page is worth building.

          An owner sends this link to their own customers, and every one of
          those people meets MyIsraelRental here for the first time. This
          quiet line is what turns that visit into a business of their own —
          it is the whole distribution argument in one sentence.

          Placed BELOW the business's content and above the site footer, so
          it never competes with what the owner is showing. Calm, small, and
          plainly ours: a visitor should be able to tell who hosts this page
          without the host shouting over the business on it. */}
      <div className="px-4 pb-6">
        <div
          className="mx-auto max-w-5xl rounded-2xl border px-5 py-4 flex items-center justify-between gap-4 flex-wrap"
          style={{ borderColor: 'var(--brand-border)', background: 'var(--surface)' }}
          data-testid="business-attribution"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src="/brand-logo.png"
              alt=""
              aria-hidden="true"
              width={28}
              height={28}
              className="w-7 h-7 rounded-lg shrink-0"
              loading="lazy"
            />
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--ink)' }}>
              {t('businessPage.hostedOn', 'This page is on MyIsraelRental')}
            </span>
          </div>
          {/* Outline, never filled: the filled action on this page belongs
              to the business, not to us. */}
          <Link
            to="/join"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full text-sm font-semibold border transition-colors hover:bg-black/[0.03] shrink-0"
            style={{ borderColor: 'var(--brand-primary)', color: 'var(--brand-primary)' }}
            data-testid="business-attribution-cta"
          >
            {t('businessPage.listYours', 'List your business — free')}
          </Link>
        </div>
      </div>

      <SiteFooter />

      {/* Mobile only: the header button is off screen for most of the
          page on a phone, so the action rides along instead. Padding for
          the home indicator on iOS, or it sits under the gesture bar. */}
      {canMessage && (
        <div
          className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t px-4 py-3"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--brand-border)',
            paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
          }}
          data-testid="business-message-bar"
        >
          <button
            type="button"
            onClick={messageBusiness}
            className="btn-gold w-full inline-flex items-center justify-center gap-2 px-5 py-3 text-sm"
            data-testid="business-message-sticky"
          >
            <MessageCircle size={16} aria-hidden="true" /> {messageLabel}
          </button>
        </div>
      )}
    </div>
  );
};

export default BusinessPage;
