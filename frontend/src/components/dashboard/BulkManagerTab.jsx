import React, { useState, useMemo, useRef, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Search, Layers, Image as ImageIcon, X, Trash2, CheckCircle2,
  Loader2, Undo2, Filter, Sparkles,
} from 'lucide-react';

import { LOCATION_OPTIONS } from '../../constants/locations';
import {
  RENTAL_TYPES, PROPERTY_TYPES, CONDITIONS, FURNITURE_OPTIONS,
  CANCELLATION_POLICIES, AMENITY_OPTIONS,
} from '../../constants/propertyEnums';

/**
 * Bulk Manager — multi-select edit + bulk photo upload across owned properties.
 *
 * Two principal flows:
 *   • Bulk Edit Details — pick a group of properties, choose which fields to
 *     apply, save once, and every selection is patched atomically. After
 *     each save we keep the per-property snapshot returned by the backend
 *     so the host can hit "Undo" to revert exactly those fields.
 *   • Bulk Add Photos — upload a batch of photos and either fan-out to every
 *     selected property, or assign distinct sets per property.
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
    if (!last) return;
    try {
      // Group snapshots by their key-pattern; in practice all snapshots in one
      // operation share the same fields, so we can iterate per-property and
      // ship a single bulk-edit per id (cheap; <= 5 per stack entry).
      for (const item of last.snapshots) {
        await axios.post(
          `${API}/properties/bulk-edit`,
          { property_ids: [item.id], updates: item.snapshot },
          auth,
        );
      }
      setUndoStack(prev => prev.slice(0, -1));
      onRefresh && onRefresh();
      toast.success('Reverted last bulk edit');
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
        <div className="hidden md:grid grid-cols-[40px_1fr_140px_180px_120px_100px] gap-3 px-4 py-3 border-b border-gray-100 text-[11px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50">
          <div></div>
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
          return (
            <div
              key={p.id}
              onClick={() => toggleOne(p.id)}
              className={`grid grid-cols-[40px_1fr] md:grid-cols-[40px_1fr_140px_180px_120px_100px] gap-3 px-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer transition-colors ${
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
              <div className="min-w-0">
                <div className="font-medium text-sm text-gray-900 truncate">{p.title || '(untitled)'}</div>
                <div className="text-xs text-gray-500 truncate md:hidden">{p.area || '—'} · {price} · {(p.images?.length) || 0} photos</div>
              </div>
              <div className="hidden md:block text-sm text-gray-700 capitalize">{p.rental_type?.replace('-', ' ')}</div>
              <div className="hidden md:block text-sm text-gray-700 truncate">{p.area || '—'}</div>
              <div className="hidden md:block text-sm text-gray-700 text-right">{price}</div>
              <div className="hidden md:block text-sm text-gray-500 text-right">{(p.images?.length) || 0}</div>
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
    </div>
  );
};

// ---------------------------------------------------------------------------
// Bulk Edit Modal — every field has an "apply" toggle so untouched fields
// stay exactly as they are on each property.
// ---------------------------------------------------------------------------
const FIELD_GROUPS = [
  { label: 'Listing copy', fields: ['title_prefix', 'description'] },
  { label: 'Type & layout', fields: ['rental_type', 'property_type', 'bedrooms', 'bathrooms', 'floor', 'square_meters'] },
  { label: 'Pricing', fields: ['monthly_price', 'nightly_price', 'currency'] },
  { label: 'Stay rules', fields: ['minimum_booking_days', 'checkin_time', 'checkout_time', 'available_from', 'starting_date'] },
  { label: 'Building', fields: ['has_elevator', 'is_shabbat_elevator', 'is_tama', 'sukkah_compatible'] },
  { label: 'Quality', fields: ['condition', 'furniture_option'] },
  { label: 'Agent fee', fields: ['has_agent_fee', 'agent_fee_price', 'agent_fee_currency'] },
  { label: 'Cancellation', fields: ['cancellation_policy', 'custom_cancellation_policy'] },
  { label: 'Amenities', fields: ['amenities'] },
];

const BulkEditModal = ({ properties, onClose, onSaved, API, auth }) => {
  const [titlePrefix, setTitlePrefix] = useState('');
  const [updates, setUpdates] = useState({});
  const [applyMap, setApplyMap] = useState({}); // field => bool
  const [amenitiesMode, setAmenitiesMode] = useState('append');
  const [saving, setSaving] = useState(false);

  const set = (field, value) => {
    setUpdates(prev => ({ ...prev, [field]: value }));
    setApplyMap(prev => ({ ...prev, [field]: true }));
  };
  const toggleApply = (field) => setApplyMap(prev => ({ ...prev, [field]: !prev[field] }));

  const buildPayload = () => {
    const out = {};
    for (const [k, on] of Object.entries(applyMap)) {
      if (!on) continue;
      if (k === 'title_prefix') continue;
      out[k] = updates[k];
    }
    return {
      property_ids: properties.map(p => p.id),
      updates: out,
      title_prefix: applyMap.title_prefix ? (titlePrefix || '').trim() : null,
      amenities_mode: applyMap.amenities ? amenitiesMode : null,
    };
  };

  const handleSave = async () => {
    const payload = buildPayload();
    if (!payload.title_prefix && Object.keys(payload.updates).length === 0) {
      toast.error('Pick at least one field to apply');
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post(`${API}/properties/bulk-edit`, payload, auth);
      const summary = res.data?.summary || {};
      toast.success(`Updated ${summary.updated || 0} properties`);
      onSaved(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Bulk edit failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center" data-testid="bulk-edit-modal">
      <div className="bg-white w-full md:max-w-3xl md:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bulk Edit Details</h2>
            <p className="text-xs text-gray-500 mt-0.5">{properties.length} properties · only ticked fields are applied</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" data-testid="bulk-edit-close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {FIELD_GROUPS.map(group => (
            <div key={group.label}>
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">{group.label}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {group.fields.map(f => (
                  <FieldRow
                    key={f}
                    field={f}
                    apply={!!applyMap[f]}
                    onToggleApply={() => toggleApply(f)}
                    value={f === 'title_prefix' ? titlePrefix : updates[f]}
                    onChange={(v) => {
                      if (f === 'title_prefix') {
                        setTitlePrefix(v);
                        setApplyMap(prev => ({ ...prev, title_prefix: true }));
                      } else {
                        set(f, v);
                      }
                    }}
                    amenitiesMode={amenitiesMode}
                    setAmenitiesMode={setAmenitiesMode}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-5 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
            data-testid="bulk-edit-cancel"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#1E6A6A] text-white hover:bg-[#155454] disabled:bg-gray-300 flex items-center gap-2"
            data-testid="bulk-edit-save"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Save & Apply to {properties.length}
          </button>
        </div>
      </div>
    </div>
  );
};

// Renders one form row with its "Apply" toggle on the left.
const FieldRow = ({ field, apply, onToggleApply, value, onChange, amenitiesMode, setAmenitiesMode }) => {
  return (
    <div className={`rounded-xl border p-3 transition-colors ${apply ? 'border-[#1E6A6A]/40 bg-[#1E6A6A]/5' : 'border-gray-200 bg-white'}`}>
      <label className="flex items-center gap-2 cursor-pointer mb-2">
        <input
          type="checkbox"
          checked={apply}
          onChange={onToggleApply}
          className="w-4 h-4 rounded border-gray-300 text-[#1E6A6A] focus:ring-[#1E6A6A]/30"
          data-testid={`bulk-edit-apply-${field}`}
        />
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{LABELS[field] || field}</span>
      </label>
      <FieldEditor field={field} value={value} onChange={onChange} amenitiesMode={amenitiesMode} setAmenitiesMode={setAmenitiesMode} />
    </div>
  );
};

const LABELS = {
  title_prefix: 'Title prefix (prepended)',
  description: 'Description',
  rental_type: 'Rental type',
  property_type: 'Property type',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  floor: 'Floor',
  square_meters: 'Square meters',
  monthly_price: 'Monthly price',
  nightly_price: 'Nightly price',
  currency: 'Currency',
  minimum_booking_days: 'Min booking days',
  checkin_time: 'Check-in time',
  checkout_time: 'Check-out time',
  available_from: 'Available from',
  starting_date: 'Starting date',
  has_elevator: 'Elevator',
  is_shabbat_elevator: 'Shabbat elevator',
  is_tama: 'TAMA',
  sukkah_compatible: 'Sukkah compatible',
  condition: 'Condition',
  furniture_option: 'Furniture',
  has_agent_fee: 'Agent fee',
  agent_fee_price: 'Agent fee amount',
  agent_fee_currency: 'Agent fee currency',
  cancellation_policy: 'Cancellation policy',
  custom_cancellation_policy: 'Custom cancellation policy',
  amenities: 'Amenities',
};

const FieldEditor = ({ field, value, onChange, amenitiesMode, setAmenitiesMode }) => {
  const cls = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm';

  if (field === 'description' || field === 'custom_cancellation_policy') {
    return <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={3} className={cls} placeholder="…" data-testid={`bulk-edit-${field}`} />;
  }
  if (field === 'rental_type') {
    return <select value={value || 'long-term'} onChange={(e) => onChange(e.target.value)} className={cls} data-testid={`bulk-edit-${field}`}>
      {RENTAL_TYPES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>;
  }
  if (field === 'property_type') {
    return <select value={value || 'apartment'} onChange={(e) => onChange(e.target.value)} className={cls} data-testid={`bulk-edit-${field}`}>
      {PROPERTY_TYPES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>;
  }
  if (field === 'condition') {
    return <select value={value || 'good'} onChange={(e) => onChange(e.target.value)} className={cls} data-testid={`bulk-edit-${field}`}>
      {CONDITIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>;
  }
  if (field === 'furniture_option') {
    return <select value={value || 'no_furniture'} onChange={(e) => onChange(e.target.value)} className={cls} data-testid={`bulk-edit-${field}`}>
      {FURNITURE_OPTIONS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>;
  }
  if (field === 'cancellation_policy') {
    return <select value={value || 'flexible'} onChange={(e) => onChange(e.target.value)} className={cls} data-testid={`bulk-edit-${field}`}>
      {CANCELLATION_POLICIES.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
    </select>;
  }
  if (field === 'currency' || field === 'agent_fee_currency') {
    return <select value={value || 'ILS'} onChange={(e) => onChange(e.target.value)} className={cls} data-testid={`bulk-edit-${field}`}>
      <option value="ILS">₪ ILS</option><option value="USD">$ USD</option>
    </select>;
  }
  if (['has_elevator', 'is_shabbat_elevator', 'is_tama', 'sukkah_compatible', 'has_agent_fee'].includes(field)) {
    return <select value={value === true || value === 'yes' ? 'yes' : 'no'} onChange={(e) => onChange(e.target.value === 'yes')} className={cls} data-testid={`bulk-edit-${field}`}>
      <option value="no">No</option><option value="yes">Yes</option>
    </select>;
  }
  if (field === 'amenities') {
    const arr = Array.isArray(value) ? value : [];
    const toggle = (a) => onChange(arr.includes(a) ? arr.filter(x => x !== a) : [...arr, a]);
    return (
      <div data-testid={`bulk-edit-${field}`}>
        <div className="flex items-center gap-3 mb-2 text-xs">
          <span className="text-gray-500">Mode:</span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={amenitiesMode === 'append'} onChange={() => setAmenitiesMode('append')} />
            <span>Append (add to existing)</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={amenitiesMode === 'replace'} onChange={() => setAmenitiesMode('replace')} />
            <span>Replace</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pr-1">
          {AMENITY_OPTIONS.map(a => (
            <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={arr.includes(a)} onChange={() => toggle(a)} className="w-3.5 h-3.5 rounded border-gray-300 text-[#1E6A6A] focus:ring-[#1E6A6A]/30" />
              <span className="text-gray-700">{a}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
  if (field === 'checkin_time' || field === 'checkout_time') {
    return <input type="time" value={value || ''} onChange={(e) => onChange(e.target.value)} className={cls} data-testid={`bulk-edit-${field}`} />;
  }
  if (field === 'available_from' || field === 'starting_date') {
    return <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} className={cls} data-testid={`bulk-edit-${field}`} />;
  }
  if (['bedrooms', 'bathrooms', 'floor', 'square_meters', 'monthly_price', 'nightly_price', 'agent_fee_price', 'minimum_booking_days'].includes(field)) {
    return <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={cls} placeholder="…" data-testid={`bulk-edit-${field}`} />;
  }
  return <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className={cls} placeholder="…" data-testid={`bulk-edit-${field}`} />;
};

// ---------------------------------------------------------------------------
// Bulk Photos Modal — drag/drop, then either fan-out or per-property assign.
// ---------------------------------------------------------------------------
const BulkPhotosModal = ({ properties, onClose, onSaved, API, token, auth }) => {
  const [mode, setMode] = useState('shared'); // 'shared' | 'per_property'
  const [sharedFiles, setSharedFiles] = useState([]);
  const [perPropFiles, setPerPropFiles] = useState({}); // { pid: File[] }
  const [progress, setProgress] = useState(null); // { current, total }
  const [saving, setSaving] = useState(false);

  const onDropFiles = (files, pid) => {
    const fileList = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (mode === 'shared' || !pid) {
      setSharedFiles(prev => [...prev, ...fileList]);
    } else {
      setPerPropFiles(prev => ({ ...prev, [pid]: [...(prev[pid] || []), ...fileList] }));
    }
  };

  const removeShared = (i) => setSharedFiles(prev => prev.filter((_, idx) => idx !== i));
  const removePer = (pid, i) => setPerPropFiles(prev => ({ ...prev, [pid]: (prev[pid] || []).filter((_, idx) => idx !== i) }));

  const uploadFiles = async (files) => {
    if (!files.length) return [];
    const fd = new FormData();
    files.forEach(f => fd.append('files', f));
    const res = await axios.post(`${API}/upload/multiple`, fd, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
    });
    return (res.data || []).filter(r => r.url).map(r => r.url);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (mode === 'shared') {
        if (!sharedFiles.length) { toast.error('Add at least one photo'); setSaving(false); return; }
        setProgress({ current: 0, total: 1 });
        const urls = await uploadFiles(sharedFiles);
        setProgress({ current: 1, total: 1 });
        await axios.post(
          `${API}/properties/bulk-images`,
          { property_ids: properties.map(p => p.id), image_urls: urls },
          auth,
        );
        toast.success(`Added ${urls.length} photos to ${properties.length} properties`);
      } else {
        const pids = Object.keys(perPropFiles).filter(pid => (perPropFiles[pid] || []).length);
        if (!pids.length) { toast.error('Drop photos onto at least one property'); setSaving(false); return; }
        setProgress({ current: 0, total: pids.length });
        const per_property = {};
        let i = 0;
        for (const pid of pids) {
          per_property[pid] = await uploadFiles(perPropFiles[pid]);
          i += 1;
          setProgress({ current: i, total: pids.length });
        }
        await axios.post(
          `${API}/properties/bulk-images`,
          { property_ids: pids, image_urls: [], per_property },
          auth,
        );
        toast.success(`Added photos to ${pids.length} properties`);
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Photo upload failed');
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center" data-testid="bulk-photos-modal">
      <div className="bg-white w-full md:max-w-3xl md:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bulk Add Photos</h2>
            <p className="text-xs text-gray-500 mt-0.5">{properties.length} properties selected</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" data-testid="bulk-photos-close"><X size={18} /></button>
        </div>

        <div className="px-5 pt-4">
          <div className="inline-flex bg-gray-100 rounded-lg p-1 text-sm">
            <button
              onClick={() => setMode('shared')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${mode === 'shared' ? 'bg-white text-[#1E6A6A] shadow-sm' : 'text-gray-500'}`}
              data-testid="bulk-photos-mode-shared"
            >
              <Sparkles size={12} className="inline -mt-0.5 mr-1" />
              Same photos to all
            </button>
            <button
              onClick={() => setMode('per_property')}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${mode === 'per_property' ? 'bg-white text-[#1E6A6A] shadow-sm' : 'text-gray-500'}`}
              data-testid="bulk-photos-mode-per"
            >
              Different per property
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {mode === 'shared' ? (
            <DropZone
              label="Drop photos here or click to browse"
              files={sharedFiles}
              onFiles={(f) => onDropFiles(f)}
              onRemove={removeShared}
              testid="bulk-photos-shared-drop"
            />
          ) : (
            <div className="space-y-3">
              {properties.map(p => (
                <div key={p.id} className="rounded-xl border border-gray-200 p-3" data-testid={`bulk-photos-row-${p.id}`}>
                  <div className="font-medium text-sm mb-2">{p.title}</div>
                  <DropZone
                    label="Drop this property's photos here"
                    files={perPropFiles[p.id] || []}
                    onFiles={(f) => onDropFiles(f, p.id)}
                    onRemove={(i) => removePer(p.id, i)}
                    compact
                    testid={`bulk-photos-drop-${p.id}`}
                  />
                </div>
              ))}
            </div>
          )}
          {progress && (
            <div className="mt-4 text-xs text-gray-600 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin text-[#1E6A6A]" />
              Uploading {progress.current}/{progress.total}…
            </div>
          )}
        </div>

        <div className="p-5 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100" data-testid="bulk-photos-cancel">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-[#D4AF37] text-white hover:bg-[#b8962f] disabled:bg-gray-300 flex items-center gap-2"
            data-testid="bulk-photos-save"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            Save & Apply
          </button>
        </div>
      </div>
    </div>
  );
};

const DropZone = ({ label, files, onFiles, onRemove, compact, testid }) => {
  const inputRef = useRef(null);
  const [hover, setHover] = useState(false);

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); setHover(true); }}
        onDragLeave={() => setHover(false)}
        onDrop={(e) => { e.preventDefault(); setHover(false); onFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`rounded-xl border-2 border-dashed transition-colors cursor-pointer text-center ${
          hover ? 'border-[#1E6A6A] bg-[#1E6A6A]/5' : 'border-gray-200 hover:border-gray-300'
        } ${compact ? 'py-4 px-3' : 'py-8 px-4'}`}
        data-testid={testid}
      >
        <ImageIcon size={compact ? 18 : 26} className="mx-auto text-gray-400 mb-1.5" />
        <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-600`}>{label}</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>
      {files.length > 0 && (
        <div className={`mt-3 grid ${compact ? 'grid-cols-6' : 'grid-cols-4 md:grid-cols-6'} gap-2`}>
          {files.map((f, i) => (
            <PhotoThumb key={`${f.name}-${i}`} file={f} onRemove={() => onRemove(i)} />
          ))}
        </div>
      )}
    </div>
  );
};

const PhotoThumb = ({ file, onRemove }) => {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <div className="relative group aspect-square rounded-lg overflow-hidden bg-gray-100">
      {src && <img src={src} alt={file.name} className="w-full h-full object-cover" />}
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Remove"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
};

export default BulkManagerTab;
