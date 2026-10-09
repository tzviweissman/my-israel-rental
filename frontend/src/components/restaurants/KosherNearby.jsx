/**
 * "Kosher restaurants nearby" on a rental listing. Guests choosing a stay
 * ask where they can eat; this answers from the directory (only places that
 * name their hechsher). Renders nothing when none are within 2 km, so a
 * listing never shows an empty box.
 */
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { BadgeCheck, Navigation, UtensilsCrossed } from 'lucide-react';
import { API } from '../../App';
import { CATEGORY_ICONS, categoryLabel, directionsUrl } from './RestaurantCard';

const RADIUS_KM = 2;

export default function KosherNearby({ lat, lng }) {
  const { t, i18n } = useTranslation();
  const he = i18n.language?.startsWith('he');
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (typeof lat !== 'number' || typeof lng !== 'number') return undefined;
    let alive = true;
    axios.get(`${API}/restaurants`, { params: { lat, lng, max_km: RADIUS_KM, limit: 6 } })
      .then((r) => alive && setItems(r.data.items))
      .catch(() => alive && setItems([]));
    return () => { alive = false; };
  }, [lat, lng]);

  if (!items?.length) return null;
  const city = items[0].city_slug;

  return (
    <section className="mt-10" data-testid="kosher-nearby">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
          {t('restaurants.nearbyTitle', 'Kosher restaurants nearby')}
        </h2>
        {city && (
          <Link to={`/restaurants/${city}`} className="text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}>
            {t('restaurants.seeAll', 'See all')}
          </Link>
        )}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {items.map((r) => {
          const Icon = CATEGORY_ICONS[r.categories[0]] || UtensilsCrossed;
          const name = he ? (r.name_he || r.name_en) : (r.name_en || r.name_he);
          return (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border bg-white p-3" style={{ borderColor: 'var(--brand-border)' }}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                style={{ background: 'rgb(var(--brand-primary-rgb) / 0.08)', color: 'var(--brand-primary)' }} aria-hidden="true">
                <Icon size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold" dir="auto" style={{ color: 'var(--ink)' }}>{name}</div>
                <div className="flex items-center gap-1 truncate text-xs text-gray-600">
                  {r.certification && <BadgeCheck size={12} aria-hidden="true" style={{ color: 'var(--brand-primary)' }} />}
                  {[r.certification, categoryLabel(t, r.categories[0]),
                    r.distance_km != null && (r.distance_km < 1 ? `${Math.round(r.distance_km * 1000)} m` : `${r.distance_km.toFixed(1)} km`)]
                    .filter(Boolean).join(' · ')}
                </div>
              </div>
              <a href={directionsUrl(r)} target="_blank" rel="noopener noreferrer"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border"
                style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)' }}
                aria-label={t('restaurants.directionsTo', { name, defaultValue: `Directions to ${name}` })}>
                <Navigation size={16} aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-gray-500">
        {t('restaurants.disclaimer', 'Kashrut information can change. Verify current certification before relying on it.')}
      </p>
    </section>
  );
}
