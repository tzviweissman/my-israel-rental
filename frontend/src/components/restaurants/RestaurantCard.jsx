/**
 * One kosher restaurant: who, what, whose hechsher, where, and the four ways
 * to reach it (Tzvi, 8 Oct 2026: website, call, directions, WhatsApp, "like
 * DirectJLM but with colours coordinated better").
 *
 * The colours are the flow theme's and nothing else: white card, ink text,
 * the accent blue for icons and links, green only for "Certificate checked"
 * (green is functional, never decoration). The reference used a pastel tile
 * per category; here every category tile is the same soft blue wash, so a
 * grid of twenty reads as one page, not a paint chart.
 *
 * Honest labels: a hechsher read off the restaurant's own website says so.
 * "Certificate checked" is only shown once a person has verified it.
 *
 * Photo first, like Airbnb (Tzvi, 14 Oct 2026: "make the cards photo
 * first"): their own picture leads, at 4:3, with the name and facts under
 * it. A place with no picture gets its category's icon on the cream ground
 * of the category tiles, never a stock dish that would pass for theirs.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BadgeCheck, Beef, Coffee, Croissant, EggFried, Fish, Globe, Hamburger,
  IceCreamCone, MapPin, MessageCircle, Navigation, Phone, Pizza, Salad, Sandwich, ShoppingBag, Soup, UtensilsCrossed,
} from 'lucide-react';
import RestaurantFeedback from './RestaurantFeedback';

export const CATEGORY_ICONS = {
  pizza: Pizza, burgers: Hamburger, meat_grill: Beef, sushi_asian: Soup, cafe: Coffee,
  bakery: Croissant, dairy_italian: Salad, dessert: IceCreamCone, shawarma_falafel: Sandwich,
  hummus: UtensilsCrossed, deli: Sandwich, breakfast: EggFried, fish: Fish, steakhouse: Beef,
};

export const categoryLabel = (t, key) => t(`restaurants.cat.${key}`, {
  pizza: 'Pizza', burgers: 'Burgers', meat_grill: 'Meat and grill', sushi_asian: 'Sushi and Asian', cafe: 'Cafes',
  bakery: 'Bakeries', dairy_italian: 'Dairy and Italian', dessert: 'Dessert and ice cream',
  shawarma_falafel: 'Shawarma and falafel', hummus: 'Hummus', deli: 'Deli', breakfast: 'Breakfast',
  fish: 'Fish', steakhouse: 'Steakhouse',
}[key] || key);

const kashrutLabel = (t, k) => ({
  meat: t('restaurants.meat', 'Meat'), dairy: t('restaurants.dairy', 'Dairy'), pareve: t('restaurants.pareve', 'Pareve'),
}[k]);

export const directionsUrl = (r) => {
  const dest = r.lat != null ? `${r.lat},${r.lng}` : `${r.name_en || r.name_he}, ${r.city}, Israel`;
  const place = r.google_place ? `&destination_place_id=${encodeURIComponent(r.id)}` : '';
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}${place}`;
};

const formatKm = (km) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`);

function Action({ href, icon: Icon, children, testId, external, small }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold transition-colors hover:bg-[rgb(var(--brand-primary-rgb)/0.06)] active:scale-[0.97] ${small ? 'min-h-[40px] px-3 text-[13px]' : 'px-3 py-1.5 text-sm'}`}
      style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)' }}
      data-testid={testId}
    >
      <Icon size={15} aria-hidden="true" />
      {children}
    </a>
  );
}

export default function RestaurantCard({ r, active, photoFirst }) {
  const { t, i18n } = useTranslation();
  const he = i18n.language?.startsWith('he');
  const first = he ? (r.name_he || r.name_en) : (r.name_en || r.name_he);
  const second = he ? (r.name_he && r.name_en) : (r.name_en && r.name_he);
  const Icon = CATEGORY_ICONS[r.categories[0]] || UtensilsCrossed;
  const cats = r.categories.slice(0, 2).map((c) => categoryLabel(t, c)).join(', ');
  const where = [r.neighborhood, (he && r.city_he) || r.city].filter(Boolean).join(', ');
  const [panel, setPanel] = useState(null);
  const [photoFailed, setPhotoFailed] = useState(false);
  const tel = r.phone ? `tel:${r.phone.replace(/[^\d+*]/g, '')}` : null;
  const nameFont = /[\u0590-\u05FF]/.test(first || '') ? "'Frank Ruhl Libre', serif" : 'var(--font-head)';

  const actions = (small) => (
    <>
      {tel && <Action small={small} href={tel} icon={Phone} testId="restaurant-call">{t('restaurants.call', 'Call')}</Action>}
      {r.whatsapp && (
        <Action small={small} href={`https://wa.me/${r.whatsapp}`} icon={MessageCircle} external testId="restaurant-whatsapp">
          WhatsApp
        </Action>
      )}
      <Action small={small} href={directionsUrl(r)} icon={Navigation} external testId="restaurant-directions">
        {t('restaurants.directions', 'Directions')}
      </Action>
      {r.website && (
        <Action small={small} href={r.website} icon={Globe} external testId="restaurant-website">
          {t('restaurants.website', 'Website')}
        </Action>
      )}
      {r.order_url && (
        <Action small={small} href={r.order_url} icon={ShoppingBag} external testId="restaurant-order">
          {t('restaurants.orderWolt', 'Order on Wolt')}
        </Action>
      )}
    </>
  );
  const feedback = (
    <>
      {!panel && (
        <div className="mt-2 flex flex-wrap gap-x-4 text-xs">
          <button type="button" onClick={() => setPanel('report')} className="text-gray-500 underline-offset-2 hover:underline" data-testid="restaurant-report">
            {t('restaurants.report', 'Report a change')}
          </button>
          <button type="button" onClick={() => setPanel('claim')} className="text-gray-500 underline-offset-2 hover:underline" data-testid="restaurant-claim">
            {t('restaurants.claim', 'Is this your restaurant?')}
          </button>
        </div>
      )}
      {panel && <RestaurantFeedback id={r.id} mode={panel} onDone={() => setPanel(null)} />}
    </>
  );

  if (photoFirst) {
    return (
      <article className="group flex h-full flex-col" data-testid={`restaurant-${r.id}`}>
        <div
          className={`relative aspect-[4/3] overflow-hidden rounded-2xl transition-shadow ${active ? 'shadow-[0_0_0_2.5px_var(--brand-primary)]' : ''}`}
          style={{ background: '#F6EDE3' }}
        >
          {r.photo && !photoFailed ? (
            <img
              src={r.photo}
              alt=""
              loading="lazy"
              onError={() => setPhotoFailed(true)}
              className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.04]"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center" aria-hidden="true" style={{ color: 'var(--brand-primary)' }}>
              <Icon size={44} />
            </span>
          )}
          {r.verified && (
            <span className="absolute start-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-semibold shadow-sm" style={{ color: '#1F8A50' }}>
              {t('restaurants.verified', 'Certificate checked')}
            </span>
          )}
          {r.distance_km != null && (
            <span className="absolute end-3 top-3 rounded-full bg-white px-2.5 py-1 text-xs font-bold shadow-sm" style={{ color: 'var(--ink)' }}>
              {formatKm(r.distance_km)}
            </span>
          )}
        </div>
        <div className="flex flex-1 flex-col pt-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="min-w-0 truncate text-base font-semibold leading-snug" dir="auto" style={{ fontFamily: nameFont, color: 'var(--ink)' }} title={first}>
              {first}
            </h3>
            {r.kashrut && (
              <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: '#F3F4F6', color: 'var(--ink)' }}>
                {kashrutLabel(t, r.kashrut)}
              </span>
            )}
          </div>
          <p className="mt-0.5 truncate text-sm text-gray-600">{[cats, where].filter(Boolean).join(' · ')}</p>
          {r.certification && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
              <BadgeCheck size={15} aria-hidden="true" className="shrink-0" style={{ color: 'var(--brand-primary)' }} />
              <span className="truncate">{r.certification}</span>
            </p>
          )}
          {r.certificate_expired && (
            <p className="mt-1 text-xs text-gray-600">
              {t('restaurants.certificateExpired', 'Certificate expired. Check their website or ask in store for the current one.')}
            </p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-1.5">{actions(true)}</div>
          {feedback}
        </div>
      </article>
    );
  }

  return (
    <article
      className={`flex gap-4 rounded-2xl border bg-white p-4 transition-shadow ${active ? 'shadow-[0_0_0_2px_var(--brand-primary)]' : 'hover:shadow-[0_8px_24px_-14px_rgba(17,24,39,0.25)]'}`}
      style={{ borderColor: 'var(--brand-border)' }}
      data-testid={`restaurant-${r.id}`}
    >
      {/* Their own site's picture, else their Wolt picture; the category
          icon when there is none or it fails to load. */}
      {r.photo && !photoFailed ? (
        <img
          src={r.photo}
          alt=""
          loading="lazy"
          onError={() => setPhotoFailed(true)}
          className="h-20 w-20 sm:h-24 sm:w-24 shrink-0 rounded-xl object-cover"
          style={{ background: '#F3F4F6' }}
        />
      ) : (
        <span
          className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-xl"
          style={{ background: 'rgb(var(--brand-primary-rgb) / 0.08)', color: 'var(--brand-primary)' }}
          aria-hidden="true"
        >
          <Icon size={28} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        {/* Playfair has no Hebrew letters: a Hebrew name gets the Hebrew face. */}
        <h3 className="text-lg font-semibold leading-snug" dir="auto"
          style={{ fontFamily: /[֐-׿]/.test(first || '') ? "'Frank Ruhl Libre', serif" : 'var(--font-head)', color: 'var(--ink)' }}>
          {first}
        </h3>
        {second && second !== first && (
          <p className="text-sm text-gray-600" dir="auto">{second}</p>
        )}
        <p className="mt-1 text-sm text-gray-600">
          {cats}
          {r.kashrut && (
            <span className="ms-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
              style={{ background: '#F3F4F6', color: 'var(--ink)' }}>
              {kashrutLabel(t, r.kashrut)}
            </span>
          )}
        </p>
        {r.certification && (
          <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            <BadgeCheck size={15} aria-hidden="true" style={{ color: 'var(--brand-primary)' }} />
            {r.certification}
          </p>
        )}
        {r.certificate_expired && (
          <p className="mt-1 text-xs text-gray-600">
            {t('restaurants.certificateExpired', 'Certificate expired. Check their website or ask in store for the current one.')}
          </p>
        )}
        {/* Unchecked is the default and the page intro says so once; a
            line on every card repeating it was noise. Checked is news. */}
        {r.verified && (
          <p className="mt-1 text-xs">
            <span className="inline-flex items-center rounded-full px-2 py-0.5 font-semibold" style={{ background: '#E3F3EA', color: '#1F8A50' }}>
              {t('restaurants.verified', 'Certificate checked')}
            </span>
          </p>
        )}
        {where && (
          <p className="mt-1.5 flex items-center gap-1 text-sm text-gray-600">
            <MapPin size={14} aria-hidden="true" />
            {where}
            {r.distance_km != null && <span className="font-semibold" style={{ color: 'var(--brand-primary)' }}>, {formatKm(r.distance_km)}</span>}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">{actions(false)}</div>
        {feedback}
      </div>
    </article>
  );
}
