/**
 * The eighth phase-1 block: a business's services, in one of four
 * sources.
 *
 * `marketplace/ServiceCard.jsx` already documents a `variant` prop, which
 * is why it qualified for phase 1. What was missing was anything to say
 * WHICH services, in what order, with what around them. That is what a
 * block's props are for, and it is the whole difference between a
 * component library and a composable page.
 *
 *   source: "all"        the catalogue: what the business features, its
 *                        groups or its list, the tools a long one needs,
 *                        and a way to see the rest
 *   source: "featured"   the pinned row alone, placeable anywhere
 *   source: "collection" one owner-defined group
 *   source: "pick"       an explicit list, in the order given
 *
 * WHY "ALL" IS THE WHOLE CATALOGUE AND NOT JUST EVERY CARD. A catalogue
 * is not a longer grid: past sixteen services it needs a search box and
 * jump-to chips, and past six it needs a choice between rows and squares.
 * Splitting those into separate blocks would let an owner compose a
 * fifty-service catalogue with no way to search it, which is not a design
 * decision, it is a broken page. The tools belong to the thing they are
 * tools for.
 *
 * WHAT THIS FILE IS NOT. It is not a rewrite. Every branch below was
 * lifted out of pages/BusinessPage.jsx as it stood, so that the default
 * composition renders the page the business already had, byte for byte.
 * Phase 1's real test is whether the existing page can be written down in
 * this vocabulary; a "conversion" that redesigned it as it went would
 * have answered a different question.
 *
 * ONE THING DID CHANGE, deliberately: the sticky tool bar was painted
 * `rgb(239 233 220 / 0.92)`, the RETIRED limestone, which on the current
 * white page is a visible tan band across a business's own catalogue. It
 * is the bug flagged at BusinessPage.jsx:631 in the spec, and it is one
 * line inside code this file is moving, so it is fixed here rather than
 * carried across intact.
 */
import React from 'react';
import { LayoutGrid, List, MessageCircle, Search } from 'lucide-react';

import ServiceCard from '../marketplace/ServiceCard';
import { buildCollections } from '../../utils/businessCollections';
import { localizedTitle, localizedDescription } from '../../utils/gigLocale';

/* The list column is CAPPED, and that cap is the whole point of the row.
   The row puts the price at the far end so the eye can ladder down a
   column comparing prices, which is the one thing a long list is good at,
   and it only works while the ladder is short. Un-capped, a 1280px page
   stretched each row to ~1540px and left 1,300px of empty white between a
   service's name and its price. */
const LIST_CLASS = 'flex flex-col gap-2 max-w-[720px]';

// First screenful and each subsequent step. Twelve fills a desktop grid
// three rows deep and a phone list well past the fold, without asking for
// twenty-five photos nobody has scrolled to.
export const PAGE_SIZE = 12;

// How many of a collection show before "See all".
const COLLECTION_PREVIEW = 6;

// Past this many services, browsing stops being enough and the page needs
// tools. Below it they are clutter.
const CATALOG_TOOLS_MIN = 16;

const GRID_CLASS = 'pg-grid';

/** One row or square, wired to open the service. */
const Card = ({ gig, listLayout, ctx }) => (
  <ServiceCard
    gig={gig}
    variant={listLayout ? 'list' : 'grid'}
    i18n={ctx.i18n}
    t={ctx.t}
    onClick={() => ctx.openService(gig)}
  />
);

const CardSet = ({ gigs, listLayout, ctx, testid }) => (
  <div className={listLayout ? LIST_CLASS : GRID_CLASS} data-testid={testid}>
    {gigs.map((g) => <Card key={g.id} gig={g} listLayout={listLayout} ctx={ctx} />)}
  </div>
);

/* C5 - the owner's own pick. Stale ids are skipped, the same as in
   collections: a pinned service deleted later should vanish rather than
   leave a gap, and that tolerance is why the ids are not validated when
   the page is saved. */
function pinnedOf(business) {
  return (business.pinned_service_ids || [])
    .map((id) => (business.listings || []).find((g) => g.id === id))
    .filter(Boolean)
    .slice(0, 3);
}

