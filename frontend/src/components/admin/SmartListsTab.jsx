/**
 * Smart Lists tab — super-admin tool for generating shareable property
 * shortlists by location, rent range, bedrooms, availability and how
 * recently a listing was added.
 *
 * WHY THE SELECTION LAYER EXISTS. The first version shared every match.
 * That was fine at 30 listings and useless at 300: nobody reads a
 * hundred-apartment WhatsApp message, and wa.me silently truncated
 * anything past ~4000 characters, so the tail of a long list was being
 * dropped without anyone noticing. Filters narrow the pool; the admin
 * then ticks the handful that actually go out, under a visible cap and a
 * live character count.
 *
 * Owns its own state; mounted from AdminDashboard. Saved lists live in the
 * `smart_lists` Mongo collection (private to the super admin).
 */
import React, { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
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
  Clock,
  CheckSquare,
  Square,
  ListFilter,
} from 'lucide-react';
import { API } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';
import {
  AVAILABILITY_OPTIONS,
  LISTED_WITHIN_OPTIONS,
  RENTAL_CATEGORY_OPTIONS,
  SEND_CAP_OPTIONS,
  SORT_OPTIONS,
  VACATION_LIKE_CATEGORIES,
  WA_URL_LIMIT,
  whatsappUrl,
  applySort,
  buildCopyText,
  buildHeader,
  describeFilters,
  formatAdded,
  formatAvailable,
  formatBedrooms,
  formatPrice,
} from './smartListText';

