import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Search, Layers, Image as ImageIcon, X, Undo2, Filter, Star,
} from 'lucide-react';

// LOCATION_OPTIONS removed — area dropdown is now built from the
// manager's own properties (see optgroup builder below).
import { RENTAL_TYPES } from '../../constants/propertyEnums';
import BulkEditModal from './BulkEditModal';
import BulkPhotosModal from './BulkPhotosModal';
import CoverPickerModal from './CoverPickerModal';

/**
 * Bulk Manager — multi-select edit + bulk photo upload across owned properties.
 */

const BulkManagerTab = ({ properties, onRefresh, API, token }) => {
  const { t } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

  const RT_FILTERS = useMemo(() => [{ v: '', label: t('bulk.allTypes') }, ...RENTAL_TYPES], [t]);

  const [search, setSearch] = useState('');
  const [rentalFilter, setRentalFilter] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [selected, setSelected] = useState(new Set());

  const [editOpen, setEditOpen] = useState(false);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [coverPickerProp, setCoverPickerProp] = useState(null);
  const [undoStack, setUndoStack] = useState([]); // [{ snapshots: [{id, snapshot}], at }]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (properties || []).filter(p => {
      if (q && ![p.title, p.area, p.address].some(v => (v || '').toLowerCase().includes(q))) return false;
      if (rentalFilter && p.rental_type !== rentalFilter) return false;
      if (areaFilter && p.area !== areaFilter) return false;
      return true;
    });
  }, [properties, search, rentalFilter, areaFilter]);

  const allFilteredSelected = filtered.length > 0 && filtered.every(p => selected.has(p.id));

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(prev => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach(p => next.delete(p.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach(p => next.add(p.id));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const handleSaved = (resp) => {
    if (resp?.updated?.length) {
      setUndoStack(prev => [...prev, { snapshots: resp.updated, at: Date.now() }].slice(-5));
    }
    onRefresh && onRefresh();
  };

  const handleUndo = async () => {
    const last = undoStack[undoStack.length - 1];
    if (!last || !last.snapshots?.length) return;
    try {
      // ONE POST instead of N: we ship the per-property snapshot map and
      // the backend applies each property's previous values in a single
      // round-trip (see `BulkEditBody.per_property_updates`).
      const per_property_updates = {};
      for (const item of last.snapshots) {
        if (item?.id && item?.snapshot && Object.keys(item.snapshot).length) {
          per_property_updates[item.id] = item.snapshot;
        }
      }
      const ids = Object.keys(per_property_updates);
      if (!ids.length) {
        setUndoStack(prev => prev.slice(0, -1));
        return;
      }
      await axios.post(
        `${API}/properties/bulk-edit`,
        { property_ids: ids, updates: {}, per_property_updates },
        auth,
      );
      setUndoStack(prev => prev.slice(0, -1));
      onRefresh && onRefresh();
      toast.success(t('bulk.revertLast', { count: ids.length }));
    } catch (e) {
      toast.error(e.response?.data?.detail || t('bulk.undoFailed'));
    }
  };

  const selectedProperties = (properties || []).filter(p => selected.has(p.id));

  return (
    <div data-testid="bulk-manager-tab">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-5 mb-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('bulk.searchPlaceholder')}
                className="w-full ps-9 pe-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 focus:border-[var(--brand-primary)] text-sm"
                data-testid="bulk-search-input"
              />
            </div>
            <select
              value={rentalFilter}
              onChange={(e) => setRentalFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 text-sm"
              data-testid="bulk-rental-filter"
            >
              {RT_FILTERS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            {/* Area dropdown — scoped to the manager's own listings so they
                never see Israel-wide options that yield zero matches. Areas
                are extracted from each property and sorted by city group. */}
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="hidden md:block px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 text-sm max-w-[200px]"
              data-testid="bulk-area-filter"
            >
              <option value="">{t('bulk.allAreas')}</option>
              {(() => {
                // Group areas by their "City -" prefix so the dropdown
                // mirrors the LOCATION_OPTIONS optgroup layout. Areas
                // without a recognizable prefix go under "Other".
                const buckets = {};
                for (const a of [...new Set(properties.map(p => p.area).filter(Boolean))]) {
                  const [city, ...rest] = a.split(' - ');
                  const groupKey = rest.length ? city : 'Other';
                  const label = rest.length ? rest.join(' - ') : a;
                  if (!buckets[groupKey]) buckets[groupKey] = [];
                  buckets[groupKey].push({ value: a, label });
                }
                const groups = Object.entries(buckets).sort(([a], [b]) => a.localeCompare(b));
                for (const [, items] of groups) items.sort((a, b) => a.label.localeCompare(b.label));
                return groups.map(([city, items]) => (
                  <optgroup key={city} label={city}>
                    {items.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </optgroup>
                ));
              })()}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAll}
              className="text-sm font-medium px-3 py-2 rounded-lg text-[var(--brand-primary)] hover:bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5 transition-colors"
              data-testid="bulk-select-all"
            >
              {allFilteredSelected ? t('bulk.clearAllVisible') : t('bulk.selectAllVisible')}
            </button>
            {undoStack.length > 0 && (
              <button
                onClick={handleUndo}
                className="text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                data-testid="bulk-undo-button"
              >
                <Undo2 size={14} /> {t('bulk.undoLast')}
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-[var(--brand-primary)]" data-testid="bulk-selected-count">{selected.size}</span>
            {' '}{t('bulk.selected')}{filtered.length !== (properties || []).length ? ` · ${t('bulk.visibleCount', { count: filtered.length })}` : ''}
            {' · '}
            <span className="text-gray-400">{t('bulk.totalCount', { count: (properties || []).length })}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              disabled={selected.size === 0}
              className="text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 bg-[var(--brand-primary)] text-white hover:bg-[#155454] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              data-testid="bulk-open-edit"
            >
              <Layers size={16} /> {t('bulk.bulkEditDetails')}
            </button>
            <button
              onClick={() => setPhotoOpen(true)}
              disabled={selected.size === 0}
              className="text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 bg-[var(--gold)] text-white hover:bg-[#b8962f] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              data-testid="bulk-open-photos"
            >
              <ImageIcon size={16} /> {t('bulk.bulkAddPhotos')}
            </button>
          </div>
        </div>
      </div>

      {/* Property list */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="hidden md:grid grid-cols-[40px_60px_1fr_140px_180px_120px_120px] gap-3 px-4 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
          <div></div>
          <div>{t('bulk.cover')}</div>
          <div>{t('bulk.title')}</div>
          <div>{t('bulk.type')}</div>
          <div>{t('bulk.area')}</div>
          <div className="text-right">{t('bulk.price')}</div>
          <div className="text-right">{t('bulk.photosColumn')}</div>
        </div>
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-500">
            <Filter size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">{t('bulk.noMatches')}</p>
          </div>
        ) : filtered.map(p => {
          const isSelected = selected.has(p.id);
          const price = p.rental_type === 'short-term' || p.rental_type === 'vacation'
            ? (p.nightly_price ? `${p.currency === 'USD' ? '$' : '₪'}${p.nightly_price}/nt` : '—')
            : (p.monthly_price ? `${p.currency === 'USD' ? '$' : '₪'}${p.monthly_price}/mo` : '—');
          const cover = p.images?.[0];
          const coverSrc = cover && cover.startsWith('/api') ? `${API.replace('/api', '')}${cover}` : cover;
          return (
            <div
              key={p.id}
              onClick={() => toggleOne(p.id)}
              className={`grid grid-cols-[40px_60px_1fr] md:grid-cols-[40px_60px_1fr_140px_180px_120px_120px] gap-3 px-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${
                isSelected ? 'bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5' : 'hover:bg-gray-50'
              }`}
              data-testid={`bulk-row-${p.id}`}
            >
              <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOne(p.id)}
                  className="w-4 h-4 rounded border-gray-300 text-[var(--brand-primary)] focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30"
                  data-testid={`bulk-checkbox-${p.id}`}
                />
              </div>
              <div
                onClick={(e) => { e.stopPropagation(); if ((p.images?.length || 0) > 0) setCoverPickerProp(p); }}
                className={`relative w-12 h-12 rounded-md overflow-hidden bg-gray-100 ${(p.images?.length || 0) > 0 ? 'cursor-pointer ring-1 ring-gray-200 hover:ring-[var(--gold)]' : ''}`}
                data-testid={`bulk-cover-${p.id}`}
                title={(p.images?.length || 0) > 0 ? t('bulk.chooseCover') : t('bulk.noPhotos')}
              >
                {coverSrc ? (
                  <img src={coverSrc} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300">
                    <ImageIcon size={16} />
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">{p.title || t('bulk.untitled')}</div>
                <div className="text-xs text-gray-500 truncate md:hidden">{p.area || t('bulk.emDash')} · {price} · {(p.images?.length) || 0} {t('bulk.photos').toLowerCase()}</div>
              </div>
              <div className="hidden md:block text-sm text-gray-700 capitalize">{p.rental_type?.replace('-', ' ')}</div>
              <div className="hidden md:block text-sm text-gray-700 truncate">{p.area || t('bulk.emDash')}</div>
              <div className="hidden md:block text-sm text-gray-700 text-right">{price}</div>
              <div onClick={(e) => e.stopPropagation()} className="hidden md:flex items-center justify-end gap-2 text-sm text-gray-500">
                <span>{(p.images?.length) || 0}</span>
                {(p.images?.length || 0) > 0 && (
                  <button
                    onClick={() => setCoverPickerProp(p)}
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium text-[var(--gold)] border border-[rgb(var(--gold-rgb)/<alpha-value>)]/40 hover:bg-[rgb(var(--gold-rgb)/<alpha-value>)]/10 flex items-center gap-1"
                    data-testid={`bulk-set-cover-${p.id}`}
                    title={t('bulk.chooseCoverPhoto')}
                  >
                    <Star size={11} /> {t('bulk.cover')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating selection bar (mobile) */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-4 right-4 md:hidden z-40 bg-[var(--brand-primary)] text-white rounded-2xl shadow-2xl p-3 flex items-center gap-2">
          <span className="text-sm font-semibold flex-1">{t('bulk.selectedCount', { count: selected.size })}</span>
          <button onClick={clearSelection} className="p-2 rounded-lg hover:bg-white/10" aria-label={t('bulk.clear')}>
            <X size={16} />
          </button>
          <button onClick={() => setEditOpen(true)} className="px-3 py-2 rounded-lg bg-white text-[var(--brand-primary)] text-sm font-semibold flex items-center gap-1">
            <Layers size={14} /> {t('bulk.edit')}
          </button>
          <button onClick={() => setPhotoOpen(true)} className="px-3 py-2 rounded-lg bg-[var(--gold)] text-white text-sm font-semibold flex items-center gap-1">
            <ImageIcon size={14} /> {t('bulk.photos')}
          </button>
        </div>
      )}

      {editOpen && (
        <BulkEditModal
          properties={selectedProperties}
          onClose={() => setEditOpen(false)}
          onSaved={(resp) => { handleSaved(resp); setEditOpen(false); clearSelection(); }}
          API={API}
          auth={auth}
        />
      )}
      {photoOpen && (
        <BulkPhotosModal
          properties={selectedProperties}
          onClose={() => setPhotoOpen(false)}
          onSaved={() => { onRefresh && onRefresh(); setPhotoOpen(false); clearSelection(); }}
          API={API}
          token={token}
          auth={auth}
        />
      )}
      {coverPickerProp && (
        <CoverPickerModal
          property={coverPickerProp}
          API={API}
          auth={auth}
          onClose={() => setCoverPickerProp(null)}
          onSaved={() => { onRefresh && onRefresh(); }}
        />
      )}
    </div>
  );
};

export default BulkManagerTab;
