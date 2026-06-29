/**
 * Admin UI for managing neighborhood aliases.
 *
 * An "alias" maps a user-typed area variant (street name, common typo,
 * colloquialism) to a canonical neighborhood — e.g. "Levi Eshkol" →
 * "Ramat Eshkol". Once added here, every property search (the public
 * filter dropdown, Smart Lists, saved-search alerts) will treat the
 * alias as the canonical neighborhood without a redeploy.
 *
 * Embedded inside SmartListsTab as a collapsible card — that's where
 * the admin will first notice missing entries in the location dropdown,
 * so fixing them happens in-context.
 */
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowRight, Tags, Wand2, Check, X, Undo2 } from 'lucide-react';
import { API } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';

const AreaAliasManager = ({ token }) => {
  const [alias, setAlias] = useState('');
  const [canonical, setCanonical] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [scanning, setScanning] = useState(false);
  // Confidence threshold for "Bulk map" (percent, 60-95).
  const [bulkThreshold, setBulkThreshold] = useState(90);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Last batch of alias IDs we created — used by Undo.
  const [lastBulkIds, setLastBulkIds] = useState([]);

  const { data: aliases = [], refresh } = useApiSWR(
    `${API}/admin/area-aliases`,
    token,
    { initial: [] },
  );

  const headers = { Authorization: `Bearer ${token}` };

  const addAlias = async (e) => {
    e?.preventDefault?.();
    if (!alias.trim() || !canonical.trim()) {
      toast.error('Both alias and canonical neighborhood are required');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API}/admin/area-aliases`,
        { alias: alias.trim(), canonical: canonical.trim() },
        { headers },
      );
      toast.success('Alias added');
      setAlias('');
      setCanonical('');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add alias');
    } finally {
      setSaving(false);
    }
  };

  const removeAlias = async (id) => {
    if (!window.confirm('Delete this alias?')) return;
    try {
      await axios.delete(`${API}/admin/area-aliases/${id}`, { headers });
      toast.success('Alias deleted');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  const scanForSuggestions = async () => {
    setScanning(true);
    try {
      const res = await axios.get(`${API}/admin/area-aliases/suggestions`, { headers });
      setSuggestions(res.data || []);
      if ((res.data || []).length === 0) {
        toast.success('No new suggestions — your catalog looks clean!');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to scan');
    } finally {
      setScanning(false);
    }
  };

  const acceptSuggestion = async (s) => {
    try {
      await axios.post(
        `${API}/admin/area-aliases`,
        { alias: s.suggested_alias, canonical: s.suggested_canonical },
        { headers },
      );
      toast.success(`Mapped ${s.suggested_alias} → ${s.suggested_canonical}`);
      // Drop accepted from the visible suggestions list (faster than re-scanning).
      setSuggestions((prev) =>
        (prev || []).filter((x) => x.unknown_value !== s.unknown_value),
      );
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to map');
    }
  };

  const dismissSuggestion = (s) => {
    setSuggestions((prev) =>
      (prev || []).filter((x) => x.unknown_value !== s.unknown_value),
    );
  };

  const bulkAcceptAboveThreshold = async () => {
    if (!suggestions?.length) return;
    const min = bulkThreshold / 100;
    const eligible = suggestions.filter((s) => s.confidence >= min);
    if (!eligible.length) {
      toast.info(`No suggestions at ≥ ${bulkThreshold}% confidence`);
      return;
    }
    setBulkBusy(true);
    try {
      const res = await axios.post(
        `${API}/admin/area-aliases/bulk`,
        {
          items: eligible.map((s) => ({
            alias: s.suggested_alias,
            canonical: s.suggested_canonical,
          })),
        },
        { headers },
      );
      const created = res.data?.created || [];
      const skipped = res.data?.skipped || [];
      if (created.length) {
        toast.success(`Mapped ${created.length} alias${created.length === 1 ? '' : 'es'}`);
      }
      if (skipped.length) {
        toast.message(`Skipped ${skipped.length} (duplicates / invalid)`);
      }
      setLastBulkIds(created.map((c) => c.id));
      // Drop accepted rows from the visible suggestions list.
      const acceptedAliases = new Set(created.map((c) => c.alias.toLowerCase()));
      setSuggestions((prev) =>
        (prev || []).filter(
          (s) => !acceptedAliases.has(s.suggested_alias.toLowerCase()),
        ),
      );
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Bulk map failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const undoBulk = async () => {
    if (!lastBulkIds.length) return;
    try {
      await axios.post(
        `${API}/admin/area-aliases/bulk-delete`,
        { ids: lastBulkIds },
        { headers },
      );
      toast.success(`Reverted ${lastBulkIds.length} alias${lastBulkIds.length === 1 ? '' : 'es'}`);
      setLastBulkIds([]);
      refresh();
      // Re-run the scan so the previously-accepted suggestions come back.
      await scanForSuggestions();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Undo failed');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6" data-testid="area-alias-manager">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
        data-testid="area-alias-toggle"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1E6A6A]/10 flex items-center justify-center shrink-0">
            <Tags size={16} className="text-[#1E6A6A]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Neighborhood aliases</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Map street names, typos, and colloquial forms to the right neighborhood
              {aliases.length > 0 && ` · ${aliases.length} active`}
            </p>
          </div>
        </div>
        <span className="text-sm text-[#1E6A6A] font-semibold">
          {expanded ? 'Hide' : 'Manage'}
        </span>
      </button>

      {expanded && (
        <div className="mt-5 space-y-5">
          <form
            onSubmit={addAlias}
            className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-3 md:items-end"
          >
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Alias (street name, typo, …)
              </label>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder='e.g. "Levi Eshkol"'
                className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
                data-testid="area-alias-alias-input"
                disabled={saving}
              />
            </div>
            <div className="hidden md:flex items-end pb-3 text-gray-400">
              <ArrowRight size={18} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Canonical neighborhood
              </label>
              <input
                type="text"
                value={canonical}
                onChange={(e) => setCanonical(e.target.value)}
                placeholder='e.g. "Ramat Eshkol" or "Jerusalem - Ramat Eshkol"'
                className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
                data-testid="area-alias-canonical-input"
                disabled={saving}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E6A6A] text-white text-sm font-semibold hover:bg-[#175555] disabled:opacity-50 transition-colors"
              data-testid="area-alias-add-btn"
            >
              <Plus size={16} /> Add
            </button>
          </form>

          <div className="border-t border-gray-100 pt-4">
            {aliases.length === 0 ? (
              <p className="text-sm text-gray-500" data-testid="area-alias-empty">
                No custom aliases yet. The seed alias &ldquo;Levi Eshkol → Ramat Eshkol&rdquo; is
                always active — you can add more here.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100" data-testid="area-alias-list">
                {aliases.map((a) => (
                  <li
                    key={a.id}
                    className="py-3 flex items-center justify-between gap-3"
                    data-testid={`area-alias-row-${a.id}`}
                  >
                    <div className="flex items-center gap-3 text-sm min-w-0">
                      <span className="font-medium text-gray-900 truncate">{a.alias}</span>
                      <ArrowRight size={13} className="text-gray-300 shrink-0" />
                      <span className="text-[#1E6A6A] font-semibold truncate">{a.canonical}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAlias(a.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      aria-label="Delete alias"
                      data-testid={`area-alias-delete-${a.id}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ----- Suggestions: scan catalog for unknown area variants ----- */}
          <div className="border-t border-gray-100 pt-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h4 className="text-sm font-bold text-gray-900">Suggest aliases</h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  Scans every listing for unrecognised neighborhood values and proposes
                  the closest canonical match.
                </p>
              </div>
              <button
                type="button"
                onClick={scanForSuggestions}
                disabled={scanning}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#D4AF37] text-[#1E6A6A] text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shrink-0"
                data-testid="area-alias-scan-btn"
              >
                <Wand2 size={14} /> {scanning ? 'Scanning…' : 'Scan catalog'}
              </button>
            </div>

            {suggestions !== null && suggestions.length === 0 && (
              <p className="text-sm text-gray-500" data-testid="area-alias-no-suggestions">
                ✨ Catalog is clean — every listing&rsquo;s neighborhood resolves correctly.
              </p>
            )}

            {suggestions !== null && suggestions.length > 0 && (
              <>
                <div className="mt-2 flex flex-wrap items-center gap-2 mb-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="text-xs font-semibold text-gray-700">Bulk map all at</span>
                  <select
                    value={bulkThreshold}
                    onChange={(e) => setBulkThreshold(Number(e.target.value))}
                    className="text-xs px-2 py-1.5 rounded-md border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30"
                    data-testid="area-alias-bulk-threshold"
                  >
                    <option value={95}>≥ 95% (very safe)</option>
                    <option value={90}>≥ 90% (recommended)</option>
                    <option value={85}>≥ 85%</option>
                    <option value={80}>≥ 80%</option>
                  </select>
                  <span className="text-xs text-gray-500">
                    ({suggestions.filter((s) => s.confidence >= bulkThreshold / 100).length} eligible)
                  </span>
                  <button
                    type="button"
                    onClick={bulkAcceptAboveThreshold}
                    disabled={bulkBusy}
                    className="ms-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#1E6A6A] text-white text-xs font-semibold hover:bg-[#175555] disabled:opacity-50 transition-colors"
                    data-testid="area-alias-bulk-accept-btn"
                  >
                    <Check size={12} /> {bulkBusy ? 'Mapping…' : 'Bulk map'}
                  </button>
                </div>

                {lastBulkIds.length > 0 && (
                  <div
                    className="mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-between gap-3"
                    data-testid="area-alias-undo-banner"
                  >
                    <span className="text-sm text-amber-900">
                      Just mapped {lastBulkIds.length} alias
                      {lastBulkIds.length === 1 ? '' : 'es'} in bulk.
                    </span>
                    <button
                      type="button"
                      onClick={undoBulk}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white border border-amber-300 text-amber-900 text-xs font-semibold hover:bg-amber-100 transition-colors"
                      data-testid="area-alias-undo-btn"
                    >
                      <Undo2 size={12} /> Undo last bulk
                    </button>
                  </div>
                )}

                <ul className="divide-y divide-gray-100" data-testid="area-alias-suggestions">
                {suggestions.map((s) => {
                  const confColor =
                    s.confidence >= 0.85
                      ? 'bg-emerald-50 text-emerald-700'
                      : s.confidence >= 0.7
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-gray-100 text-gray-600';
                  return (
                    <li
                      key={s.unknown_value}
                      className="py-3 flex items-center justify-between gap-3 flex-wrap"
                      data-testid={`area-alias-suggestion-${s.unknown_value}`}
                    >
                      <div className="flex items-center gap-3 text-sm min-w-0 flex-1">
                        <span className="font-medium text-gray-900 truncate">
                          {s.unknown_value}
                        </span>
                        <ArrowRight size={13} className="text-gray-300 shrink-0" />
                        <span className="text-[#1E6A6A] font-semibold truncate">
                          {s.suggested_canonical_full}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${confColor}`}
                          title={`${Math.round(s.confidence * 100)}% similarity`}
                        >
                          {Math.round(s.confidence * 100)}%
                        </span>
                        <span className="text-[11px] text-gray-400">
                          {s.listing_count} listing{s.listing_count === 1 ? '' : 's'}
                        </span>
                        <button
                          type="button"
                          onClick={() => acceptSuggestion(s)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1E6A6A] text-white text-xs font-semibold hover:bg-[#175555] transition-colors"
                          data-testid={`area-alias-accept-${s.unknown_value}`}
                        >
                          <Check size={12} /> Map
                        </button>
                        <button
                          type="button"
                          onClick={() => dismissSuggestion(s)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                          aria-label="Skip suggestion"
                          data-testid={`area-alias-skip-${s.unknown_value}`}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AreaAliasManager;
