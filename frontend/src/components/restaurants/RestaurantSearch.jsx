/**
 * The restaurants search box with a dropdown, like the one on Stays (Tzvi,
 * 14 Oct 2026): empty, it offers "Near me" and the busiest cities; typing
 * shows matching cities, the open city's neighbourhoods, and restaurants by
 * name (from the API, debounced). Arrow keys and Enter work; Escape closes.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { LocateFixed, MapPin, Search, UtensilsCrossed } from 'lucide-react';
import { API } from '../../App';

export default function RestaurantSearch({ q, setQ, onQuery, facets, citySlug, onCity, onHood, onNearMe, nearOn }) {
  const { t, i18n } = useTranslation();
  const he = i18n.language?.startsWith('he');
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState([]);
  const [hi, setHi] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setNames([]); return undefined; }
    const id = setTimeout(() => {
      axios.get(`${API}/restaurants`, { params: { q: term, limit: 6, city: citySlug || undefined } })
        .then((r) => setNames(r.data.items || [])).catch(() => setNames([]));
    }, 250);
    return () => clearTimeout(id);
  }, [q, citySlug]);

  useEffect(() => {
    const close = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, []);

  const options = useMemo(() => {
    const term = q.trim().toLowerCase();
    const cities = (facets?.cities || []).filter((c) => c.count > 0);
    const out = [];
    if (!term) {
      out.push({ kind: 'near', label: t('restaurants.nearMe', 'Near me') });
      if (citySlug) out.push({ kind: 'city', slug: '', label: t('restaurants.allIsrael', 'All of Israel') });
      [...cities].sort((a, b) => b.count - a.count).slice(0, 6)
        .forEach((c) => out.push({ kind: 'city', slug: c.slug, label: (he && c.name_he) || c.name, count: c.count }));
      return out;
    }
    cities.filter((c) => c.name.toLowerCase().includes(term) || (c.name_he || '').includes(q.trim())).slice(0, 4)
      .forEach((c) => out.push({ kind: 'city', slug: c.slug, label: (he && c.name_he) || c.name, count: c.count }));
    (facets?.neighborhoods || []).filter((h) => h.name.toLowerCase().includes(term)).slice(0, 4)
      .forEach((h) => out.push({ kind: 'hood', name: h.name, label: h.name, count: h.count }));
    names.forEach((r) => out.push({
      kind: 'name', label: he ? (r.name_he || r.name_en) : (r.name_en || r.name_he),
      sub: [r.neighborhood, (he && r.city_he) || r.city].filter(Boolean).join(', '),
    }));
    return out;
  }, [q, facets, names, citySlug, he, t]);

  useEffect(() => { setHi(0); }, [options.length]);

  const pick = (o) => {
    setOpen(false);
    if (o.kind === 'near') onNearMe();
    else if (o.kind === 'city') { setQ(''); onQuery(''); onCity(o.slug); }
    else if (o.kind === 'hood') { setQ(''); onQuery(''); onHood(o.name); }
    else { setQ(o.label); onQuery(o.label); }
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
    else if (e.key === 'Escape') setOpen(false);
    else if (e.key === 'Enter' && open && options[hi] && q.trim()) { e.preventDefault(); pick(options[hi]); }
  };

  const Icon = { near: LocateFixed, city: MapPin, hood: MapPin, name: UtensilsCrossed };
  const heading = { near: null, city: t('restaurants.sugCities', 'Cities'), hood: t('restaurants.sugAreas', 'Neighbourhoods'), name: t('restaurants.sugPlaces', 'Restaurants') };

  return (
    <div ref={boxRef} className="relative flex-1">
      <label className="relative block">
        <span className="sr-only">{t('restaurants.searchLabel', 'Search by name')}</span>
        <Search size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); if (!e.target.value) onQuery(''); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={t('restaurants.searchPh2', 'Search a restaurant, city or neighbourhood')}
          className="w-full rounded-full border bg-white py-3 pe-4 ps-11 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/0.25)]"
          style={{ borderColor: 'var(--brand-border)' }}
          role="combobox"
          aria-expanded={open && options.length > 0}
          aria-controls="restaurant-search-list"
          aria-autocomplete="list"
          data-testid="restaurants-search"
        />
      </label>
      {open && options.length > 0 && (
        <ul
          id="restaurant-search-list"
          role="listbox"
          className="absolute z-30 mt-2 max-h-[360px] w-full overflow-y-auto rounded-2xl border bg-white p-1.5 shadow-[0_12px_32px_-12px_rgba(17,24,39,0.25)]"
          style={{ borderColor: 'var(--brand-border)' }}
          data-testid="restaurants-search-list"
        >
          {options.map((o, i) => {
            const I = Icon[o.kind];
            const head = (i === 0 || options[i - 1].kind !== o.kind) && heading[o.kind];
            const near = o.kind === 'near';
            return (
              <React.Fragment key={`${o.kind}-${o.slug ?? o.name ?? o.label}-${i}`}>
                {head && <li className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-gray-500" aria-hidden="true">{head}</li>}
                <li
                  role="option"
                  aria-selected={i === hi}
                  onPointerDown={(e) => { e.preventDefault(); pick(o); }}
                  onPointerEnter={() => setHi(i)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: i === hi ? 'rgb(var(--brand-primary-rgb) / 0.08)' : undefined, color: 'var(--ink)' }}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: near ? '#000' : '#F3F4F6', color: near ? '#fff' : 'var(--brand-primary)' }}>
                    <I size={16} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold" dir="auto">
                      {near && nearOn ? t('restaurants.nearMeOn', 'Nearest first') : o.label}
                    </span>
                    {o.sub && <span className="block truncate text-xs text-gray-500">{o.sub}</span>}
                  </span>
                  {o.count != null && <span className="text-xs text-gray-400">{o.count}</span>}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      )}
    </div>
  );
}
