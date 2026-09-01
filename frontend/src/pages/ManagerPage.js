import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Bed, Bath, Home as HomeIcon, MapPin, User, LogIn, Mail } from 'lucide-react';
import DefaultImageBadge from '../components/property/DefaultImageBadge';
import VideoCoverBadge from '../components/property/VideoCoverBadge';
import { getCoverImage } from '../utils/coverImage';
import { sizedImage, srcSet } from '../utils/cdnImage';
import { areaLabel, areaGroupKey, sameArea } from '../utils/areaNames';
import { saveReturnPath } from '../hooks/useBackNavigation';

const RENTAL_TYPES = [
  { key: 'all', label: 'All' },
  { key: 'long-term', label: 'Long Term' },
  { key: 'short-term', label: 'Short Term' },
  { key: 'vacation', label: 'Vacation' },
  { key: 'storage', label: 'Storage' },
];

const ManagerPage = () => {
  const { managerId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);

  // Filters live in the URL (same pattern as Properties.js / Stays.jsx) so
  // that saving path+search before drilling into a listing gives us a
  // "Back to Listings" that restores the exact filtered view — including
  // rental type, area, and bedrooms.
  const activeType = searchParams.get('type') || 'all';
  const activeArea = searchParams.get('area') || 'all';
  const activeBedrooms = searchParams.get('bedrooms') || 'all';

  const updateFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all') next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };
  const setActiveType = (v) => updateFilter('type', v);
  const setActiveArea = (v) => updateFilter('area', v);
  const setActiveBedrooms = (v) => updateFilter('bedrooms', v);

  useEffect(() => {
    fetchManagerData();
  }, [managerId]);

  // Manager can optionally set a custom tagline (replaces the default
  // "N Properties Available" line) and a public contact email that
  // renders as a small footer link. Everything else on this page stays
  // as-is — no hero recolor, no nav hiding, no attribution pill.
  const wl = data?.manager?.white_label || {};

  // When the rental-type filter changes, the lister may not have any
  // properties in the previously-selected area for the new type. Reset to
  // "all" instead of showing an empty grid. Same for bedrooms.
  useEffect(() => {
    if (!data) return;
    // Compared on canonical group keys (utils/areaNames) so a legacy
    // `?area=Ramat Eshkol, Jerusalem` link still resolves to the collapsed
    // "Ramat Eshkol" option instead of silently resetting to "all".
    const validAreas = new Set(
      data.properties
        .filter(p => activeType === 'all' || p.rental_type === activeType)
        .map(p => areaGroupKey(p.area))
        .filter(Boolean)
    );
    if (activeArea !== 'all' && !validAreas.has(areaGroupKey(activeArea))) {
      setActiveArea('all');
    }
    const validBedrooms = new Set(
      data.properties
        .filter(p =>
          (activeType === 'all' || p.rental_type === activeType) &&
          (activeArea === 'all' || sameArea(p.area, activeArea))
        )
        .map(p => String(p.bedrooms ?? ''))
    );
    if (activeBedrooms !== 'all' && !validBedrooms.has(activeBedrooms)) {
      setActiveBedrooms('all');
    }
  }, [activeType, activeArea, data, activeBedrooms]);

  const fetchManagerData = async () => {
    try {
      const response = await axios.get(`${API}/manager/${managerId}/properties`);
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch manager data', error);
    }
  };

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  // Area comparison is canonical-aware (utils/areaNames): picking the single
  // "Ramat Eshkol" option matches all three stored spellings of it, while
  // distinct neighbourhoods (Sanhedria vs Sanhedria Murchevet) stay apart.
  // All of this is client-side — the manager endpoint returns every listing.
  const filteredProperties = data.properties.filter(p =>
    (activeType === 'all' || p.rental_type === activeType) &&
    (activeArea === 'all' || sameArea(p.area, activeArea)) &&
    (activeBedrooms === 'all' || String(p.bedrooms ?? '') === activeBedrooms)
  );

  // Only show tabs that have properties
  const availableTypes = RENTAL_TYPES.filter(
    rt => rt.key === 'all' || data.properties.some(p => p.rental_type === rt.key)
  );

  // Area dropdown options are derived from this lister's actual listings,
  // scoped to the currently-selected rental type so the user never sees
  // an area that would yield zero results.
  // Collapsed to canonical group keys so the same neighbourhood stored under
  // several spellings appears once. Each key is itself a stored value, so it
  // remains a safe filter/URL value. Sorted by the localised label.
  const areasForActiveType = Array.from(new Set(
    data.properties
      .filter(p => activeType === 'all' || p.rental_type === activeType)
      .map(p => areaGroupKey(p.area))
      .filter(Boolean)
  )).sort((a, b) => areaLabel(a, t).localeCompare(areaLabel(b, t)));

  // Bedroom counts available for the active type+area slice. Sorted numerically.
  const bedroomsForActiveSlice = Array.from(new Set(
    data.properties
      .filter(p =>
        (activeType === 'all' || p.rental_type === activeType) &&
        (activeArea === 'all' || sameArea(p.area, activeArea))
      )
      .map(p => p.bedrooms)
      .filter(b => b !== null && b !== undefined)
  )).sort((a, b) => Number(a) - Number(b));

  const rentalTypeLabels = {
    'long-term': t('property.longTerm'),
    'short-term': t('property.shortTerm'),
    'vacation': t('property.vacationType'),
    'storage': t('property.storageType'),
  };

  return (
    <div className="min-h-screen" data-testid="manager-page">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        <div className="rounded-2xl p-8 border border-[#E5E5E5] mb-10" style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, #2A8585 100%)' }}>
          <div className="flex items-center gap-6">
            {data.manager.business_logo ? (
              <img
                src={data.manager.business_logo.startsWith('/api') ? `${API.replace('/api', '')}${data.manager.business_logo}` : data.manager.business_logo}
                alt={`${data.manager.name} logo`}
                className="w-24 h-24 rounded-xl object-cover border-2 border-[var(--gold)]"
                data-testid="manager-logo"
              />
            ) : (
              <div className="w-24 h-24 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
                <User size={48} style={{ color: 'var(--gold)' }} />
              </div>
            )}
            <div>
              <h1 className="text-4xl font-bold mb-2 text-white" style={{ fontFamily: 'var(--font-head)' }} data-testid="manager-name">
                {data.manager.name}
              </h1>
              <p className="mt-2 text-sm" style={{ color: 'var(--gold)' }}>
                {data.properties.length} {data.properties.length === 1 ? 'Property' : 'Properties'} Available
              </p>
            </div>
          </div>
        </div>

        {/* Bio — manager's own words about themselves / their agency. */}
        {wl.bio && (
          <div
            className="mb-8 p-5 rounded-xl bg-white border border-[#E5E5E5]"
            data-testid="manager-bio"
          >
            <h2 className="text-lg font-bold mb-2" style={{ fontFamily: 'var(--font-head)', color: 'var(--brand-primary)' }}>
              About {data.manager.name}
            </h2>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{wl.bio}</p>
          </div>
        )}

        {/* Other services — free-form list of extra offerings beyond
            properties (cleaning, airport pickup, concierge, etc.). Each
            entry is a title + optional description. */}
        {Array.isArray(wl.services) && wl.services.length > 0 && (
          <div className="mb-8" data-testid="manager-services">
            <h2 className="text-lg font-bold mb-3" style={{ fontFamily: 'var(--font-head)', color: 'var(--brand-primary)' }}>
              Other services offered
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {wl.services.map((s, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-white border border-[#E5E5E5] hover:border-[var(--gold)] transition-colors"
                  data-testid={`manager-service-${i}`}
                >
                  <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                  {s.description && (
                    <p className="text-xs text-gray-600 mt-1 leading-snug">{s.description}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rental Type Tabs */}
        {availableTypes.length > 2 && (
          <div className="flex flex-wrap gap-3 mb-4" data-testid="rental-type-tabs">
            {availableTypes.map(rt => (
              <button
                key={rt.key}
                onClick={() => setActiveType(rt.key)}
                className="px-5 py-2.5 rounded-full text-sm font-semibold tracking-wide transition-all duration-200"
                style={{
                  backgroundColor: activeType === rt.key ? 'var(--brand-primary)' : 'transparent',
                  color: activeType === rt.key ? 'var(--gold)' : 'var(--brand-primary)',
                  border: activeType === rt.key ? '1.5px solid var(--brand-primary)' : '1.5px solid #d0d0d0',
                }}
                data-testid={`tab-${rt.key}`}
              >
                {rt.key === 'all' ? 'All Properties' : (rentalTypeLabels[rt.key] || rt.label)}
                {rt.key !== 'all' && (
                  <span className="ml-2 text-xs opacity-60">
                    ({data.properties.filter(p => p.rental_type === rt.key).length})
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Area + Bedrooms filters — each only rendered when the active
            slice contains more than one option (no useless single-choice
            dropdowns). */}
        {(areasForActiveType.length > 1 || bedroomsForActiveSlice.length > 1) && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mb-8" data-testid="filters-row">
            {areasForActiveType.length > 1 && (
              <div className="flex items-center gap-2" data-testid="area-filter-row">
                <MapPin size={16} className="text-[var(--brand-primary)]" />
                <label htmlFor="manager-area-filter" className="text-sm font-medium text-[var(--brand-primary)]">
                  Area:
                </label>
                <select
                  id="manager-area-filter"
                  value={activeArea}
                  onChange={(e) => setActiveArea(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/40"
                  data-testid="manager-area-filter"
                >
                  <option value="all">All areas ({areasForActiveType.length})</option>
                  {areasForActiveType.map((area) => (
                    <option key={area} value={area}>
                      {areaLabel(area, t)} ({data.properties.filter(p =>
                        (activeType === 'all' || p.rental_type === activeType) && sameArea(p.area, area)
                      ).length})
                    </option>
                  ))}
                </select>
              </div>
            )}
            {bedroomsForActiveSlice.length > 1 && (
              <div className="flex items-center gap-2" data-testid="bedrooms-filter-row">
                <Bed size={16} className="text-[var(--brand-primary)]" />
                <label htmlFor="manager-bedrooms-filter" className="text-sm font-medium text-[var(--brand-primary)]">
                  Bedrooms:
                </label>
                <select
                  id="manager-bedrooms-filter"
                  value={activeBedrooms}
                  onChange={(e) => setActiveBedrooms(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 text-sm font-medium bg-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/40"
                  data-testid="manager-bedrooms-filter"
                >
                  <option value="all">Any</option>
                  {bedroomsForActiveSlice.map((b) => (
                    <option key={b} value={String(b)}>
                      {b} {Number(b) === 1 ? 'bedroom' : 'bedrooms'} ({data.properties.filter(p =>
                        (activeType === 'all' || p.rental_type === activeType) &&
                        (activeArea === 'all' || sameArea(p.area, activeArea)) &&
                        p.bedrooms === b
                      ).length})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}

        <h2 className="text-3xl font-bold mb-8" style={{ fontFamily: 'var(--font-head)' }} data-testid="properties-heading">
          {activeType === 'all' ? 'Available Properties' : (rentalTypeLabels[activeType] || activeType)}
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-8">
          {filteredProperties.map((property) => {
            const cover = getCoverImage(property.images, 600, '', property.videos, property.id);
            return (
            <div
              key={property.id}
              className="property-card"
              onClick={() => {
                saveReturnPath();
                navigate(`/property/${property.id}`);
              }}
              data-testid={`manager-property-${property.id}`}
            >
              <div className="relative h-36 md:h-64 bg-gray-200 overflow-hidden">
                {/* Real <img> so the browser can lazy-load and pick a variant
                    from srcSet — a CSS background-image can do neither, and
                    this grid renders every property a manager owns at once.
                    Same treatment as PropertyCard.jsx. */}
                <img
                  src={cover.url}
                  srcSet={srcSet(cover.url, 600)}
                  sizes="(max-width: 768px) 50vw, 33vw"
                  alt={property.title || ''}
                  loading="lazy"
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {cover.isDefault && <DefaultImageBadge />}
                {cover.fromVideo && <VideoCoverBadge />}
              </div>
              <div className="p-3 md:p-6">
                <h3 className="text-sm md:text-xl font-bold mb-1 md:mb-2 line-clamp-1">{property.title}</h3>
                <div className="flex items-center gap-2 text-gray-600 mb-2 md:mb-3">
                  <MapPin size={14} className="md:w-4 md:h-4 shrink-0" />
                  <span className="text-xs md:text-sm truncate">{areaLabel(property.area, t)}</span>
                </div>
                <div className="hidden md:flex items-center gap-4 mb-4 text-sm text-gray-700">
                  {property.bedrooms > 0 && (
                    <div className="flex items-center gap-1">
                      <Bed size={16} />
                      <span>{property.bedrooms}</span>
                    </div>
                  )}
                  {property.bathrooms > 0 && (
                    <div className="flex items-center gap-1">
                      <Bath size={16} />
                      <span>{property.bathrooms}</span>
                    </div>
                  )}
                  {property.square_meters > 0 && (
                    <div className="flex items-center gap-1">
                      <HomeIcon size={16} />
                      <span>{property.square_meters} m²</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base md:text-2xl font-bold" style={{ color: 'var(--gold-text-on-light)' }}>
                    {property.currency === 'USD' ? '$' : '₪'}{(property.monthly_price || property.nightly_price || 0).toLocaleString()}
                    <span className="text-[10px] md:text-sm font-normal text-gray-600">
                      {property.rental_type === 'vacation' ? t('property.perNight') : t('property.perMonth')}
                    </span>
                  </span>
                  <span className="hidden md:inline text-sm px-3 py-1 rounded-full" style={{ backgroundColor: '#E5E5E5', color: 'var(--brand-primary)' }}>
                    {rentalTypeLabels[property.rental_type] || property.rental_type}
                  </span>
                </div>
              </div>
            </div>
            );
          })}
        </div>

        {filteredProperties.length === 0 && (
          <div className="text-center py-16">
            <p className="text-xl text-gray-600">
              {activeType === 'all' ? 'No properties available at the moment.' : `No ${rentalTypeLabels[activeType] || activeType} properties available.`}
            </p>
          </div>
        )}

        {/* Optional public contact — only rendered if the manager set a
            contact email in their dashboard. Keeps the page otherwise
            identical to the old design. */}
        {wl.contact_email && (
          <div
            className="mt-12 pt-6 border-t border-gray-200 text-center text-xs text-gray-500"
            data-testid="manager-contact-footer"
          >
            Contact {data.manager.name}:{' '}
            <a
              href={`mailto:${wl.contact_email}`}
              className="inline-flex items-center gap-1 text-[var(--brand-primary)] hover:underline"
            >
              <Mail size={11} />{wl.contact_email}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagerPage;