export default function ServicesBlock({ block, ctx }) {
  const {
    business, t, i18n, layout, chooseLayout, query, setQuery,
    shown, setShown, expanded, setExpanded, canMessage, messageBusiness,
  } = ctx;
  const props = block.props || {};
  const source = props.source || 'all';
  const listings = business.listings || [];

  /* C2 - the layout follows how much there is, and then the READER's own
     choice beats both. The block's variant is the owner's default, not a
     cage: someone who has switched this business to rows keeps rows. */
  const listingCount = listings.length;
  const autoLayout = listingCount <= 6 ? 'grid' : 'list';
  const ownerDefault = block.variant === 'list' ? 'list' : null;
  const effectiveLayout = layout || ownerDefault || autoLayout;
  const listLayout = effectiveLayout === 'list';
  const limit = Math.min(Math.max(Number(props.limit) || 12, 1), 48);

  // ---- the three narrow sources, each a plain set of cards ----------

  if (source === 'featured') {
    const gigs = pinnedOf(business);
    if (gigs.length === 0) return null;
    return (
      <section data-testid={`pg-services-${block.id}`}>
        <h3 className="text-base font-bold mb-3 pg-head">
          {props.heading || t('businessPage.mostPopular', 'Start here')}
        </h3>
        <CardSet gigs={gigs.slice(0, limit)} listLayout={listLayout} ctx={ctx} />
      </section>
    );
  }

  if (source === 'collection') {
    const { groups } = buildCollections(listings, business.collections, { t });
    const group = groups.find((g) => g.id === props.collection_id);
    // A group the owner has since deleted takes its block with it rather
    // than leaving an empty heading. Same tolerance, same reason.
    if (!group || group.services.length === 0) return null;
    return (
      <section data-testid={`pg-services-${block.id}`}>
        <h3 className="text-base font-bold mb-3 pg-head">{props.heading || group.name}</h3>
        <CardSet gigs={group.services.slice(0, limit)} listLayout={listLayout} ctx={ctx} />
      </section>
    );
  }

  if (source === 'pick') {
    const gigs = (props.ids || [])
      .map((id) => listings.find((g) => g.id === id))
      .filter(Boolean)
      .slice(0, limit);
    if (gigs.length === 0) return null;
    return (
      <section data-testid={`pg-services-${block.id}`}>
        {props.heading && <h3 className="text-base font-bold mb-3 pg-head">{props.heading}</h3>}
        <CardSet gigs={gigs} listLayout={listLayout} ctx={ctx} />
      </section>
    );
  }

  // ---- source: "all" - the catalogue -------------------------------

  /* C4 - search across BOTH languages. A Hebrew shopper searching "עוגה"
     must find a service whose title was written in English and
     translated, and the reverse; matching only the displayed string would
     hide half the catalogue from half the customers. */
  const q = (query || '').trim().toLowerCase();
  const matches = (g) => {
    if (!q) return true;
    const fields = [
      g.title, g.title_he, localizedTitle(g, i18n),
      g.description, g.description_he, localizedDescription(g, i18n),
    ];
    return fields.some((f) => String(f || '').toLowerCase().includes(q));
  };
  const searching = q.length > 0;
  const searchResults = searching ? listings.filter(matches) : [];
  const pinned = pinnedOf(business);

  const { groups, mode: groupMode } = buildCollections(listings, business.collections, { t });
  // While searching, sections would fragment a handful of results across
  // four headings. One list answers the question that was asked.
  const grouped = groupMode !== 'flat' && !searching;
  const showCatalogTools = listingCount >= CATALOG_TOOLS_MIN;
  const visibleListings = listings.slice(0, shown);
  const remaining = listingCount - visibleListings.length;

  return (
    <section data-testid={`pg-services-${block.id}`}>
      {/* B8 - a real heading, in the site's own voice. */}
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <h2 className="text-xl font-bold pg-head">
          {props.heading || t('businessPage.services', 'Services')}
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

      {/* C5 - first, and not repeated: a pinned service still appears in
          its collection below, because removing it from there would make
          the section it belongs to look incomplete. */}
      {!searching && pinned.length > 0 && (
        <section className="mb-8" data-testid="business-pinned">
          <h3 className="text-base font-bold mb-3 pg-head">
            {t('businessPage.mostPopular', 'Start here')}
          </h3>
          <CardSet gigs={pinned} listLayout={listLayout} ctx={ctx} />
        </section>
      )}

      {/* C3 + C4 - only for a catalogue big enough to need them. */}
      {showCatalogTools && (
        <div
          className="sticky z-30 -mx-4 px-4 py-2 mb-4 backdrop-blur"
          /* Was `rgb(239 233 220 / 0.92)`: the retired limestone, which on
             the current white page is a tan band across the catalogue.
             Fixed on the way past rather than carried over. */
          style={{ top: 'var(--nav-h, 68px)', background: 'rgb(255 255 255 / 0.92)' }}
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

          {/* Jump-to-section chips. Hidden while searching: there are no
              sections to jump to then. */}
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
             something this business might well do, and the page just says
             no. Offer the person instead. */
          <div className="text-center py-8" data-testid="business-search-empty">
            <p className="text-sm mb-3" style={{ color: 'var(--brand-muted)' }}>
              {t('businessPage.noMatches', 'Nothing matches “{{q}}”.', { q: (query || '').trim() })}
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
          <CardSet gigs={searchResults} listLayout={listLayout} ctx={ctx}
            testid="business-search-results" />
        )
      ) : listingCount === 0 ? (
        <p className="text-sm" style={{ color: 'var(--brand-muted)' }} data-testid="business-empty">
          {t('businessPage.nothingYet', 'Nothing listed yet.')}
        </p>
      ) : grouped ? (
        /* C1 - sections. Owner-defined when they exist, otherwise
           auto-grouped by category past the threshold. Each shows six with
           "See all" rather than everything, so four collections still fit
           on a screen. */
        <div className="space-y-8" data-testid="business-collections">
          {groups.map((group) => {
            const isOpen = expanded.has(group.id);
            const visible = isOpen ? group.services : group.services.slice(0, COLLECTION_PREVIEW);
            const hidden = group.services.length - visible.length;
            return (
              <section key={group.id} data-testid={`collection-${group.id}`}>
                <div className="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
                  <div>
                    <h3 className="text-base font-bold pg-head">{group.name}</h3>
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
                <CardSet gigs={visible} listLayout={listLayout} ctx={ctx} />
              </section>
            );
          })}
        </div>
      ) : (
        <CardSet
          gigs={visibleListings}
          listLayout={listLayout}
          ctx={ctx}
          testid={listLayout ? 'business-listings-list' : 'business-listings-grid'}
        />
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
    </section>
  );
}
