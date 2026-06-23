import React, { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Sparkles, RefreshCw, Loader2, Check, Info, TrendingUp, TrendingDown, Mail } from 'lucide-react';

/**
 * Smart Pricing modal — opened from each VACATION PropertyCard on the
 * owner dashboard. Three tabs in one view:
 *   1. **Rules**: toggle, auto-apply, min/base/max, per-rule percentages
 *   2. **Calendar**: next 60 nights with color-coded suggested prices
 *      and per-date Apply / Revert
 *   3. **Forecast**: estimated revenue at base rate vs Smart Pricing
 *
 * The same Calendar tab also surfaces the human-readable "why" string for
 * every date so owners can audit the engine's decisions before applying.
 */

const RuleSlider = ({ label, value, onChange, min = 0, max = 100, step = 1, suffix = '%', help, testid }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between text-sm">
      <span className="font-medium text-gray-700 flex items-center gap-1.5">
        {label}
        {help && (
          <span className="text-gray-400 cursor-help" title={help}>
            <Info size={13} />
          </span>
        )}
      </span>
      <span className="font-mono text-[#1E6A6A]" data-testid={`${testid}-value`}>
        {value}{suffix}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="w-full accent-[#D4AF37]"
      data-testid={testid}
    />
  </div>
);

const NumericInput = ({ label, value, onChange, suffix, testid }) => (
  <div className="flex-1">
    <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
    <div className="relative">
      <input
        type="number"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
        data-testid={testid}
      />
      {suffix && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
          {suffix}
        </span>
      )}
    </div>
  </div>
);

const DEFAULT_SETTINGS = {
  enabled: false,
  auto_apply: false,
  base_nightly: null,
  min_nightly: 50,
  max_nightly: 5000,
  weekend_premium_pct: 20,
  holiday_premium_pct: 35,
  last_minute_discount_pct: 10,
  lead_time_premium_pct: 5,
  high_demand_premium_pct: 12,
  low_demand_discount_pct: 8,
  comparable_blend_pct: 10,
};

