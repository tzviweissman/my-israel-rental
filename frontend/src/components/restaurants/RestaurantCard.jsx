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
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  BadgeCheck, Beef, Coffee, Croissant, EggFried, Fish, Globe, Hamburger,
  IceCreamCone, MapPin, MessageCircle, Navigation, Phone, Pizza, Salad, Sandwich, Soup, UtensilsCrossed,
} from 'lucide-react';

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

function Action({ href, icon: Icon, children, testId, external }) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors hover:bg-[rgb(var(--brand-primary-rgb)/0.06)] active:scale-[0.97]"
      style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)' }}
      data-testid={testId}
    >
      <Icon size={15} aria-hidden="true" />
      {children}
    </a>
  );
}

export default function RestaurantCard({ r, active }) {
  const { t, i18n } = useTranslation();
  const he = i18n.language?.startsWith('he');
  const first = he ? (r.name_he || r.name_en) : (r.name_en || r.name_he);
  const second = he ? (r.name_he && r.name_en) : (r.name_en && r.name_he);
  const Icon = CATEGORY_ICONS[r.categories[0]] || UtensilsCrossed;
  const cats = r.categories.slice(0, 2).map((c) => categoryLabel(t, c)).join(', ');
  const where = [r.neighborhood, (he && r.city_he) || r.city].filter(Boolean).join(', ');
  const tel = r.phone ? `tel:${r.phone.replace(/[^\d+*]/g, '')}` : null;

  return (
    <article
      className={`flex gap-4 rounded-2xl border bg-white p-4 transition-shadow ${active ? 'shadow-[0_0_0_2px_var(--brand-primary)]' : 'hover:shadow-[0_8px_24px_-14px_rgba(17,24,39,0.25)]'}`}
      style={{ borderColor: 'var(--brand-border)' }}
      data-testid={`restaurant-${r.id}`}
    >
      <span
        className="hidden sm:flex h-16 w-16 shrink-0 items-center justify-center rounded-xl"
        style={{ background: 'rgb(var(--brand-primary-rgb) / 0.08)', color: 'var(--brand-primary)' }}
        aria-hidden="true"
      >
        <Icon size={28} />
      </span>
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
        <div className="mt-3 flex flex-wrap gap-2">
          {tel && <Action href={tel} icon={Phone} testId="restaurant-call">{t('restaurants.call', 'Call')}</Action>}
          {r.whatsapp && (
            <Action href={`https://wa.me/${r.whatsapp}`} icon={MessageCircle} external testId="restaurant-whatsapp">
              WhatsApp
            </Action>
          )}
          <Action href={directionsUrl(r)} icon={Navigation} external testId="restaurant-directions">
            {t('restaurants.directions', 'Directions')}
          </Action>
          {r.website && (
            <Action href={r.website} icon={Globe} external testId="restaurant-website">
              {t('restaurants.website', 'Website')}
            </Action>
          )}
        </div>
      </div>
    </article>
  );
}
