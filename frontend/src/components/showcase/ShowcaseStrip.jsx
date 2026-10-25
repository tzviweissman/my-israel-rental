/**
 * The business pages, at the top of /businesses (Tzvi, 9 Oct 2026: "add them
 * at the top of the regular business page").
 *
 * A grid that runs down the page, four across on a laptop and two on a phone,
 * like the regular listings under it (Tzvi, 25 Oct 2026: "i dont want the
 * business section to be a scroll section i want it to be four per row and a
 * list down the page like the regular pages"). It replaced a two-row strip you
 * swiped sideways (18 Oct).
 *
 * Services.jsx passes the items: every business page with no search, and only
 * those whose listing matches the search, category or place when there is one,
 * so a search shows the business pages on top and the regular listings under
 * them. A business with a page is not repeated in the regular listings.
 * Renders nothing when there are none.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import ShowcaseCard, { SHOWCASE_CARD_CSS } from './ShowcaseCard';

export default function ShowcaseStrip({ items }) {
  const { t } = useTranslation();
  if (!items || !items.length) return null;
  return (
    <section className="scs" aria-labelledby="scs-h" data-testid="services-business-pages">
      <style>{SHOWCASE_CARD_CSS + CSS}</style>
      <div className="section-rhead scs-head">
        <h2 id="scs-h" className="text-gray-900">{t('showcase.title', 'Business pages')}</h2>
        <Link to="/showcase" className="scs-all">{t('showcase.seeAll', 'See all')}</Link>
      </div>
      <ul className="scs-grid">
        {items.map((item) => <li key={item.slug}><ShowcaseCard item={item} /></li>)}
      </ul>
    </section>
  );
}

const CSS = `
.scs { margin-bottom: 40px; }
.scs-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
.scs-all { font-size: .9rem; font-weight: 600; color: var(--gold-text-on-light, #0F5E8F); }
.scs-all:hover { text-decoration: underline; }
/* four across on a laptop, three on a tablet, two on a phone; rows run down the page */
.scs-grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 28px 20px; }
.scs-grid > li { min-width: 0; }
@media (max-width: 1024px) { .scs-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
.scs .sc-meta { margin-top: 12px; gap: 10px; }
.scs .sc-logo { width: 40px; height: 40px; border-radius: 10px; }
.scs .sc-name { font-size: 1rem; }
.scs .sc-line { font-size: .88rem; }
/* phones: two smaller tiles across; the line under the name wraps to two lines */
@media (max-width: 640px) {
  .scs-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px 12px; }
  .scs .sc-tile { padding: 7%; border-radius: 18px; }
  .scs .sc-meta { gap: 8px; margin-top: 10px; align-items: flex-start; }
  .scs .sc-logo { width: 32px; height: 32px; border-radius: 9px; font-size: .8rem; }
  .scs .sc-name { font-size: .92rem; line-height: 1.2; }
  .scs .sc-line { font-size: .8rem; line-height: 1.3; white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
}
`;