const SmartListsTab = ({ token }) => {
  const { t } = useTranslation();
  const [location, setLocation] = useState('');
  const [minRent, setMinRent] = useState('');
  const [maxRent, setMaxRent] = useState('');
  const [minBedrooms, setMinBedrooms] = useState('');
  const [maxBedrooms, setMaxBedrooms] = useState('');
  const [rentalCategory, setRentalCategory] = useState('any');
  const [availability, setAvailability] = useState('anytime');
  // '' = any time; otherwise a day count sent as listed_within_days.
  const [listedWithin, setListedWithin] = useState('');
  const [results, setResults] = useState(null); // { properties, count, usd_to_ils_rate }
  // Snapshot of filters used to generate ``results`` so the display + copy
  // text stay consistent even if the admin changes the filter inputs after
  // generating but before clicking Share/Copy.
  const [appliedFilters, setAppliedFilters] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingName, setSavingName] = useState('');
  const [showSaveBox, setShowSaveBox] = useState(false);
  const [copyOk, setCopyOk] = useState(false);
  // Sort order applied to the generated list before copy / share / render.
  // Lives next to results state so it survives until a new list is generated.
  const [sortOrder, setSortOrder] = useState('default');
  // Ids ticked for sending. Held as an array (not a Set) so that changing
  // it is an ordinary state replacement React can diff.
  const [selectedIds, setSelectedIds] = useState([]);
  // Listings allowed in one message. 0 = no cap.
  const [sendCap, setSendCap] = useState(10);

  // Sorted view of ``results.properties`` — single source of truth so the
  // visible cards, the clipboard payload and the WhatsApp link can never
  // disagree.
  const sortedProperties = useMemo(
    () => applySort(results?.properties, sortOrder, results?.usd_to_ils_rate),
    [results, sortOrder],
  );

  // Fast membership test for the row checkboxes.
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  // Rows that will actually be sent, in the order currently on screen —
  // so the message reads top-to-bottom exactly like the list the admin is
  // looking at, whatever order they selected them in.
  const selectedProperties = useMemo(
    () => (sortedProperties || []).filter((p) => selectedSet.has(p.id)),
    [sortedProperties, selectedSet],
  );

  const capReached = sendCap > 0 && selectedIds.length >= sendCap;

  // Pick the first N on screen. Used both by the "Top N" button and to
  // pre-select after a fresh generate, so the send buttons are never a
  // no-op the admin has to discover by clicking.
  const selectTop = useCallback(
    (rows, cap) => {
      const limit = cap > 0 ? cap : rows.length;
      setSelectedIds(rows.slice(0, limit).map((p) => p.id));
    },
    [],
  );

  const toggleOne = (id) => {
    if (selectedSet.has(id)) {
      setSelectedIds((prev) => prev.filter((x) => x !== id));
      return;
    }
    // Refuse rather than silently evict someone else's pick — the admin
    // decides what to drop. Checked here, not inside the state updater:
    // React may run an updater twice (StrictMode does in development), and
    // a toast in there fired twice.
    if (sendCap > 0 && selectedIds.length >= sendCap) {
      toast.error(t('sweep.capReached', "That's the {{n}}-listing cap. Untick one first, or raise the cap.", { n: sendCap }));
      return;
    }
    setSelectedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  // Only the two sorts this change added are translated; the older labels
  // are still English across this admin tab.
  const SORT_LABEL_KEYS = { newest: 'sweep.sortNewest', oldest: 'sweep.sortOldest' };

  // Live size of the message that will actually be sent.
  const messageText = useMemo(
    () =>
      selectedProperties.length
        ? buildCopyText(selectedProperties, appliedFilters || {})
        : '',
    [selectedProperties, appliedFilters],
  );
  // Measured as the encoded link, which is what WhatsApp truncates.
  const waLength = messageText ? whatsappUrl(messageText).length : 0;
  const overWaLimit = waLength > WA_URL_LIMIT;

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

  // Single source of truth for the filter payload — used by generate and
  // save alike, so a saved preset can never disagree with what was on
  // screen when it was saved.
  //
  // Rent is sent only when the rent inputs are live. For a vacation-like
  // category they are disabled and blank, but the state behind them was
  // still sent, so a saved vacation preset kept a hidden rent bound that
  // came back the moment its category was switched to long-term.
  const rentLive = !VACATION_LIKE_CATEGORIES.has(rentalCategory);
  const currentFilters = () => ({
    location: location.trim() || null,
    min_monthly_rent_ils: rentLive && minRent !== '' ? Number(minRent) : null,
    max_monthly_rent_ils: rentLive && maxRent !== '' ? Number(maxRent) : null,
    min_bedrooms: minBedrooms === '' ? null : Number(minBedrooms),
    max_bedrooms: maxBedrooms === '' ? null : Number(maxBedrooms),
    availability,
    rental_category: rentalCategory,
    listed_within_days: listedWithin === '' ? null : Number(listedWithin),
  });

  const generate = async () => {
    // Catch the inverted range here rather than letting the server answer
    // "0 properties matched", which reads like empty inventory.
    if (rentLive && minRent !== '' && maxRent !== '' && Number(minRent) > Number(maxRent)) {
      toast.error(t('sweep.minRentOverMax', 'Minimum rent is higher than the maximum.'));
      return;
    }
    if (
      minBedrooms !== '' &&
      maxBedrooms !== '' &&
      Number(minBedrooms) > Number(maxBedrooms)
    ) {
      toast.error(t('sweep.minBedsOverMax', 'Minimum bedrooms is higher than the maximum.'));
      return;
    }
    setLoading(true);
    setResults(null);
    setSelectedIds([]);
    const snapshot = currentFilters();
    try {
      const res = await axios.post(
        `${API}/admin/smart-lists/generate`,
        snapshot,
        { headers },
      );
      setResults(res.data);
      setAppliedFilters(snapshot);
      // Pre-tick the first N in the order the server returned. The admin
      // adjusts from there instead of starting from an empty selection
      // and a dead "Share" button.
      selectTop(
        applySort(res.data.properties, sortOrder, res.data.usd_to_ils_rate) || [],
        sendCap,
      );
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
        { name: savingName.trim(), ...currentFilters() },
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
      setMinRent(filters?.min_monthly_rent_ils ?? '');
      setMaxRent(filters?.max_monthly_rent_ils ?? '');
      setMinBedrooms(filters?.min_bedrooms ?? '');
      setMaxBedrooms(filters?.max_bedrooms ?? '');
      setRentalCategory(filters?.rental_category || 'any');
      setAvailability(filters?.availability || 'anytime');
      setListedWithin(
        filters?.listed_within_days == null ? '' : String(filters.listed_within_days),
      );
      setResults({
        properties: res.data.properties,
        count: res.data.properties.length,
        usd_to_ils_rate: res.data.usd_to_ils_rate,
      });
      setAppliedFilters(filters || {});
      selectTop(
        applySort(res.data.properties, sortOrder, res.data.usd_to_ils_rate) || [],
        sendCap,
      );
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
    if (!selectedProperties.length) return;
    const text = messageText;
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
    if (!selectedProperties.length) return;
    // Truncating silently is how the tail of a long list used to vanish
    // without anyone noticing. Refuse instead and say what to do — the
    // selection UI above makes "untick a few" a two-second fix.
    if (overWaLimit) {
      toast.error(
        t(
          'sweep.tooLongForWhatsApp',
          'Too long for one WhatsApp message ({{used}} of {{max}} characters). Untick a few listings and try again.',
          { used: waLength.toLocaleString(), max: WA_URL_LIMIT.toLocaleString() },
        ),
      );
      return;
    }
    window.open(whatsappUrl(messageText), '_blank', 'noopener,noreferrer');
  };

  // Autocomplete suggestions: prefix match on the canonical area values.
  // (Removed — location is now a dropdown of areas that actually have
  // active listings.)

  return (
    <div className="space-y-6" data-testid="smart-lists-tab">
      <div className="flex items-start gap-3">
        <div className="w-11 h-11 rounded-xl bg-[rgb(var(--gold-rgb)/<alpha-value>)]/15 flex items-center justify-center shrink-0">
          <Sparkles size={20} className="text-[var(--gold)]" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{t("sweep.smartLists", "Smart Lists")}</h2>
          <p className="text-sm text-gray-500 mt-1">
            {t(
              'sweep.smartListsIntro',
              'Filter active rentals, tick the ones worth sending, and share a short list on WhatsApp, email or Telegram.',
            )}
          </p>
        </div>
      </div>

      {/* ---------------- Filters ---------------- */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Location — dropdown of areas with at least one active listing */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <MapPin size={12} /> Location
          </label>
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 focus:border-[var(--brand-primary)] text-sm bg-white"
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
            className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 focus:border-[var(--brand-primary)] text-sm bg-white"
            data-testid="smart-list-rental-category-select"
          >
            {RENTAL_CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Rent range — disabled for vacation / sukkot / pesach */}
        {(() => {
          const isVacationLike = VACATION_LIKE_CATEGORIES.has(rentalCategory);
          const priceInput =
            'w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 focus:border-[var(--brand-primary)] text-sm disabled:bg-gray-50 disabled:text-gray-400';
          return (
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
                <Banknote size={12} /> {t('sweep.monthlyRentRange', 'Monthly rent (₪)')}
              </label>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="number"
                  value={isVacationLike ? '' : minRent}
                  onChange={(e) => setMinRent(e.target.value)}
                  disabled={isVacationLike}
                  placeholder={isVacationLike ? '—' : t('sweep.minShort', 'Min')}
                  className={priceInput}
                  data-testid="smart-list-min-rent-input"
                  min="0"
                />
                <span className="text-gray-300 text-sm shrink-0">–</span>
                <input
                  type="number"
                  value={isVacationLike ? '' : maxRent}
                  onChange={(e) => setMaxRent(e.target.value)}
                  disabled={isVacationLike}
                  placeholder={isVacationLike ? '—' : t('sweep.maxShort', 'Max')}
                  className={priceInput}
                  data-testid="smart-list-max-rent-input"
                  min="0"
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-1">
                {isVacationLike
                  ? t('sweep.priceOffForVacation', 'Price filter disabled for vacation rentals.')
                  : t('sweep.usdAutoConverted', 'USD listings auto-converted to ILS before filtering.')}
              </p>
            </div>
          );
        })()}

        {/* Bedrooms — a range, so "3 bedroom" doesn't drag in every penthouse */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <Bed size={12} /> {t('sweep.bedroomsRange', 'Bedrooms')}
          </label>
          <div className="mt-2 flex items-center gap-2">
            <select
              value={minBedrooms}
              onChange={(e) => setMinBedrooms(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 focus:border-[var(--brand-primary)] text-sm bg-white"
              data-testid="smart-list-bedrooms-select"
              aria-label={t('sweep.minBedroomsAria', 'Minimum bedrooms')}
            >
              <option value="">{t('sweep.anyMin', 'Any')}</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span className="text-gray-300 text-sm shrink-0">–</span>
            <select
              value={maxBedrooms}
              onChange={(e) => setMaxBedrooms(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 focus:border-[var(--brand-primary)] text-sm bg-white"
              data-testid="smart-list-max-bedrooms-select"
              aria-label={t('sweep.maxBedroomsAria', 'Maximum bedrooms')}
            >
              <option value="">{t('sweep.anyMax', 'Any')}</option>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Availability */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <Calendar size={12} /> Availability
          </label>
          <select
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 focus:border-[var(--brand-primary)] text-sm bg-white"
            data-testid="smart-list-availability-select"
          >
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Recently added — the "here's what's new this week" blast */}
        <div>
          <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1.5">
            <Clock size={12} /> {t('sweep.addedToSite', 'Added to site')}
          </label>
          <select
            value={listedWithin}
            onChange={(e) => setListedWithin(e.target.value)}
            className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 focus:border-[var(--brand-primary)] text-sm bg-white"
            data-testid="smart-list-listed-within-select"
          >
            {LISTED_WITHIN_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(`sweep.listedWithin${o.value || 'Any'}`, o.label)}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-gray-400 mt-1">
            {t(
              'sweep.addedToSiteHint',
              'Listings without an added-on date are left out of a recent list.',
            )}
          </p>
        </div>

        <div className="md:col-span-3 lg:col-span-6 flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={generate}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--brand-primary)] text-white text-sm font-semibold hover:bg-[#175555] disabled:opacity-50 transition-colors"
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
                disabled={!selectedProperties.length}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                data-testid="smart-list-copy-btn"
              >
                {copyOk ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
                {copyOk
                  ? t('sweep.copied', 'Copied')
                  : t('sweep.copySelected', 'Copy {{n}} selected', { n: selectedProperties.length })}
              </button>
              {/* Sort selector — applies to copy / WhatsApp / on-screen
                  list together so all three views always agree. Only
                  relevant once a list has been generated, hence the
                  ``results &&`` guard above. */}
              <label className="inline-flex items-center gap-2 px-3 py-2.5 rounded-xl bg-white border border-gray-200 text-sm text-gray-700">
                <span className="text-xs text-gray-500 font-medium">{t("sweep.sortBy", "Sort by")}</span>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="bg-transparent text-sm font-semibold text-gray-800 focus:outline-none cursor-pointer"
                  data-testid="smart-list-sort-select"
                  aria-label="Sort list by"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {SORT_LABEL_KEYS[opt.value] ? t(SORT_LABEL_KEYS[opt.value], opt.label) : opt.label}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={shareToWhatsApp}
                disabled={!selectedProperties.length || overWaLimit}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#25D366] text-white text-sm font-semibold hover:bg-[#1ebe57] disabled:opacity-40 transition-colors"
                data-testid="smart-list-whatsapp-btn"
              >
                <MessageCircle size={16} />{' '}
                {t('sweep.shareSelectedWhatsApp', 'Share {{n}} on WhatsApp', {
                  n: selectedProperties.length,
                })}
              </button>
              <button
                type="button"
                onClick={() => setShowSaveBox((v) => !v)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                data-testid="smart-list-save-toggle"
              >
                <Save size={16} /> {t('sweep.saveThisList', 'Save this list')}
              </button>
            </>
          )}
        </div>

        {showSaveBox && (
          <div className="md:col-span-3 lg:col-span-6 flex flex-wrap items-center gap-2 pt-2">
            <input
              type="text"
              value={savingName}
              onChange={(e) => setSavingName(e.target.value)}
              placeholder='e.g. "Ramat Eshkol Under 10k – June 2026"'
              className="flex-1 min-w-[260px] px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 focus:border-[var(--brand-primary)] text-sm"
              data-testid="smart-list-save-name-input"
            />
            <button
              type="button"
              onClick={saveList}
              className="px-4 py-2.5 rounded-xl bg-[var(--gold)] text-[var(--brand-primary)] text-sm font-semibold hover:opacity-90"
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
          <div className="flex items-center justify-between mb-2 gap-3 flex-wrap">
            <h3 className="text-lg font-bold text-gray-900">
              {/* Interpolated as `n`, never `count`: i18next treats `count`
                  as a plural trigger and resolves a suffixed key, which
                  Hebrew (one/two/many/other) would need a different key
                  set for than English. See utils/listedAgo.js. */}
              {t('sweep.matchedSelected', '{{n}} matched · {{sel}} selected', {
                n: results?.count ?? 0,
                sel: selectedIds.length,
              })}
            </h3>
            {results.usd_to_ils_rate && (
              <span className="text-xs text-gray-400">
                USD→ILS rate: {Number(results.usd_to_ils_rate).toFixed(3)}
              </span>
            )}
          </div>

          {/* ---- Selection toolbar ----
              The whole point of the tab at this scale: the filters decide
              what is eligible, this row decides what is actually sent. */}
          {sortedProperties.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-2 mb-4 pb-4 border-b border-gray-100"
              data-testid="smart-list-selection-toolbar"
            >
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
                <ListFilter size={14} className="text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">
                  {t('sweep.maxPerMessage', 'Max per message')}
                </span>
                <select
                  value={sendCap}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setSendCap(next);
                    // Trim an over-cap selection down rather than leaving
                    // the count and the cap contradicting each other.
                    if (next > 0) {
                      setSelectedIds((prev) => (prev.length > next ? prev.slice(0, next) : prev));
                    }
                  }}
                  className="bg-transparent text-sm font-semibold text-gray-800 focus:outline-none cursor-pointer"
                  data-testid="smart-list-cap-select"
                >
                  {SEND_CAP_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n === 0 ? t('sweep.noCap', 'No cap') : n}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => selectTop(sortedProperties, sendCap)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
                data-testid="smart-list-select-top-btn"
              >
                <CheckSquare size={14} />
                {sendCap > 0
                  ? t('sweep.selectTopN', 'Select top {{n}}', {
                      n: Math.min(sendCap, sortedProperties.length),
                    })
                  : t('sweep.selectAll', 'Select all')}
              </button>

              <button
                type="button"
                onClick={() => setSelectedIds([])}
                disabled={!selectedIds.length}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                data-testid="smart-list-clear-selection-btn"
              >
                <Square size={14} /> {t('sweep.clearSelection', 'Clear')}
              </button>

              {/* Live message size. The old build truncated past the wa.me
                  limit without telling anyone; this makes the ceiling
                  visible before the send instead of after it. */}
              {selectedProperties.length > 0 && (
                <span
                  className={`text-xs ms-auto ${overWaLimit ? 'text-red-600 font-semibold' : 'text-gray-400'}`}
                  data-testid="smart-list-char-count"
                >
                  {t('sweep.messageLength', '{{used}} / {{max}} link characters', {
                    used: waLength.toLocaleString(),
                    max: WA_URL_LIMIT.toLocaleString(),
                  })}
                  {overWaLimit
                    ? ` · ${t('sweep.tooLongUntick', 'too long for one WhatsApp message')}`
                    : ''}
                </span>
              )}
            </div>
          )}
          {/* Live preview of the title block recipients will see in the
              WhatsApp/copy output. Keeps the broker confident that the share
              text is going to read right before they hit send. */}
          {appliedFilters && (
            <div className="mb-4 pb-3 border-b border-gray-100">
              <p className="text-xs uppercase tracking-wider text-gray-400">{t("sweep.listHeader", "List header")}</p>
              {/* Mock WhatsApp link-preview card so the admin can see the
                  MyIsraelRental logo will sit on top of the shared list. */}
              {/* `flex` + `w-full`, not `inline-flex`: an inline-flex box
                  sizes to its content and refuses to shrink, so the
                  truncate on the lines below never engaged and this mock
                  card pushed the whole tab into horizontal scroll on a
                  phone. */}
              <div className="mt-2 mb-3 flex w-full items-center gap-3 px-3 py-2 rounded-xl border border-gray-200 bg-gray-50 max-w-md">
                <img
                  src="/brand-logo.png"
                  alt="MyIsraelRental logo"
                  className="w-12 h-12 rounded-lg object-contain bg-white shrink-0"
                />
                <div className="min-w-0">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wide">{t("sweep.whatsappPreview", "WhatsApp preview")}</p>
                  <p className="text-sm font-bold text-gray-900 truncate">MyIsraelRental — Rentals across Israel</p>
                  <p className="text-[11px] text-gray-500 truncate">myisraelrental.com</p>
                </div>
              </div>
              <p className="text-xl font-extrabold text-[var(--brand-primary)]">MyIsraelRental.com</p>
              <p className="text-sm font-semibold text-gray-700">
                {buildHeader(appliedFilters)[1]}
              </p>
            </div>
          )}
          {sortedProperties.length === 0 ? (
            <p className="text-sm text-gray-500">No properties match — try widening the filters.</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sortedProperties.map((p) => {
                const displayArea = appliedFilters?.location || p.area || 'Israel';
                const beds = formatBedrooms(p.bedrooms);
                const addedLabel = formatAdded(p.created_at, t);
                const isSelected = selectedSet.has(p.id);
                // Only rows that are OUT and blocked by the cap get the
                // disabled treatment — a selected row must always stay
                // clickable so the admin can swap one out for another.
                const blocked = !isSelected && capReached;
                return (
                <li key={p.id} data-testid={`smart-list-row-${p.id}`}>
                  {/* The whole row is the label, so the text beside the box
                      is a click target too, not just a 16px square. Selection
                      is shown by an inline-start bar, not by dimming the
                      unselected rows: opacity-70 took their grey text to
                      2.8:1 and 3.6:1, under the 4.5:1 floor, on exactly the
                      rows the admin reads to decide what to swap in. */}
                  <label
                    className={`py-4 ps-3 flex items-start gap-3 border-s-2 ${
                      isSelected ? 'border-[var(--brand-primary)]' : 'border-transparent'
                    } ${blocked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    disabled={blocked}
                    onChange={() => toggleOne(p.id)}
                    className="mt-1 w-4 h-4 shrink-0 accent-[var(--brand-primary)] cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                    data-testid={`smart-list-check-${p.id}`}
                    // Area AND price: on a list filtered to one area, the
                    // area alone gave every checkbox the same name.
                    aria-label={t('sweep.includeListing', 'Include {{area}}, {{price}} in the message', {
                      area: displayArea,
                      price: `${formatPrice(p.price, p.currency)}${p.price_label || ''}`,
                    })}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                      <MapPin size={13} className="text-[var(--brand-primary)] shrink-0" />
                      <span className="truncate">{displayArea}</span>
                    </p>
                    <p className="text-sm text-gray-600 mt-0.5">
                      <span className="font-medium" style={{ color: 'var(--gold)' }}>
                        {formatPrice(p.price, p.currency)}
                        {p.price_label || ''}
                      </span>
                      {p.currency === 'USD' && p.price_ils_equivalent != null && (
                        <span className="text-xs text-gray-400 ms-1.5">
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
                      {addedLabel && (
                        <>
                          <span className="text-gray-300 mx-1.5">·</span>
                          <span className="text-[var(--brand-primary)] font-medium">{addedLabel}</span>
                        </>
                      )}
                    </p>
                    <a
                      href={p.listing_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 mt-1 text-xs text-[var(--brand-primary)] hover:underline"
                      data-testid={`smart-list-link-${p.id}`}
                    >
                      <ExternalLink size={11} />
                      <span className="truncate max-w-[460px]">{p.listing_url}</span>
                    </a>
                  </div>
                  </label>
                </li>
              );})}
            </ul>
          )}
        </div>
      )}

      {/* The alias manager used to render here, at the bottom of an
          unrelated tab — reachable, but not somewhere anyone would look.
          It has its own entry under Tools now (spec A2). */}

      {/* ---------------- Saved lists ---------------- */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6" data-testid="smart-list-saved-section">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t("sweep.savedLists", "Saved lists")}</h3>
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
                  <p className="text-sm font-semibold text-gray-900 truncate hover:text-[var(--brand-primary)]">
                    {s.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {describeFilters(s.filters)}
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

