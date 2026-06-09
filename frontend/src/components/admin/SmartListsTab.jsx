/**
 * Smart Lists tab — super-admin tool for generating shareable property
 * shortlists by location + max monthly rent (ILS) + availability window.
 *
 * Owns its own state; mounted from AdminDashboard. Saved lists live in the
 * `smart_lists` Mongo collection (private to the super admin).
 */
import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Search,
  Copy,
  Save,
  Trash2,
  Sparkles,
  MapPin,
  Calendar,
  ExternalLink,
  Banknote,
  Bed,
  Home,
  Check,
  MessageCircle,
} from 'lucide-react';
import { API } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';
import AreaAliasManager from './AreaAliasManager';

const AVAILABILITY_OPTIONS = [
  { value: 'next_month', label: 'Available within the next month' },
  { value: 'next_3_months', label: 'Available within the next 3 months' },
  { value: 'next_6_months', label: 'Available within the next 6 months' },
  { value: 'anytime', label: 'Available anytime (no date restriction)' },
];

const formatPrice = (amount, currency) => {
  if (amount == null) return '—';
  const sym = currency === 'USD' ? '$' : '₪';
  return `${sym}${Number(amount).toLocaleString()}`;
};

const RENTAL_CATEGORY_OPTIONS = [
  { value: 'any', label: 'Any type' },
  { value: 'long-term', label: 'Long-term' },
  { value: 'short-term', label: 'Short-term' },
  { value: 'vacation', label: 'Vacation' },
  { value: 'sukkot', label: 'Sukkot rental' },
  { value: 'pesach', label: 'Pesach rental' },
];

const VACATION_LIKE_CATEGORIES = new Set(['vacation', 'sukkot', 'pesach']);

const formatAvailable = (iso) => {
  if (!iso) return 'Available now';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return `Available ${iso}`;
    return `Available ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}`;
  } catch {
    return `Available ${iso}`;
  }
};

const formatBedrooms = (n) => {
  if (n == null) return null;
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  // 2.5 BR etc. — round to 1 decimal but drop trailing ".0".
  const display = v % 1 === 0 ? `${v}` : v.toFixed(1);
  return `${display} bedroom${v === 1 ? '' : 's'}`;
};

const stripCity = (loc) => {
  if (!loc) return '';
  const trimmed = loc.trim();
  return trimmed.includes(' - ') ? trimmed.split(' - ', 2)[1].trim() : trimmed;
};

const CATEGORY_TITLE = {
  any: 'rentals',
  'long-term': 'long-term rentals',
  'short-term': 'short-term rentals',
  vacation: 'vacation rentals',
  sukkot: 'Sukkot rentals',
  pesach: 'Pesach rentals',
};

const buildHeader = (filters) => {
  // Headline broker-style: "MyIsraelRental.com" big, then "<Neighborhood>
  // <category> rentals" subtitle. WhatsApp/email recipients should know in
  // two seconds where the list came from and what's in it.
  const neighborhood = stripCity(filters?.location);
  const categoryLabel = CATEGORY_TITLE[filters?.rental_category] || 'rentals';
  const subtitle = neighborhood
    ? `${neighborhood} ${categoryLabel}`
    : categoryLabel.charAt(0).toUpperCase() + categoryLabel.slice(1);
  return ['MyIsraelRental.com', subtitle];
};

const buildCopyText = (properties, filters = {}) => {
  const [brand, subtitle] = buildHeader(filters);
  // Leading the message with the bare homepage URL on its own line is the
  // trick that gets messaging apps (WhatsApp, iMessage, Telegram) to fetch
  // the site's Open Graph metadata and render the MyIsraelRental logo as
  // the preview card at the very top of the message. Without this, the
  // first URL in the message would be a property listing URL and WhatsApp
  // would show that property's photo as the preview instead of the logo.
  const SITE_URL = 'https://myisraelrental.com';
  const body = properties
    .map((p) => {
      // When the admin picked a specific location, force every row to that
      // canonical form so the list never mixes "Maalot Dafna" with
      // "Jerusalem - Maalot Dafna".
      const area = filters?.location || p.area || 'Israel';
      const beds = formatBedrooms(p.bedrooms);
      const lines = [
        area,
        `${formatPrice(p.price, p.currency)}${p.price_label || ''}`,
      ];
      if (beds) lines.push(beds);
      lines.push(formatAvailable(p.available_from));
      lines.push(p.listing_url);
      return lines.join('\n');
    })
    .join('\n\n');
  return `${SITE_URL}\n\n${brand}\n${subtitle}\n\n${body}`;
};

