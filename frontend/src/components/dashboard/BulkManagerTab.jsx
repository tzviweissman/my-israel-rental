import React, { useState, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Search, Layers, Image as ImageIcon, X, Undo2, Filter, Star,
} from 'lucide-react';

import { LOCATION_OPTIONS } from '../../constants/locations';
import { RENTAL_TYPES } from '../../constants/propertyEnums';
import BulkEditModal from './BulkEditModal';
import BulkPhotosModal from './BulkPhotosModal';
import CoverPickerModal from './CoverPickerModal';

/**
 * Bulk Manager — multi-select edit + bulk photo upload across owned properties.
 *
 * Two principal flows, each in its own file for clarity:
 *   • {@link BulkEditModal} — pick a group, choose fields to apply, save once.
 *   • {@link BulkPhotosModal} — fan-out OR per-property photo uploads.
 *
 * After every successful bulk edit we keep the per-property snapshots returned
 * by the backend so the host can hit "Undo" to revert exactly those fields.
 */

const RT_FILTERS = [{ v: '', label: 'All types' }, ...RENTAL_TYPES];

const BulkManagerTab = ({ properties, onRefresh, API, token }) => {
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);

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
      toast.success(`Reverted last bulk edit (${ids.length} properties)`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Undo failed');
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
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, area, address…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
                data-testid="bulk-search-input"
              />
            </div>
            <select
              value={rentalFilter}
              onChange={(e) => setRentalFilter(e.target.value)}
              className="px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 text-sm"
              data-testid="bulk-rental-filter"
            >
              {RT_FILTERS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>
            <select
              value={areaFilter}
              onChange={(e) => setAreaFilter(e.target.value)}
              className="hidden md:block px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 text-sm max-w-[200px]"
              data-testid="bulk-area-filter"
            >
              <option value="">All areas</option>
              {LOCATION_OPTIONS.map(g => (
                <optgroup key={g.city} label={g.city}>
                  {g.neighborhoods.map(n => (
                    <option key={`${g.city}-${n}`} value={`${g.city} - ${n}`}>{n}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleAll}
              className="text-sm font-medium px-3 py-2 rounded-lg text-[#1E6A6A] hover:bg-[#1E6A6A]/5 transition-colors"
              data-testid="bulk-select-all"
            >
              {allFilteredSelected ? 'Clear all visible' : 'Select all visible'}
            </button>
            {undoStack.length > 0 && (
              <button
                onClick={handleUndo}
                className="text-sm font-medium px-3 py-2 rounded-lg flex items-center gap-1.5 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                data-testid="bulk-undo-button"
              >
                <Undo2 size={14} /> Undo last
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-[#1E6A6A]" data-testid="bulk-selected-count">{selected.size}</span>
            {' '}selected{filtered.length !== (properties || []).length ? ` · ${filtered.length} visible` : ''}
            {' · '}
            <span className="text-gray-400">{(properties || []).length} total</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditOpen(true)}
              disabled={selected.size === 0}
              className="text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 bg-[#1E6A6A] text-white hover:bg-[#155454] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              data-testid="bulk-open-edit"
            >
              <Layers size={16} /> Bulk Edit Details
            </button>
            <button
              onClick={() => setPhotoOpen(true)}
              disabled={selected.size === 0}
              className="text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 bg-[#D4AF37] text-white hover:bg-[#b8962f] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
              data-testid="bulk-open-photos"
            >
              <ImageIcon size={16} /> Bulk Add Photos
            </button>
          </div>
        </div>
      </div>

      {/* Property list */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="hidden md:grid grid-cols-[40px_60px_1fr_140px_180px_120px_120px] gap-3 px-4 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
          <div></div>
          <div>Cover</div>
          <div>Title</div>
          <div>Type</div>
          <div>Area</div>
          <div className="text-right">Price</div>
          <div className="text-right">Photos</div>
        </div>
        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-500">
            <Filter size={28} className="mx-auto mb-2 text-gray-300" />
            <p className="text-sm">No properties match these filters.</p>
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
                isSelected ? 'bg-[#1E6A6A]/5' : 'hover:bg-gray-50'
              }`}
              data-testid={`bulk-row-${p.id}`}
            >
              <div onClick={(e) => e.stopPropagation()} className="flex items-center">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggleOne(p.id)}
                  className="w-4 h-4 rounded border-gray-300 text-[#1E6A6A] focus:ring-[#1E6A6A]/30"
                  data-testid={`bulk-checkbox-${p.id}`}
                />
              </div>
              <div
                onClick={(e) => { e.stopPropagation(); if ((p.images?.length || 0) > 0) setCoverPickerProp(p); }}
                className={`relative w-12 h-12 rounded-md overflow-hidden bg-gray-100 ${(p.images?.length || 0) > 0 ? 'cursor-pointer ring-1 ring-gray-200 hover:ring-[#D4AF37]' : ''}`}
                data-testid={`bulk-cover-${p.id}`}
                title={(p.images?.length || 0) > 0 ? 'Click to change cover' : 'No photos yet'}
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
                <div className="font-medium text-sm text-gray-900 truncate">{p.title || '(untitled)'}</div>
                <div className="text-xs text-gray-500 truncate md:hidden">{p.area || '—'} · {price} · {(p.images?.length) || 0} photos</div>
              </div>
              <div className="hidden md:block text-sm text-gray-700 capitalize">{p.rental_type?.replace('-', ' ')}</div>
              <div className="hidden md:block text-sm text-gray-700 truncate">{p.area || '—'}</div>
              <div className="hidden md:block text-sm text-gray-700 text-right">{price}</div>
              <div onClick={(e) => e.stopPropagation()} className="hidden md:flex items-center justify-end gap-2 text-sm text-gray-500">
                <span>{(p.images?.length) || 0}</span>
                {(p.images?.length || 0) > 0 && (
                  <button
                    onClick={() => setCoverPickerProp(p)}
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium text-[#D4AF37] border border-[#D4AF37]/40 hover:bg-[#D4AF37]/10 flex items-center gap-1"
                    data-testid={`bulk-set-cover-${p.id}`}
                    title="Choose cover photo"
                  >
                    <Star size={11} /> Cover
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating selection bar (mobile) */}
      {selected.size > 0 && (
        <div className="fixed bottom-4 left-4 right-4 md:hidden z-40 bg-[#1E6A6A] text-white rounded-2xl shadow-2xl p-3 flex items-center gap-2">
          <span className="text-sm font-semibold flex-1">{selected.size} selected</span>
          <button onClick={clearSelection} className="p-2 rounded-lg hover:bg-white/10" aria-label="Clear">
            <X size={16} />
          </button>
          <button onClick={() => setEditOpen(true)} className="px-3 py-2 rounded-lg bg-white text-[#1E6A6A] text-sm font-semibold flex items-center gap-1">
            <Layers size={14} /> Edit
          </button>
          <button onClick={() => setPhotoOpen(true)} className="px-3 py-2 rounded-lg bg-[#D4AF37] text-white text-sm font-semibold flex items-center gap-1">
            <ImageIcon size={14} /> Photos
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
