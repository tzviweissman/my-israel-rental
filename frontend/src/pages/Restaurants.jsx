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
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, List, LocateFixed, Map as MapIcon, Search, UtensilsCrossed, X } from 'lucide-react';
import { API } from '../App';
import PageMeta from '../components/PageMeta';
import SiteFooter from '../components/common/SiteFooter';
import RestaurantCard, { CATEGORY_ICONS, categoryLabel } from '../components/restaurants/RestaurantCard';
import RestaurantsMapView from '../components/restaurants/RestaurantsMapView';
import RestaurantSearch from '../components/restaurants/RestaurantSearch';
import GetListedForm from '../components/restaurants/GetListedForm';
import FilterDropdown from '../components/restaurants/FilterDropdown';
import CATEGORY_PHOTOS from '../data/restaurantCategoryPhotos';

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
  // The area a city was picked from, so the way back returns to it
  // (Tzvi, 14 Oct 2026: "when i clicked tel aviv then ramat gan there was
  // no way to go back or cancel filters").
  const location = useLocation();
  const fromRegion = location.state?.region || '';
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
  const [region, setRegion] = useState(() => (citySlug ? '' : fromRegion));
  const [coords, setCoords] = useState(null);
  const [view, setView] = useState('list');
  // Map view is Airbnb's: the cards beside the map, a card and its pin lit
  // together (Tzvi, 14 Oct 2026: "it doesnt look like airbnb with cards on
  // the side"). On a phone the cards are a strip under the map.
  const [hover, setHover] = useState(null);
  const pickPin = (id) => {
    setHover(id);
    const el = document.getElementById(`rc-${id}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  };
  const [showForm, setShowForm] = useState(false);

  const cityName = facets?.city || null;
  const placeName = (he && facets?.city_he) || cityName || t('restaurants.israel', 'Israel');

  // A new city starts clean: its neighbourhoods are not the last city's.
  // Back on all of Israel, the area it came from is picked again.
  useEffect(() => { setHood(''); setRegion(citySlug ? '' : fromRegion); }, [citySlug]); // eslint-disable-line react-hooks/exhaustive-deps
  const allIsrael = () => { setCoords(null); navigate('/restaurants', { state: { region: fromRegion } }); };

  useEffect(() => {
    // Counts follow the chosen neighbourhood or region, not only the city.
    axios.get(`${API}/restaurants/facets`, { params: { city: citySlug, neighborhood: hood || undefined, region: (!citySlug && region) || undefined } })
      .then((r) => setFacets(r.data)).catch(() => setFacets(null));
  }, [citySlug, hood, region]);

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

  // Nearest first by default (Tzvi, 14 Oct 2026): on all of Israel the
  // browser is asked for the visitor's location once; picking a city or a
  // neighbourhood is "a different area" and switches it off.
  useEffect(() => {
    if (citySlug || !navigator?.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {},
      { maximumAge: 300000, timeout: 10000 },
    );
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cities = (facets?.cities || []).filter((c) => c.count > 0 && (!region || c.region === region));
  const title = t('restaurants.title', { place: placeName, defaultValue: `Kosher restaurants in ${placeName}` });
  const filtered = !!(category || kashrut || hood || certifier || query || region || citySlug);
  const Back = he ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen" style={{ background: 'var(--surface-muted, #F9FAFB)' }} data-testid="restaurants-page">
      <PageMeta
        title={`${title} | MyIsraelRental`}
        description={t('restaurants.metaDescription', {
          place: placeName,
          defaultValue: `Kosher restaurants in ${placeName} with their hechsher, meat or dairy, and how to call, message or find them.`,
        })}
        path={citySlug ? `/restaurants/${citySlug}` : '/restaurants'}
      />

      <div className="mx-auto max-w-6xl px-4 pb-10" style={{ paddingTop: 'calc(var(--nav-h, 68px) + 28px)' }}>
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
          <RestaurantSearch
            q={q}
            setQ={setQ}
            onQuery={setQuery}
            facets={facets}
            citySlug={citySlug}
            onCity={(slug) => { setCoords(null); navigate(slug ? `/restaurants/${slug}` : '/restaurants'); }}
            onHood={(h) => { setCoords(null); setHood(h); }}
            onNearMe={() => { if (!coords) nearMe(); }}
            nearOn={!!coords}
          />
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

        {/* Categories as photo tiles (Tzvi, 8 Oct 2026, after adr.it's food
            tiles: "high end and really clean"). One dish on one cream ground
            per tile, the name under it; no borders, no colours per category.
            A category without its photo yet shows its icon on the same
            ground, so the row never looks half-built. */}
        <div className="-mx-4 mt-6 flex gap-4 overflow-x-auto px-4 pt-2 pb-3 sm:gap-5" data-testid="restaurants-categories">
          {(facets?.categories || []).map(({ key, count }) => {
            const Icon = CATEGORY_ICONS[key] || UtensilsCrossed;
            const on = category === key;
            const photo = CATEGORY_PHOTOS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setCategory(on ? '' : key)}
                aria-pressed={on}
                className="group flex w-[104px] shrink-0 flex-col items-center gap-2.5 text-center sm:w-[120px]"
                data-testid={`restaurants-cat-${key}`}
              >
                <span
                  className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-[22px] transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-[0.97]"
                  style={{
                    background: '#F6EDE3',
                    boxShadow: on
                      ? '0 0 0 2.5px var(--brand-primary), 0 12px 24px -14px rgba(17,24,39,0.35)'
                      : '0 12px 24px -14px rgba(17,24,39,0.35)',
                  }}
                >
                  {photo
                    ? <img src={photo} alt="" loading="lazy" width="240" height="240" className="h-full w-full object-cover" />
                    : <Icon size={34} aria-hidden="true" style={{ color: 'var(--brand-primary)' }} />}
                </span>
                <span className="text-sm leading-tight" style={{ color: 'var(--ink)', fontWeight: on ? 700 : 500 }}>
                  {categoryLabel(t, key)}
                </span>
                <span className="-mt-1.5 text-xs text-gray-500">{count}</span>
              </button>
            );
          })}
        </div>

        {citySlug && (
          <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="restaurants-city-filter">
            <button
              type="button"
              onClick={allIsrael}
              className="inline-flex items-center gap-1.5 rounded-full px-3 min-h-[40px] text-sm font-semibold active:scale-[0.97]"
              style={{ color: 'var(--brand-primary)' }}
              data-testid="restaurants-back"
            >
              <Back size={15} aria-hidden="true" />
              {fromRegion
                ? t('restaurants.backToRegion', { region: t(`restaurants.region.${fromRegion}`, fromRegion), defaultValue: 'Back to {{region}}' })
                : t('restaurants.backToIsrael', 'All of Israel')}
            </button>
            <span className="inline-flex items-center gap-1 rounded-full border bg-white ps-3.5 pe-1 py-0.5 text-sm font-semibold"
              style={{ borderColor: 'var(--brand-primary)', color: 'var(--ink)' }}>
              {placeName}
              <button type="button" onClick={allIsrael} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
                aria-label={t('restaurants.removeCity', { place: placeName, defaultValue: 'Show all of Israel instead of {{place}}' })}
                data-testid="restaurants-city-remove">
                <X size={14} aria-hidden="true" />
              </button>
            </span>
          </div>
        )}

        {/* area and hechsher as dropdowns, meat / dairy / pareve, view */}
        <div className="mt-4 flex flex-wrap items-center gap-2" data-testid="restaurants-filters">
          {citySlug ? (
            (facets?.neighborhoods || []).length > 0 && (
              <FilterDropdown
                label={t('restaurants.area', 'Area')}
                allLabel={t('restaurants.allAreas', 'All areas')}
                searchLabel={t('restaurants.findArea', 'Find an area')}
                value={hood}
                options={facets.neighborhoods.map((h) => ({ value: h.name, label: h.name, count: h.count }))}
                onChange={(v) => { setCoords(null); setHood(v); }}
                testId="restaurants-area"
              />
            )
          ) : (
            <FilterDropdown
              label={t('restaurants.area', 'Area')}
              allLabel={t('restaurants.allRegions', 'All regions')}
              searchLabel={t('restaurants.findArea', 'Find an area')}
              value={region}
              valueLabel={region ? t(`restaurants.region.${region}`, region) : ''}
              options={(facets?.regions || []).map((r) => ({ value: r, label: t(`restaurants.region.${r}`, r) }))}
              onChange={setRegion}
              testId="restaurants-area"
            />
          )}
          <FilterDropdown
            label={t('restaurants.certifier', 'Hechsher')}
            allLabel={t('restaurants.anyHechsher', 'Any hechsher')}
            searchLabel={t('restaurants.findHechsher', 'Find a hechsher')}
            value={certifier}
            options={(facets?.certifiers || []).map((c) => ({ value: c.name, label: c.name, count: c.count }))}
            onChange={setCertifier}
            testId="restaurants-certifier"
          />
          {['meat', 'dairy', 'pareve'].map((k) => (
            <Chip key={k} on={kashrut === k} onClick={() => setKashrut(kashrut === k ? '' : k)} testId={`restaurants-k-${k}`}>
              {t(`restaurants.${k}`, k[0].toUpperCase() + k.slice(1))}
            </Chip>
          ))}
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

        {!citySlug && region && cities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2" data-testid="restaurants-region-cities">
            {cities.map((c) => (
              <Link key={c.slug} to={`/restaurants/${c.slug}`} state={{ region }} className="inline-flex min-h-[36px] items-center gap-1 rounded-full border bg-white px-3.5 text-sm font-semibold transition-colors hover:border-[var(--brand-primary)]"
                style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)' }}>
                {(he && c.name_he) || c.name} <span className="font-normal text-gray-500">{c.count}</span>
              </Link>
            ))}
          </div>
        )}
        <div className="mt-5 flex items-center justify-between text-sm text-gray-600">
          <span data-testid="restaurants-count">
            {loading && !items.length ? t('restaurants.loading', 'Loading…')
              : t('restaurants.count', { count: total, defaultValue: `${total} places` })}
          </span>
          {filtered && (
            <button type="button" className="inline-flex items-center gap-1 font-semibold" style={{ color: 'var(--brand-primary)' }}
              onClick={() => { setCategory(''); setKashrut(''); setHood(''); setCertifier(''); setQ(''); setQuery(''); setRegion(''); if (citySlug) { setCoords(null); navigate('/restaurants'); } }}
              data-testid="restaurants-clear">
              <X size={14} aria-hidden="true" /> {t('restaurants.clear', 'Clear filters')}
            </button>
          )}
        </div>

        <div className="mt-3">
          {view === 'map' ? (
            <div className="lg:grid lg:items-start lg:gap-5" style={{ gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1fr)' }} data-testid="restaurants-split">
              <div className="lg:sticky lg:order-2" style={{ top: 'calc(var(--nav-h, 68px) + 16px)' }}>
                <RestaurantsMapView
                  filters={{ ...params, lat: undefined, lng: undefined, limit: undefined }}
                  userCoords={coords}
                  highlight={hover}
                  onPick={pickPin}
                />
              </div>
              <div className="lg:order-1">
                <div
                  className="-mx-4 mt-3 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 lg:mx-0 lg:mt-0 lg:grid lg:grid-cols-2 lg:gap-x-5 lg:gap-y-7 lg:overflow-visible lg:px-0 lg:pb-0"
                  data-testid="restaurants-side-list"
                >
                  {items.map((r) => (
                    <div
                      key={r.id}
                      id={`rc-${r.id}`}
                      className="w-[78%] max-w-[20rem] shrink-0 snap-start lg:w-auto lg:max-w-none"
                      onMouseEnter={() => setHover(r.id)}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover(r.id)}
                    >
                      <RestaurantCard r={r} photoFirst active={hover === r.id} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3" data-testid="restaurants-list">
              {items.map((r) => <RestaurantCard key={r.id} r={r} photoFirst />)}
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