const SmartListsTab = ({ token }) => {
  const [location, setLocation] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [minBedrooms, setMinBedrooms] = useState('');
  const [rentalCategory, setRentalCategory] = useState('any');
  const [availability, setAvailability] = useState('anytime');
  const [results, setResults] = useState(null); // { properties, count, usd_to_ils_rate }
  // Snapshot of filters used to generate ``results`` so the display + copy
  // text stay consistent even if the admin changes the filter inputs after
  // generating but before clicking Share/Copy.
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingName, setSavingName] = useState('');
  const [showSaveBox, setShowSaveBox] = useState(false);
  const [copyOk, setCopyOk] = useState(false);

  const headers = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  // SWR-style fetches — keep setState OUT of useEffect so the
  // react-hooks/set-state-in-effect rule stays happy.
  const { data: saved = [], refresh: refreshSaved } = useApiSWR(
    `${API}/admin/smart-lists`,
    token,
    { initial: [] },
  );
  const { data: availableLocations = [] } = useApiSWR(
    `${API}/admin/smart-lists/locations`,
    token,
    { initial: [] },
  );

  const generate = async () => {
    setLoading(true);
    setResults(null);
    const snapshot = {
      location: location.trim() || null,
      max_monthly_rent_ils: maxRent === '' ? null : Number(maxRent),
      min_bedrooms: minBedrooms === '' ? null : Number(minBedrooms),
      availability,
      rental_category: rentalCategory,
    };
    try {
      const res = await axios.post(
        `${API}/admin/smart-lists/generate`,
        snapshot,
        { headers },
      );
      setResults(res.data);
      setAppliedFilters(snapshot);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to generate list');
    } finally {
      setLoading(false);
    }
  };

  const saveList = async () => {
    if (!savingName.trim()) {
      toast.error('Please name this list');
      return;
    }
    try {
      await axios.post(
        `${API}/admin/smart-lists`,
        {
          name: savingName.trim(),
          location: location.trim() || null,
          max_monthly_rent_ils: maxRent === '' ? null : Number(maxRent),
          min_bedrooms: minBedrooms === '' ? null : Number(minBedrooms),
          availability,
          rental_category: rentalCategory,
        },
        { headers },
      );
      toast.success('List saved');
      setSavingName('');
      setShowSaveBox(false);
      refreshSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save list');
    }
  };

  const openSavedList = async (id) => {
    try {
      const res = await axios.get(`${API}/admin/smart-lists/${id}`, { headers });
      const { filters } = res.data;
      setLocation(filters?.location || '');
      setMaxRent(filters?.max_monthly_rent_ils ?? '');
      setMinBedrooms(filters?.min_bedrooms ?? '');
      setRentalCategory(filters?.rental_category || 'any');
      setAvailability(filters?.availability || 'anytime');
      setResults({
        properties: res.data.properties,
        count: res.data.properties.length,
        usd_to_ils_rate: res.data.usd_to_ils_rate,
      });
      setAppliedFilters(filters || {});
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load list');
    }
  };

  const deleteSaved = async (id) => {
    if (!window.confirm('Delete this saved list?')) return;
    try {
      await axios.delete(`${API}/admin/smart-lists/${id}`, { headers });
      refreshSaved();
      toast.success('List deleted');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const copyToClipboard = async () => {
    if (!results?.properties?.length) return;
    const text = buildCopyText(results.properties, appliedFilters || {});
    try {
      await navigator.clipboard.writeText(text);
      setCopyOk(true);
      setTimeout(() => setCopyOk(false), 2000);
    } catch {
      // Fallback: select text in a hidden textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopyOk(true);
        setTimeout(() => setCopyOk(false), 2000);
      } catch {
        toast.error('Copy failed — please select manually.');
      }
      document.body.removeChild(ta);
    }
  };

  const shareToWhatsApp = () => {
    if (!results?.properties?.length) return;
    // wa.me supports a single ?text param; WhatsApp's URL length cap is
    // roughly 4000 chars, so we truncate gracefully if a list gets huge.
    let text = buildCopyText(results.properties, appliedFilters || {});
    const MAX = 3900;
    if (text.length > MAX) {
      text = text.slice(0, MAX) + '\n\n…(list truncated — full list copied separately)';
    }
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Autocomplete suggestions: prefix match on the canonical area values.
  // (Removed — location is now a dropdown of areas that actually have
  // active listings.)

  return (
    <div className="space-y-6" data-testid="smart-lists-tab">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#D4AF37]/15 flex items-center justify-center shrink-0">
          <Sparkles size={20} className="text-[#D4AF37]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Smart Lists</h2>
          <p className="text-sm text-gray-500 mt-1">
            Generate a shareable list of active rentals by location, price ceiling, and
            availability — then copy it for WhatsApp, email, or Telegram.
          </p>
        </div>
      </div>

      {/* ---------------- Filters ---------------- */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Location — dropdown of areas with at least one active listing */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <MapPin size={12} /> Location
          </label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm bg-white"
            data-testid="smart-list-location-select"
          >
            <option value="">
              All locations
              {availableLocations.length > 0 &&
                ` (${availableLocations.reduce((sum, a) => sum + (a.count || 0), 0)})`}
            </option>
            {availableLocations.map((a) => (
              <option key={a.value} value={a.value}>
                {a.value} ({a.count})
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-1">
            Only areas with at least one active listing are shown.
          </p>
        </div>

        {/* Rental type */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <Home size={12} /> Rental type
          </label>
          <select
            value={rentalCategory}
            onChange={(e) => setRentalCategory(e.target.value)}
            className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm bg-white"
            data-testid="smart-list-rental-category-select"
          >
            {RENTAL_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Max rent — disabled for vacation / sukkot / pesach */}
        {(() => {
          const isVacationLike = VACATION_LIKE_CATEGORIES.has(rentalCategory);
          return (
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                <Banknote size={12} /> Max monthly rent (₪)
              </label>
              <input
                type="number"
                value={isVacationLike ? '' : maxRent}
                onChange={(e) => setMaxRent(e.target.value)}
                disabled={isVacationLike}
                placeholder={isVacationLike ? 'N/A for vacation' : 'e.g. 10000'}
                className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm disabled:bg-gray-50 disabled:text-gray-400"
                data-testid="smart-list-max-rent-input"
                min="0"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                {isVacationLike
                  ? 'Price filter disabled for vacation rentals.'
                  : 'USD listings auto-converted to ILS before filtering.'}
              </p>
            </div>
          );
        })()}

        {/* Bedrooms (minimum) */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <Bed size={12} /> Bedrooms (min)
          </label>
          <select
            value={minBedrooms}
            onChange={(e) => setMinBedrooms(e.target.value)}
            className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm bg-white"
            data-testid="smart-list-bedrooms-select"
          >
            <option value="">Any</option>
            <option value="1">1+</option>
            <option value="2">2+</option>
            <option value="3">3+</option>
            <option value="4">4+</option>
            <option value="5">5+</option>
            <option value="6">6+</option>
          </select>
        </div>

        {/* Availability */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <Calendar size={12} /> Availability
          </label>
          <select
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm bg-white"
            data-testid="smart-list-availability-select"
          >
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-3 lg:col-span-5 flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#1E6A6A] text-white text-sm font-semibold hover:bg-[#175555] disabled:opacity-50 transition-colors"
            data-testid="smart-list-generate-btn"
          >
            <Search size={16} />
            {loading ? 'Generating…' : 'Generate List'}
          </button>
          {results && (
            <>
              <button
                type="button"
                onClick={copyToClipboard}
                disabled={!results.properties?.length}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                data-testid="smart-list-copy-btn"
              >
                {copyOk ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                {copyOk ? 'Copied' : 'Copy list'}
              </button>
              <button
                type="button"
                onClick={shareToWhatsApp}
                disabled={!results.properties?.length}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#1ebe57] disabled:opacity-40 transition-colors"
                data-testid="smart-list-whatsapp-btn"
              >
                <MessageCircle size={16} /> Share on WhatsApp
              </button>
              <button
                type="button"
                onClick={() => setShowSaveBox((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                data-testid="smart-list-save-toggle"
              >
                <Save size={16} /> Save this list
              </button>
            </>
          )}
        </div>

        {showSaveBox && (
          <div className="md:col-span-3 lg:col-span-5 flex flex-wrap items-center gap-2 pt-2">
            <input
              type="text"
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              placeholder='e.g. "Ramat Eshkol Under 10k – June 2026"'
              className="flex-1 min-w-[260px] px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
              data-testid="smart-list-save-name-input"
            />
            <button
              type="button"
              onClick={saveList}
              className="px-4 py-2.5 rounded-xl bg-[#D4AF37] text-[#1E6A6A] text-sm font-semibold hover:opacity-90"
              data-testid="smart-list-save-confirm-btn"
            >
              Save
            </button>
          </div>
        )}
      </div>

      {/* ---------------- Results ---------------- */}
      {results && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6" data-testid="smart-list-results">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-bold text-gray-900">
              {results.count} {results.count === 1 ? 'property' : 'properties'} matched
            </h3>
            {results.usd_to_ils_rate && (
              <span className="text-xs text-gray-400">
                USD→ILS rate: {Number(results.usd_to_ils_rate).toFixed(3)}
              </span>
            )}
          </div>
          {/* Live preview of the title block recipients will see in the
              WhatsApp/copy output. Keeps the broker confident that the share
              text is going to read right before they hit send. */}
          {appliedFilters && (
            <div className="mb-4 pb-3 border-b border-gray-100">
              <p className="text-xs uppercase tracking-wider text-gray-400">List header</p>
              {/* Mock WhatsApp link-preview card so the admin can see the
                  MyIsraelRental logo will sit on top of the shared list. */}
              <div className="mt-2 mb-3 inline-flex items-center gap-3 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 max-w-md">
                <img
                  src="https://customer-assets.emergentagent.com/job_listing-manager-pro-2/artifacts/hx4hc6hw_IMG_1745%20%281%29.PNG"
                  alt="MyIsraelRental logo"
                  className="w-12 h-12 rounded-lg object-contain bg-white shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide">WhatsApp preview</p>
                  <p className="text-sm font-bold text-gray-900 truncate">MyIsraelRental — Rentals across Israel</p>
                  <p className="text-[11px] text-gray-500 truncate">myisraelrental.com</p>
                </div>
              </div>
              <p className="text-xl font-extrabold text-[#1E6A6A]">MyIsraelRental.com</p>
              <p className="text-sm font-semibold text-gray-700">
                {buildHeader(appliedFilters)[1]}
              </p>
            </div>
          )}
          {results.properties.length === 0 ? (
            <p className="text-sm text-gray-500">No properties match — try widening the filters.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {results.properties.map((p) => {
                const displayArea = appliedFilters?.location || p.area || 'Israel';
                const beds = formatBedrooms(p.bedrooms);
                return (
                <li key={p.id} className="py-4 flex items-start justify-between gap-4" data-testid={`smart-list-row-${p.id}`}>
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                      <MapPin size={13} className="text-[#1E6A6A] shrink-0" />
                      <span className="truncate">{displayArea}</span>
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      <span className="font-medium" style={{ color: '#D4AF37' }}>
                        {formatPrice(p.price, p.currency)}
                        {p.price_label || ''}
                      </span>
                      {p.currency === 'USD' && p.price_ils_equivalent != null && (
                        <span className="text-xs text-gray-400 ml-1.5">
                          (≈ ₪{Math.round(p.price_ils_equivalent).toLocaleString()})
                        </span>
                      )}
                      {beds && (
                        <>
                          <span className="text-gray-300 mx-1.5">·</span>
                          <span className="text-gray-500">{beds}</span>
                        </>
                      )}
                      <span className="text-gray-300 mx-1.5">·</span>
                      <span className="text-gray-500">{formatAvailable(p.available_from)}</span>
                    </p>
                    <a
                      href={p.listing_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-xs text-[#1E6A6A] hover:underline"
                      data-testid={`smart-list-link-${p.id}`}
                    >
                      <ExternalLink size={11} />
                      <span className="truncate max-w-[460px]">{p.listing_url}</span>
                    </a>
                  </div>
                </li>
              );})}
            </ul>
          )}
        </div>
      )}

      {/* ---------------- Alias manager ---------------- */}
      <AreaAliasManager token={token} />

      {/* ---------------- Saved lists ---------------- */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6" data-testid="smart-list-saved-section">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Saved lists</h3>
        {saved.length === 0 ? (
          <p className="text-sm text-gray-500">
            No saved lists yet. Generate a list and click <strong>Save this list</strong> to keep it.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {saved.map((s) => (
              <li
                key={s.id}
                className="py-3 flex items-center justify-between gap-3"
                data-testid={`smart-list-saved-${s.id}`}
              >
                <button
                  type="button"
                  onClick={() => openSavedList(s.id)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-sm font-semibold text-gray-900 truncate hover:text-[#1E6A6A]">
                    {s.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {s.filters?.location || 'Any location'} ·{' '}
                    {s.filters?.rental_category && s.filters.rental_category !== 'any'
                      ? `${s.filters.rental_category} · `
                      : ''}
                    {s.filters?.max_monthly_rent_ils
                      ? `≤ ₪${Number(s.filters.max_monthly_rent_ils).toLocaleString()}`
                      : 'Any price'}
                    {s.filters?.min_bedrooms
                      ? ` · ${s.filters.min_bedrooms}+ beds`
                      : ''}
                    {' · '}
                    {s.snapshot_count} match{s.snapshot_count === 1 ? '' : 'es'} when saved
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => deleteSaved(s.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  data-testid={`smart-list-delete-${s.id}`}
                  aria-label="Delete saved list"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default SmartListsTab;

