/**
 * Kosher restaurants: /restaurants for all of Israel, /restaurants/<city>
 * for one city (its own page, title and description, for search engines).
 *
 * Every place listed names its hechsher on its own website; the rest are
 * held back for a person to check (scripts/check_kosher_websites.py). The
 * filters narrow by city and neighbourhood, category, meat/dairy/pareve and
 * certifier; "Near me" orders by distance from the browser's location.
 * Built on the flow theme: white, ink, one accent blue, black for the one
 * solid action.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { List, LocateFixed, Map as MapIcon, Search, UtensilsCrossed, X } from 'lucide-react';
import { API } from '../App';
import PageMeta from '../components/PageMeta';
import SiteFooter from '../components/common/SiteFooter';
import RestaurantCard, { CATEGORY_ICONS, categoryLabel } from '../components/restaurants/RestaurantCard';
import RestaurantsMapView from '../components/restaurants/RestaurantsMapView';
import GetListedForm from '../components/restaurants/GetListedForm';

const PAGE = 24;

function Chip({ on, onClick, children, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className="shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors active:scale-[0.97]"
      style={on
        ? { background: 'var(--ink, #111827)', color: '#fff', borderColor: 'var(--ink, #111827)' }
        : { background: '#fff', color: 'var(--ink, #111827)', borderColor: 'var(--brand-border)' }}
      data-testid={testId}
    >
      {children}
    </button>
  );
}

export default function Restaurants() {
  const { t, i18n } = useTranslation();
  const he = i18n.language?.startsWith('he');
  const navigate = useNavigate();
  const { city: citySlug } = useParams();
  const [facets, setFacets] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [kashrut, setKashrut] = useState('');
  const [hood, setHood] = useState('');
  const [certifier, setCertifier] = useState('');
  const [region, setRegion] = useState('');
  const [coords, setCoords] = useState(null);
  const [view, setView] = useState('list');
  const [showForm, setShowForm] = useState(false);

  const cityName = facets?.city || null;
  const placeName = (he && facets?.city_he) || cityName || t('restaurants.israel', 'Israel');

  // A new city starts clean: its neighbourhoods are not the last city's.
  useEffect(() => { setHood(''); setRegion(''); }, [citySlug]);

  useEffect(() => {
    axios.get(`${API}/restaurants/facets`, { params: { city: citySlug } })
      .then((r) => setFacets(r.data)).catch(() => setFacets(null));
  }, [citySlug]);

  const params = useMemo(() => ({
    city: citySlug, neighborhood: hood || undefined, region: (!citySlug && region) || undefined,
    category: category || undefined, kashrut: kashrut || undefined, certifier: certifier || undefined,
    q: query || undefined, lat: coords?.lat, lng: coords?.lng, limit: PAGE,
  }), [citySlug, hood, region, category, kashrut, certifier, query, coords]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    axios.get(`${API}/restaurants`, { params: { ...params, page: 1 } })
      .then((r) => { if (alive) { setItems(r.data.items); setTotal(r.data.total); setPage(1); } })
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [params]);

  const loadMore = () => {
    const next = page + 1;
    setLoading(true);
    axios.get(`${API}/restaurants`, { params: { ...params, page: next } })
      .then((r) => { setItems((xs) => [...xs, ...r.data.items]); setPage(next); })
      .finally(() => setLoading(false));
  };

  const nearMe = () => {
    if (coords) { setCoords(null); return; }
    if (!navigator?.geolocation) {
      toast.error(t('restaurants.geoUnavailable', 'Your browser cannot share your location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast.error(t('restaurants.geoDenied', 'Location is off. Allow it in your browser to sort by distance.')),
      { maximumAge: 60000, timeout: 10000 },
    );
  };

  const cities = (facets?.cities || []).filter((c) => c.count > 0 && (!region || c.region === region));
  const title = t('restaurants.title', { place: placeName, defaultValue: `Kosher restaurants in ${placeName}` });
  const filtered = !!(category || kashrut || hood || certifier || query || region);

  return (
    <div className="min-h-screen" style={{ background: '#F9FAFB' }} data-testid="restaurants-page">
      <PageMeta
        title={`${title} | MyIsraelRental`}
        description={t('restaurants.metaDescription', {
          place: placeName,
          defaultValue: `Kosher restaurants in ${placeName} with their hechsher, meat or dairy, and how to call, message or find them.`,
        })}
        path={citySlug ? `/restaurants/${citySlug}` : '/restaurants'}
      />

      <div className="mx-auto max-w-6xl px-4 pt-24 pb-10 sm:pt-28">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-base text-gray-600">
          {t('restaurants.intro', 'Every place here names its hechsher on its own website. Check the certificate on the wall before relying on it.')}
        </p>

        {/* search + city */}
        <form
          onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); }}
          className="mt-6 flex flex-col gap-2 sm:flex-row"
          role="search"
        >
          <label className="relative flex-1">
            <span className="sr-only">{t('restaurants.searchLabel', 'Search by name')}</span>
            <Search size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <input
              value={q}
              onChange={(e) => { setQ(e.target.value); if (!e.target.value) setQuery(''); }}
              placeholder={t('restaurants.searchPh', 'Search by name')}
              className="w-full rounded-full border bg-white py-3 pe-4 ps-11 text-sm focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/0.25)]"
              style={{ borderColor: 'var(--brand-border)' }}
              data-testid="restaurants-search"
            />
          </label>
          <select
            value={citySlug || ''}
            onChange={(e) => navigate(e.target.value ? `/restaurants/${e.target.value}` : '/restaurants')}
            className="rounded-full border bg-white px-4 py-3 text-sm font-semibold"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
            aria-label={t('restaurants.city', 'City')}
            data-testid="restaurants-city"
          >
            <option value="">{t('restaurants.allIsrael', 'All of Israel')}</option>
            {(facets?.cities || []).filter((c) => c.count > 0 || c.slug === citySlug).map((c) => (
              <option key={c.slug} value={c.slug}>{(he && c.name_he) || c.name} ({c.count})</option>
            ))}
          </select>
          <button
            type="button"
            onClick={nearMe}
            aria-pressed={!!coords}
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold active:scale-[0.97]"
            style={coords ? { background: 'rgb(var(--brand-primary-rgb) / 0.12)', color: 'var(--brand-primary)' } : { background: '#000', color: '#fff' }}
            data-testid="restaurants-near-me"
          >
            <LocateFixed size={16} aria-hidden="true" />
            {coords ? t('restaurants.nearMeOn', 'Nearest first') : t('restaurants.nearMe', 'Near me')}
          </button>
        </form>

        {/* categories, one style for all */}
        <div className="-mx-4 mt-6 flex gap-2 overflow-x-auto px-4 pb-1" data-testid="restaurants-categories">
          {(facets?.categories || []).map(({ key, count }) => {
            const Icon = CATEGORY_ICONS[key] || UtensilsCrossed;
            const on = category === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(on ? '' : key)}
                aria-pressed={on}
                className="flex w-24 shrink-0 flex-col items-center gap-1.5 rounded-2xl border bg-white px-2 py-3 text-center text-xs font-semibold transition-colors active:scale-[0.97]"
                style={{ borderColor: on ? 'var(--brand-primary)' : 'var(--brand-border)', color: 'var(--ink)',
                  boxShadow: on ? '0 0 0 1px var(--brand-primary)' : 'none' }}
                data-testid={`restaurants-cat-${key}`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl"
                  style={{ background: on ? 'var(--brand-primary)' : 'rgb(var(--brand-primary-rgb) / 0.08)', color: on ? '#fff' : 'var(--brand-primary)' }}>
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="leading-tight">{categoryLabel(t, key)}</span>
                <span className="font-normal text-gray-500">{count}</span>
              </button>
            );
          })}
        </div>

        {/* region (all of Israel) or neighbourhood (one city) */}
        {!citySlug && (
          <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
            <Chip on={!region} onClick={() => setRegion('')}>{t('restaurants.allRegions', 'All regions')}</Chip>
            {(facets?.regions || []).map((r) => (
              <Chip key={r} on={region === r} onClick={() => setRegion(region === r ? '' : r)}>
                {t(`restaurants.region.${r}`, r)}
              </Chip>
            ))}
          </div>
        )}
        {!citySlug && region && cities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {cities.map((c) => (
              <Link key={c.slug} to={`/restaurants/${c.slug}`} className="rounded-full border bg-white px-3 py-1 text-sm hover:underline"
                style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)' }}>
                {(he && c.name_he) || c.name} ({c.count})
              </Link>
            ))}
          </div>
        )}
        {citySlug && (facets?.neighborhoods || []).length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{t('restaurants.byArea', 'By area')}</p>
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" data-testid="restaurants-hoods">
              {facets.neighborhoods.map((h) => (
                <Chip key={h.name} on={hood === h.name} onClick={() => setHood(hood === h.name ? '' : h.name)}>
                  {h.name} <span className="font-normal opacity-70">{h.count}</span>
                </Chip>
              ))}
            </div>
          </div>
        )}

        {/* meat / dairy / pareve, certifier, view */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {['meat', 'dairy', 'pareve'].map((k) => (
            <Chip key={k} on={kashrut === k} onClick={() => setKashrut(kashrut === k ? '' : k)} testId={`restaurants-k-${k}`}>
              {t(`restaurants.${k}`, k[0].toUpperCase() + k.slice(1))}
            </Chip>
          ))}
          <select
            value={certifier}
            onChange={(e) => setCertifier(e.target.value)}
            className="rounded-full border bg-white px-3.5 py-1.5 text-sm font-semibold"
            style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
            aria-label={t('restaurants.certifier', 'Hechsher')}
            data-testid="restaurants-certifier"
          >
            <option value="">{t('restaurants.anyHechsher', 'Any hechsher')}</option>
            {(facets?.certifiers || []).map((c) => <option key={c.name} value={c.name}>{c.name} ({c.count})</option>)}
          </select>
          <div className="ms-auto flex rounded-full border bg-white p-0.5" style={{ borderColor: 'var(--brand-border)' }}>
            {[['list', List, t('restaurants.list', 'List')], ['map', MapIcon, t('restaurants.map', 'Map')]].map(([k, Icon, label]) => (
              <button key={k} type="button" onClick={() => setView(k)} aria-pressed={view === k}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold"
                style={view === k ? { background: 'var(--ink, #111827)', color: '#fff' } : { color: 'var(--ink, #111827)' }}
                data-testid={`restaurants-view-${k}`}>
                <Icon size={15} aria-hidden="true" /> {label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between text-sm text-gray-600">
          <span data-testid="restaurants-count">
            {loading && !items.length ? t('restaurants.loading', 'Loading…')
              : t('restaurants.count', { count: total, defaultValue: `${total} places` })}
          </span>
          {filtered && (
            <button type="button" className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--brand-primary)' }}
              onClick={() => { setCategory(''); setKashrut(''); setHood(''); setCertifier(''); setQ(''); setQuery(''); setRegion(''); }}>
              <X size={14} aria-hidden="true" /> {t('restaurants.clear', 'Clear filters')}
            </button>
          )}
        </div>

        <div className="mt-3">
          {view === 'map' ? (
            <RestaurantsMapView items={items} userCoords={coords} />
          ) : (
            <div className="grid gap-3 md:grid-cols-2" data-testid="restaurants-list">
              {items.map((r) => <RestaurantCard key={r.id} r={r} />)}
            </div>
          )}
          {!loading && items.length === 0 && (
            <p className="rounded-2xl border bg-white p-8 text-center text-gray-600" style={{ borderColor: 'var(--brand-border)' }}>
              {t('restaurants.none', 'No places match these filters yet.')}
            </p>
          )}
          {items.length < total && (
            <div className="mt-6 flex justify-center">
              <button type="button" onClick={loadMore} disabled={loading}
                className="rounded-full border bg-white px-6 py-2.5 text-sm font-bold disabled:opacity-60"
                style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="restaurants-more">
                {loading ? t('restaurants.loading', 'Loading…') : t('restaurants.more', { count: Math.min(PAGE, total - items.length), defaultValue: 'Show more' })}
              </button>
            </div>
          )}
        </div>

        {/* owners */}
        <section className="mt-12 rounded-2xl border bg-white p-6 sm:p-8" style={{ borderColor: 'var(--brand-border)' }} data-testid="restaurants-get-listed">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
                {t('restaurants.ownerTitle', 'Run a kosher restaurant?')}
              </h2>
              <p className="mt-1 text-sm text-gray-600">
                {t('restaurants.ownerBody', 'Get listed, free. Send us your hechsher and we add you once we have checked it.')}
              </p>
            </div>
            {!showForm && (
              <button type="button" onClick={() => setShowForm(true)}
                className="shrink-0 rounded-full px-6 py-3 text-sm font-bold active:scale-[0.97]"
                style={{ background: 'rgba(36,175,235,.33)', color: 'var(--ink, #111827)' }}
                data-testid="restaurants-get-listed-open">
                {t('restaurants.getListed', 'Get listed')}
              </button>
            )}
          </div>
          {showForm && <GetListedForm cities={facets?.cities || []} defaultCity={cityName} onDone={() => setShowForm(false)} />}
        </section>

        <p className="mt-8 text-center text-xs text-gray-500">
          {t('restaurants.disclaimer', 'Kashrut information can change. Verify current certification before relying on it.')}
        </p>
      </div>
      <SiteFooter />
    </div>
  );
}
