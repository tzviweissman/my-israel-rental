import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  X, Copy, AlertTriangle, Trash2, ImageOff, Sparkles, Loader2,
  ChevronUp, ChevronDown, ImageIcon, Bot, RefreshCw,
} from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Admin-only modal that surfaces groups of duplicate listings AND lets
 * the admin clean them up in bulk.
 *
 * Duplicate key = (owner_id, normalized address, rental_type). Cross-
 * rental-type copies of the same flat (long-term + vacation) are
 * intentionally allowed and don't show up here.
 *
 * Beyond per-listing delete, the admin can:
 *   • Auto-resolve a single group by clicking "Keep newest / oldest /
 *     richest" — deletes the redundant copies in one click.
 *   • Auto-resolve ALL groups at once with a single master button (with
 *     a confirm prompt showing the exact count).
 *
 * "Richest" = most images, then longest description, then newest. It's
 * the safest default — preserves whichever copy has the most content.
 */
const DuplicatesModal = ({ token, onClose, onDeleted }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [busyGroupKey, setBusyGroupKey] = useState(null); // group being auto-resolved
  const [bulkBusy, setBulkBusy] = useState(false);
  const [autoStatus, setAutoStatus] = useState(null); // { runs: [{at, deleted, groups_resolved, ...}] }

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/duplicates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGroups(res.data.groups || []);
    } catch (e) {
      toast.error('Failed to load duplicates');
    } finally {
      setLoading(false);
    }
  };

  const fetchAutoStatus = async () => {
    try {
      const res = await axios.get(`${API}/admin/duplicates/auto-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAutoStatus(res.data);
    } catch { /* non-fatal */ }
  };
  useEffect(() => { fetchGroups(); fetchAutoStatus(); /* eslint-disable-next-line */ }, []);

  // Use the canonical key the backend sends with each group. Rebuilding it
  // here previously produced `owner|address|rental_type` while the resolver
  // matched on `owner|address|rental_type|bedrooms|floor`, so per-group
  // resolve matched nothing and silently deleted zero listings.
  const keyOf = (g) => g.key;

  const deleteOne = async (propertyId) => {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Listing deleted');
      onDeleted?.();
      fetchGroups();
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const resolveOne = async (g, mode) => {
    const losers = g.properties.length - 1;
    if (losers <= 0) return;
    if (!window.confirm(
      `Delete ${losers} duplicate listing${losers === 1 ? '' : 's'} in this group ` +
      `(${labelFor(mode)})? This cannot be undone.`
    )) return;
    setBusyGroupKey(keyOf(g));
    try {
      const res = await axios.post(
        `${API}/admin/duplicates/resolve`,
        { mode, keys: [keyOf(g)] },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const merged = (res.data.report || []).reduce((acc, row) => acc + (row.images_merged || 0), 0);
      toast.success(
        `Deleted ${res.data.deleted} duplicate${res.data.deleted === 1 ? '' : 's'}` +
        (merged > 0 ? ` · rescued ${merged} photo URL${merged === 1 ? '' : 's'} into the keeper` : ''),
      );
      onDeleted?.();
      fetchGroups();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Resolve failed');
    } finally {
      setBusyGroupKey(null);
    }
  };

  const resolveAll = async (mode) => {
    const total = groups.reduce((acc, g) => acc + (g.properties.length - 1), 0);
    if (total <= 0) return;
    if (!window.confirm(
      `Delete ${total} duplicate listing${total === 1 ? '' : 's'} across ${groups.length} ` +
      `group${groups.length === 1 ? '' : 's'} (${labelFor(mode)})?\n\n` +
      `This cannot be undone. Each group will keep its ${mode === 'keep_richest' ? 'richest (most photos)' : mode === 'keep_newest' ? 'most-recently-created' : 'earliest-created'} copy.`
    )) return;
    setBulkBusy(true);
    try {
      const res = await axios.post(
        `${API}/admin/duplicates/resolve`,
        { mode }, // no keys → resolve all
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const merged = (res.data.report || []).reduce((acc, row) => acc + (row.images_merged || 0), 0);
      toast.success(
        `Auto-resolved ${res.data.groups_resolved} groups · deleted ${res.data.deleted} listings` +
        (merged > 0 ? ` · rescued ${merged} photo URLs into surviving listings` : ''),
      );
      onDeleted?.();
      fetchGroups();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Auto-resolve failed');
    } finally {
      setBulkBusy(false);
    }
  };

  // For each group, decide which listing each "keep" mode would keep —
  // so we can highlight it inline before the admin clicks.
  const annotateGroup = (g) => {
    const props = g.properties;
    if (props.length < 2) return { newestId: null, oldestId: null, richestId: null };
    const byCreated = [...props].sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    const byRichness = [...props].sort((a, b) => {
      const ai = a.image_count || 0, bi = b.image_count || 0;
      if (ai !== bi) return ai - bi;
      const ad = a.description_length || 0, bd = b.description_length || 0;
      if (ad !== bd) return ad - bd;
      return (a.created_at || '').localeCompare(b.created_at || '');
    });
    return {
      oldestId: byCreated[0].id,
      newestId: byCreated[byCreated.length - 1].id,
      richestId: byRichness[byRichness.length - 1].id,
    };
  };

  const totalDupes = groups.reduce((acc, g) => acc + (g.properties.length - 1), 0);

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-start justify-center p-4 overflow-y-auto" data-testid="duplicates-modal">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl my-8">
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-200 px-5 py-4 flex items-center gap-3 z-10">
          <AlertTriangle size={20} className="text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg leading-tight">{t("sweep.duplicateListings", "Duplicate listings")}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Same owner + address + rental type. Cross-type copies (long-term + vacation) are intentionally allowed.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100"
            data-testid="duplicates-close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Auto-cleanup status strip — always shown so the admin knows
            the background task is on and can trigger a manual sweep.
            The task deletes ONLY groups where every user-visible field
            is identical, so it's safe to leave running unattended. */}
        <div className="bg-blue-50 border-b border-blue-200 px-5 py-2.5 flex items-center gap-2 flex-wrap" data-testid="dup-auto-status">
          <Bot size={14} className="text-blue-700 shrink-0" />
          <div className="text-[11px] text-blue-900 flex-1 min-w-[180px] leading-snug">
            <p><strong>Auto-cleanup on</strong> — every 30 min, listings with 100% identical fields (title, description, prices, photos, amenities) are merged automatically. Chats & bookings are re-attached to the survivor.</p>
            {autoStatus?.runs?.[0] && (
              <p className="text-blue-700 mt-0.5">
                Last run {new Date(autoStatus.runs[0].at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })} —{' '}
                <strong>{autoStatus.runs[0].deleted}</strong> deleted, <strong>{autoStatus.runs[0].groups_resolved}</strong> {autoStatus.runs[0].groups_resolved === 1 ? 'group' : 'groups'} resolved.
              </p>
            )}
          </div>
          <button
            onClick={async () => {
              try {
                const res = await axios.post(`${API}/admin/duplicates/auto-resolve`, {}, {
                  headers: { Authorization: `Bearer ${token}` },
                });
                toast.success(`Auto-merged ${res.data.deleted} identical ${res.data.deleted === 1 ? 'twin' : 'twins'} across ${res.data.groups_resolved} ${res.data.groups_resolved === 1 ? 'group' : 'groups'}`);
                fetchGroups(); fetchAutoStatus();
                if (res.data.deleted > 0 && onDeleted) onDeleted();
              } catch (e) {
                toast.error(e.response?.data?.detail || 'Auto-resolve failed');
              }
            }}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
            data-testid="dup-auto-resolve-now"
            title="Run the strict-identical dedupe pass immediately"
          >
            <RefreshCw size={12} /> Run now
          </button>
        </div>

        {/* Bulk action bar */}
        {!loading && groups.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center gap-2 flex-wrap" data-testid="duplicates-bulk-bar">
            <Sparkles size={14} className="text-amber-700 shrink-0" />
            <p className="text-xs text-amber-900 flex-1 min-w-[180px]">
              <strong>{totalDupes}</strong> redundant {totalDupes === 1 ? 'listing' : 'listings'} across{' '}
              <strong>{groups.length}</strong> {groups.length === 1 ? 'group' : 'groups'}.
              Auto-resolve all:
            </p>
            <button
              onClick={() => resolveAll('keep_richest')}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--brand-primary)] text-white text-xs font-semibold disabled:opacity-50 hover:bg-[#175555]"
              data-testid="resolve-all-richest"
              title="Each group keeps the listing with the most photos (best content) — safest default"
            >
              {bulkBusy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Keep richest in each
            </button>
            <button
              onClick={() => resolveAll('keep_newest')}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-semibold disabled:opacity-50 hover:bg-amber-100"
              data-testid="resolve-all-newest"
            >
              <ChevronUp size={12} /> newest
            </button>
            <button
              onClick={() => resolveAll('keep_oldest')}
              disabled={bulkBusy}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-semibold disabled:opacity-50 hover:bg-amber-100"
              data-testid="resolve-all-oldest"
              title="Keep the original listing — preserves booking history"
            >
              <ChevronDown size={12} /> oldest
            </button>
          </div>
        )}

        <div className="p-5 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">Loading…</p>
          ) : groups.length === 0 ? (
            <div className="text-center py-10">
              <Copy size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-700">{t("sweep.noDuplicatesFound", "No duplicates found")}</p>
              <p className="text-xs text-gray-500 mt-1">Every owner has unique address + rental_type combinations.</p>
            </div>
          ) : (
            groups.map((g, gi) => {
              const ann = annotateGroup(g);
              const isBusy = busyGroupKey === keyOf(g);
              return (
                <div key={gi} className="border border-amber-200 rounded-xl overflow-hidden" data-testid={`dup-group-${gi}`}>
                  <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {g.owner_name} <span className="text-gray-400 font-normal">·</span>{' '}
                      <span className="text-gray-600">{g.owner_email}</span>
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5 flex items-center justify-between gap-2 flex-wrap">
                      <span className="truncate">
                        <span className="font-medium">{g.rental_type}</span> · {g.address}
                      </span>
                      <span className="inline-flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => resolveOne(g, 'keep_richest')}
                          disabled={isBusy || bulkBusy}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--brand-primary)] text-white text-[11px] font-semibold disabled:opacity-50 hover:bg-[#175555]"
                          data-testid={`resolve-group-richest-${gi}`}
                          title="Keep the richest copy (most photos + longest description), delete the rest"
                        >
                          {isBusy ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />} keep richest
                        </button>
                        <button
                          onClick={() => resolveOne(g, 'keep_newest')}
                          disabled={isBusy || bulkBusy}
                          className="px-2 py-1 rounded-md bg-white border border-amber-300 text-amber-900 text-[11px] font-semibold disabled:opacity-50 hover:bg-amber-100"
                          data-testid={`resolve-group-newest-${gi}`}
                        >
                          newest
                        </button>
                        <button
                          onClick={() => resolveOne(g, 'keep_oldest')}
                          disabled={isBusy || bulkBusy}
                          className="px-2 py-1 rounded-md bg-white border border-amber-300 text-amber-900 text-[11px] font-semibold disabled:opacity-50 hover:bg-amber-100"
                          data-testid={`resolve-group-oldest-${gi}`}
                        >
                          oldest
                        </button>
                      </span>
                    </p>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {g.properties.map((p) => {
                      const isRichest = ann.richestId === p.id;
                      const isNewest = ann.newestId === p.id;
                      const isOldest = ann.oldestId === p.id;
                      return (
                        <div
                          key={p.id}
                          className={`px-4 py-2.5 flex items-center gap-3 ${isRichest ? 'bg-emerald-50/40' : ''}`}
                          data-testid={`dup-listing-${p.id}`}
                        >
                          {/* Cover thumbnail */}
                          {p.cover_url ? (
                            <a
                              href={p.cover_url}
                              target="_blank"
                              rel="noreferrer"
                              className="w-12 h-12 rounded-md overflow-hidden border border-gray-200 shrink-0 hover:ring-2 hover:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/40 block"
                              title="Open full-size cover"
                            >
                              <img
                                src={p.cover_url}
                                alt={p.title || 'Cover'}
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ) : (
                            <div className="w-12 h-12 rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 shrink-0">
                              <ImageOff size={12} />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate flex items-center gap-1.5">
                              {p.title || '—'}
                              {isRichest && (
                                <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-bold">
                                  <Sparkles size={9} /> richest
                                </span>
                              )}
                              {isNewest && !isRichest && (
                                <span className="text-[9px] uppercase tracking-wider bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
                                  newest
                                </span>
                              )}
                              {isOldest && !isRichest && !isNewest && (
                                <span className="text-[9px] uppercase tracking-wider bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full font-bold">
                                  oldest
                                </span>
                              )}
                            </p>
                            <p className="text-[11px] text-gray-500 flex items-center gap-2 mt-0.5">
                              <span className="inline-flex items-center gap-0.5">
                                <ImageIcon size={10} /> {p.image_count || 0}
                              </span>
                              <span>·</span>
                              <span className="font-mono">{p.id.slice(0, 8)}</span>
                              {p.created_at && <span>· {p.created_at.slice(0, 10)}</span>}
                            </p>
                          </div>
                          <a
                            href={`/property/${p.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs text-[var(--brand-primary)] hover:underline shrink-0"
                          >
                            view
                          </a>
                          <button
                            onClick={() => deleteOne(p.id)}
                            disabled={isBusy || bulkBusy}
                            className="p-1.5 rounded text-red-500 hover:bg-red-50 disabled:opacity-50"
                            title="Delete this listing"
                            data-testid={`dup-delete-${p.id}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

const labelFor = (mode) => {
  if (mode === 'keep_richest') return 'keep the richest copy in this group';
  if (mode === 'keep_newest') return 'keep the most-recently-created copy';
  return 'keep the earliest-created copy';
};

export default DuplicatesModal;