const SmartPricingModal = ({ isOpen, onClose, property, API, token }) => {
  const [tab, setTab] = useState('rules');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [currency, setCurrency] = useState('ILS');
  const [baseFallback, setBaseFallback] = useState(0);
  const [suggestions, setSuggestions] = useState([]);
  const [forecast, setForecast] = useState(null);

  const sym = currency === 'USD' ? '$' : '₪';
  const authHeaders = useMemo(
    () => ({ headers: { Authorization: `Bearer ${token}` } }),
    [token],
  );

  // Load existing settings whenever the modal opens for a property
  const loadSettings = useCallback(async () => {
    if (!property?.id) return;
    setLoading(true);
    try {
      const r = await axios.get(
        `${API}/properties/${property.id}/smart-pricing/settings`,
        authHeaders,
      );
      setSettings({ ...DEFAULT_SETTINGS, ...r.data.settings });
      setCurrency(r.data.currency || 'ILS');
      setBaseFallback(r.data.base_fallback || 0);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to load Smart Pricing settings');
    } finally {
      setLoading(false);
    }
  }, [API, property?.id, authHeaders]);

  // Pull suggestions whenever the user switches to the Calendar/Forecast tab
  const calculateSuggestions = useCallback(async (silent = false) => {
    if (!property?.id) return;
    setCalculating(true);
    try {
      const r = await axios.post(
        `${API}/properties/${property.id}/smart-pricing/calculate`,
        { days: 60 },
        authHeaders,
      );
      setSuggestions(r.data.suggestions || []);
      setForecast(r.data.forecast || null);
      if (!silent) toast.success(`Calculated ${r.data.suggestions?.length || 0} nights`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to calculate suggestions');
    } finally {
      setCalculating(false);
    }
  }, [API, property?.id, authHeaders]);

  useEffect(() => {
    if (isOpen) {
      setTab('rules');
      loadSettings();
    } else {
      // Reset so the next open starts clean
      setSuggestions([]);
      setForecast(null);
    }
  }, [isOpen, loadSettings]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await axios.patch(
        `${API}/properties/${property.id}/smart-pricing/settings`,
        settings,
        authHeaders,
      );
      toast.success('Smart Pricing settings saved');
      // If the user just enabled it, immediately calculate so the Calendar
      // tab has something to render when they click into it.
      if (settings.enabled) {
        calculateSuggestions(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const applyAll = async () => {
    try {
      const r = await axios.post(
        `${API}/properties/${property.id}/smart-pricing/apply`,
        { days: 60 },
        authHeaders,
      );
      toast.success(`Applied ${r.data.applied_count} nights to your calendar`);
      calculateSuggestions(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to apply');
    }
  };

  const applyOne = async (day) => {
    try {
      await axios.post(
        `${API}/properties/${property.id}/smart-pricing/apply`,
        { dates: [day] },
        authHeaders,
      );
      calculateSuggestions(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to apply');
    }
  };

  const revertOne = async (day) => {
    try {
      await axios.delete(
        `${API}/properties/${property.id}/smart-pricing/apply/${day}`,
        authHeaders,
      );
      calculateSuggestions(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to revert');
    }
  };

  // ---- Weekly digest controls (Pricing Insights email) ----
  const [digestPref, setDigestPref] = useState({ optout: false, last_sent_at: null });
  const [sendingSample, setSendingSample] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    axios
      .get(`${API}/smart-pricing/insights/preferences`, authHeaders)
      .then((r) => setDigestPref(r.data))
      .catch(() => {});
  }, [isOpen, API, authHeaders]);

  const toggleDigestOptout = async (next) => {
    try {
      await axios.patch(
        `${API}/smart-pricing/insights/preferences`,
        { optout: next },
        authHeaders,
      );
      setDigestPref((p) => ({ ...p, optout: next }));
      toast.success(next ? 'Weekly digest paused' : 'Weekly digest resumed');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update preference');
    }
  };

  const sendSampleDigest = async () => {
    setSendingSample(true);
    try {
      const r = await axios.post(
        `${API}/smart-pricing/insights/send-sample`,
        {},
        authHeaders,
      );
      toast.success(`Sample digest sent to ${r.data.sent_to}`);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not send sample');
    } finally {
      setSendingSample(false);
    }
  };

  if (!isOpen || !property) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
      data-testid="smart-pricing-modal"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#D4AF37] to-[#1E6A6A] flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">Smart Pricing</h2>
              <p className="text-xs text-gray-500 truncate max-w-[400px]">{property.title}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
            data-testid="smart-pricing-close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab strip */}
        <div className="px-6 pt-3 border-b border-gray-100 flex gap-1">
          {[
            { id: 'rules', label: 'Rules' },
            { id: 'calendar', label: 'Calendar' },
            { id: 'forecast', label: 'Forecast' },
          ].map((tdef) => (
            <button
              key={tdef.id}
              onClick={() => {
                setTab(tdef.id);
                if ((tdef.id === 'calendar' || tdef.id === 'forecast') && suggestions.length === 0) {
                  calculateSuggestions(true);
                }
              }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                tab === tdef.id
                  ? 'border-[#D4AF37] text-[#1E6A6A]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              data-testid={`smart-pricing-tab-${tdef.id}`}
            >
              {tdef.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-[#1E6A6A]" size={28} />
            </div>
          ) : tab === 'rules' ? (
            <RulesTab
              settings={settings}
              setSettings={setSettings}
              sym={sym}
              baseFallback={baseFallback}
              digestPref={digestPref}
              onToggleDigestOptout={toggleDigestOptout}
              onSendSampleDigest={sendSampleDigest}
              sendingSample={sendingSample}
            />
          ) : tab === 'calendar' ? (
            <CalendarTab
              suggestions={suggestions}
              calculating={calculating}
              onRefresh={() => calculateSuggestions(false)}
              onApply={applyOne}
              onRevert={revertOne}
              onApplyAll={applyAll}
              sym={sym}
            />
          ) : (
            <ForecastTab forecast={forecast} sym={sym} calculating={calculating} />
          )}
        </div>

        {/* Footer */}
        {tab === 'rules' && !loading && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
            <p className="text-xs text-gray-500">
              {settings.enabled
                ? settings.auto_apply
                  ? 'Auto-apply ON — suggestions write to your calendar daily.'
                  : 'Suggest mode — review and apply prices yourself.'
                : 'Smart Pricing is OFF for this property.'}
            </p>
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-all"
              style={{ backgroundColor: '#1E6A6A' }}
              data-testid="smart-pricing-save"
            >
              {saving ? <Loader2 className="animate-spin inline mr-1" size={14} /> : null}
              Save Settings
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab: Rules
// ---------------------------------------------------------------------------
const RulesTab = ({
  settings,
  setSettings,
  sym,
  baseFallback,
  digestPref,
  onToggleDigestOptout,
  onSendSampleDigest,
  sendingSample,
}) => {
  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  return (
    <div className="space-y-6">
      {/* Master toggle row */}
      <div className="flex items-start justify-between p-4 rounded-xl bg-gradient-to-r from-[#fff8e6] to-white border border-[#D4AF37]/30">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Enable Smart Pricing</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Let MyIsraelRental suggest nightly rates based on day-of-week, Israeli holidays,
            lead time, demand, and comparable rentals in your area.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer ml-4">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => set('enabled', e.target.checked)}
            className="sr-only peer"
            data-testid="smart-pricing-enabled-toggle"
          />
          <div className="w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-[#1E6A6A] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
        </label>
      </div>

      {/* Auto-apply */}
      <div className="flex items-start justify-between p-4 rounded-xl border border-gray-200">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Auto-apply daily</p>
          <p className="text-xs text-gray-600 mt-0.5">
            Off → I&apos;ll review suggestions and click apply. On → write suggestions straight to my
            calendar every night at 03:00.
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer ml-4">
          <input
            type="checkbox"
            checked={settings.auto_apply}
            onChange={(e) => set('auto_apply', e.target.checked)}
            disabled={!settings.enabled}
            className="sr-only peer"
            data-testid="smart-pricing-autoapply-toggle"
          />
          <div className="w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-[#D4AF37] peer-disabled:opacity-40 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
        </label>
      </div>

      {/* Price bands */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Price bands</h3>
        <div className="flex gap-3">
          <NumericInput
            label="Min nightly"
            value={settings.min_nightly}
            onChange={(v) => set('min_nightly', v)}
            suffix={sym}
            testid="smart-pricing-min"
          />
          <NumericInput
            label={`Base nightly${baseFallback ? ` (current ${sym}${baseFallback})` : ''}`}
            value={settings.base_nightly}
            onChange={(v) => set('base_nightly', v)}
            suffix={sym}
            testid="smart-pricing-base"
          />
          <NumericInput
            label="Max nightly"
            value={settings.max_nightly}
            onChange={(v) => set('max_nightly', v)}
            suffix={sym}
            testid="smart-pricing-max"
          />
        </div>
        <p className="text-[11px] text-gray-500 mt-2">
          Leave Base blank to use your listing&apos;s regular nightly price ({sym}{baseFallback}).
        </p>
      </div>

      {/* Rule sliders */}
      <div>
        <h3 className="text-sm font-bold text-gray-900 mb-3">Adjustments</h3>
        <div className="space-y-4">
          <RuleSlider
            label="Weekend premium (Fri/Sat)"
            value={settings.weekend_premium_pct}
            onChange={(v) => set('weekend_premium_pct', v)}
            help="Israeli weekend nights — Friday and Saturday — get this percentage added on top of your base."
            testid="smart-pricing-weekend"
          />
          <RuleSlider
            label="Jewish-holiday premium"
            value={settings.holiday_premium_pct}
            max={150}
            help="Major Israeli holidays (Sukkot, Pesach, Rosh Hashana, Shavuot, Yom Kippur). Pulled live from Hebcal."
            testid="smart-pricing-holiday"
          />
          <RuleSlider
            label="Last-minute discount (≤7 days)"
            value={settings.last_minute_discount_pct}
            help="Discount nights that are within 7 days of today to convert leftover inventory."
            testid="smart-pricing-last-minute"
          />
          <RuleSlider
            label="Early-booking premium (≥90 days)"
            value={settings.lead_time_premium_pct}
            help="Bump nights that are far in the future — early bookers are more committed and less price-sensitive."
            testid="smart-pricing-lead-time"
          />
          <RuleSlider
            label="High-demand premium"
            value={settings.high_demand_premium_pct}
            help="When your listing gets ≥1.3× the area's median page views in the last 14 days."
            testid="smart-pricing-high-demand"
          />
          <RuleSlider
            label="Low-demand discount"
            value={settings.low_demand_discount_pct}
            help="When your listing gets ≤0.5× the area's median page views in the last 14 days."
            testid="smart-pricing-low-demand"
          />
          <RuleSlider
            label="Comparable-rentals blend"
            value={settings.comparable_blend_pct}
            max={50}
            help="How strongly to pull suggestions toward the median nightly of similar listings in your area. 0 = ignore market."
            testid="smart-pricing-blend"
          />
        </div>
      </div>

      {/* Weekly Pricing Insights digest controls */}
      <div className="p-4 rounded-xl border border-gray-200 bg-white">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
              <Mail size={14} className="text-[#1E6A6A]" />
              Weekly Pricing Insights digest
            </p>
            <p className="text-xs text-gray-600 mt-1 leading-relaxed">
              Every Sunday morning we email you a roundup across ALL your Smart-Pricing
              listings — projected next-30-day revenue vs flat base rate, nights applied
              this week, and the biggest single adjustment per property.
            </p>
            {digestPref?.last_sent_at && (
              <p className="text-[11px] text-gray-400 mt-1">
                Last sent: {new Date(digestPref.last_sent_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
              </p>
            )}
          </div>
          <label className="relative inline-flex items-center cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={!digestPref?.optout}
              onChange={(e) => onToggleDigestOptout(!e.target.checked)}
              className="sr-only peer"
              data-testid="pricing-insights-toggle"
            />
            <div className="w-11 h-6 bg-gray-300 rounded-full peer-checked:bg-[#1E6A6A] transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform peer-checked:after:translate-x-5" />
          </label>
        </div>
        <button
          onClick={onSendSampleDigest}
          disabled={sendingSample}
          className="mt-3 text-xs font-semibold text-[#1E6A6A] hover:underline disabled:opacity-50 flex items-center gap-1"
          data-testid="pricing-insights-send-sample"
        >
          {sendingSample ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
          Email me a sample now
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab: Calendar
// ---------------------------------------------------------------------------
const CalendarTab = ({ suggestions, calculating, onRefresh, onApply, onRevert, onApplyAll, sym }) => {
  if (calculating && suggestions.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-[#1E6A6A]" size={28} />
      </div>
    );
  }
  if (suggestions.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 text-sm mb-4">No suggestions yet.</p>
        <button
          onClick={onRefresh}
          className="px-5 py-2 rounded-lg text-sm font-semibold text-white"
          style={{ backgroundColor: '#1E6A6A' }}
          data-testid="smart-pricing-calc-first"
        >
          Calculate Suggestions
        </button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">
          Next <strong>{suggestions.length}</strong> nights — color-coded by direction.
        </p>
        <div className="flex gap-2">
          <button
            onClick={onRefresh}
            disabled={calculating}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:border-[#D4AF37] flex items-center gap-1.5 disabled:opacity-50"
            data-testid="smart-pricing-refresh"
          >
            <RefreshCw size={12} className={calculating ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={onApplyAll}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
            style={{ backgroundColor: '#D4AF37' }}
            data-testid="smart-pricing-apply-all"
          >
            Apply All to Calendar
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
        {suggestions.map((s) => {
          const delta = s.price - s.base;
          const isApplied = s.override === s.price;
          const isBooked = s.booked;
          // Color by direction + apply state
          let bg = '#f5f5f0';
          let txt = '#1E6A6A';
          if (isBooked) { bg = '#e5e7eb'; txt = '#6b7280'; }
          else if (delta > 0) { bg = '#dcfce7'; txt = '#166534'; }
          else if (delta < 0) { bg = '#fef3c7'; txt = '#92400e'; }
          return (
            <div
              key={s.date}
              className={`relative p-2.5 rounded-lg border ${isApplied ? 'border-[#D4AF37]' : 'border-transparent'}`}
              style={{ backgroundColor: bg }}
              title={s.reason}
              data-testid={`smart-pricing-day-${s.date}`}
            >
              <div className="text-[10px] uppercase font-bold tracking-wide" style={{ color: txt }}>
                {new Date(s.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </div>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-base font-bold" style={{ color: txt }}>
                  {sym}{s.price}
                </span>
                {delta !== 0 && (
                  <span className="text-[10px] font-semibold flex items-center" style={{ color: txt }}>
                    {delta > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {Math.abs(delta)}
                  </span>
                )}
              </div>
              {isBooked && (
                <div className="text-[9px] text-gray-500 mt-0.5">Booked</div>
              )}
              {!isBooked && (
                <div className="mt-1">
                  {isApplied ? (
                    <button
                      onClick={() => onRevert(s.date)}
                      className="text-[10px] text-gray-600 hover:text-red-600 flex items-center gap-0.5"
                      data-testid={`smart-pricing-revert-${s.date}`}
                    >
                      <Check size={10} className="text-green-600" /> Applied — undo
                    </button>
                  ) : (
                    <button
                      onClick={() => onApply(s.date)}
                      className="text-[10px] font-semibold text-[#1E6A6A] hover:underline"
                      data-testid={`smart-pricing-apply-${s.date}`}
                    >
                      Apply
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-500 mt-2">
        Hover each cell for the &ldquo;why&rdquo; — exact factors that nudged that night&apos;s price.
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Tab: Forecast
// ---------------------------------------------------------------------------
const ForecastTab = ({ forecast, sym, calculating }) => {
  if (calculating || !forecast) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="animate-spin text-[#1E6A6A]" size={28} />
      </div>
    );
  }
  const up = forecast.delta > 0;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="p-5 rounded-xl bg-gray-50 border border-gray-100">
          <p className="text-xs uppercase tracking-wide text-gray-500 font-semibold">At base rate</p>
          <p className="text-2xl font-bold text-gray-900 mt-1" data-testid="smart-pricing-base-total">
            {sym}{forecast.base_total.toLocaleString()}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            if every open night books at your flat nightly price
          </p>
        </div>
        <div
          className="p-5 rounded-xl border"
          style={{
            backgroundColor: up ? '#dcfce7' : '#fef3c7',
            borderColor: up ? '#16a34a' : '#d97706',
          }}
        >
          <p className="text-xs uppercase tracking-wide font-semibold" style={{ color: up ? '#166534' : '#92400e' }}>
            With Smart Pricing
          </p>
          <p className="text-2xl font-bold mt-1" style={{ color: up ? '#166534' : '#92400e' }} data-testid="smart-pricing-smart-total">
            {sym}{forecast.smart_total.toLocaleString()}
          </p>
          <p className="text-[11px] mt-1 flex items-center gap-1" style={{ color: up ? '#166534' : '#92400e' }}>
            {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {up ? '+' : ''}{forecast.delta.toLocaleString()} ({forecast.delta_pct}%)
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="flex justify-between p-3 rounded-lg bg-gray-50">
          <span className="text-gray-600">Open nights</span>
          <span className="font-semibold text-gray-900">{forecast.open_nights}</span>
        </div>
        <div className="flex justify-between p-3 rounded-lg bg-gray-50">
          <span className="text-gray-600">Already booked</span>
          <span className="font-semibold text-gray-900">{forecast.booked_nights}</span>
        </div>
      </div>
      <p className="text-[11px] text-gray-500">
        Forecast assumes 100% occupancy on open nights — useful for comparing pricing strategies,
        not as an absolute revenue guarantee.
      </p>
    </div>
  );
};

export default SmartPricingModal;
