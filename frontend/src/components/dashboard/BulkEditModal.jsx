import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DateField from '../common/DateField';
import axios from 'axios';
import { toast } from 'sonner';
import { X, CheckCircle2, Loader2 } from 'lucide-react';

import {
  RENTAL_TYPES, PROPERTY_TYPES, CONDITIONS, FURNITURE_OPTIONS,
  CANCELLATION_POLICIES, AMENITY_OPTIONS,
} from '../../constants/propertyEnums';
import { serviceLabel } from '../property/services/servicesCatalog';

/**
 * Bulk Edit Modal — pick a group of selected properties, tick the fields
 * you want to apply, and a single POST patches them all atomically.
 */

const FIELD_GROUPS = [
  { labelKey: 'listingCopy', fields: ['title_prefix', 'description'] },
  { labelKey: 'typeLayout', fields: ['rental_type', 'property_type', 'bedrooms', 'bathrooms', 'floor', 'square_meters'] },
  { labelKey: 'pricing', fields: ['monthly_price', 'nightly_price', 'currency'] },
  { labelKey: 'stayRules', fields: ['minimum_booking_days', 'checkin_time', 'checkout_time', 'available_from', 'starting_date'] },
  { labelKey: 'building', fields: ['has_elevator', 'is_shabbat_elevator', 'is_tama', 'sukkah_compatible'] },
  { labelKey: 'quality', fields: ['condition', 'furniture_option'] },
  { labelKey: 'agentFee', fields: ['has_agent_fee', 'agent_fee_price', 'agent_fee_currency'] },
  { labelKey: 'cancellation', fields: ['cancellation_policy', 'custom_cancellation_policy'] },
  { labelKey: 'amenities', fields: ['amenities'] },
];

// ---------------------------------------------------------------------------
// Single-field row + its inline editor.
// ---------------------------------------------------------------------------
const FieldRow = ({ field, apply, onToggleApply, value, onChange, amenitiesMode, setAmenitiesMode }) => {
  const { t } = useTranslation();
  return (
    <div className={`rounded-xl border p-3 transition-colors ${apply ? 'border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/40 bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/5' : 'border-gray-200 bg-white'}`}>
      <label className="flex items-center gap-2 cursor-pointer mb-2">
        <input
          type="checkbox"
          checked={apply}
          onChange={onToggleApply}
          className="w-4 h-4 rounded border-gray-300 text-[var(--brand-primary)] focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30"
          data-testid={`bulk-edit-apply-${field}`}
        />
        <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t(`bulk.fieldLabels.${field}`, { defaultValue: field })}</span>
      </label>
      <FieldEditor field={field} value={value} onChange={onChange} amenitiesMode={amenitiesMode} setAmenitiesMode={setAmenitiesMode} />
    </div>
  );
};

const FieldEditor = ({ field, value, onChange, amenitiesMode, setAmenitiesMode }) => {
  const { t } = useTranslation();
  const cls = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30 focus:border-[var(--brand-primary)] text-sm';

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
      <option value="no">{t('bulk.yesNo.no')}</option><option value="yes">{t('bulk.yesNo.yes')}</option>
    </select>;
  }
  if (field === 'amenities') {
    const arr = Array.isArray(value) ? value : [];
    const toggle = (a) => onChange(arr.includes(a) ? arr.filter(x => x !== a) : [...arr, a]);
    return (
      <div data-testid={`bulk-edit-${field}`}>
        <div className="flex items-center gap-3 mb-2 text-xs">
          <span className="text-gray-500">{t('bulk.mode')}</span>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={amenitiesMode === 'append'} onChange={() => setAmenitiesMode('append')} />
            <span>{t('bulk.append')}</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input type="radio" checked={amenitiesMode === 'replace'} onChange={() => setAmenitiesMode('replace')} />
            <span>{t('bulk.replace')}</span>
          </label>
        </div>
        <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto pe-1">
          {AMENITY_OPTIONS.map(a => (
            <label key={a} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={arr.includes(a)} onChange={() => toggle(a)} className="w-3.5 h-3.5 rounded border-gray-300 text-[var(--brand-primary)] focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/30" />
              <span className="text-gray-700">{serviceLabel(t, a)}</span>
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
    return <DateField value={value || ''} onChange={onChange} className={`${cls} bg-white`} testid={`bulk-edit-${field}`} />;
  }
  if (['bedrooms', 'bathrooms', 'floor', 'square_meters', 'monthly_price', 'nightly_price', 'agent_fee_price', 'minimum_booking_days'].includes(field)) {
    return <input type="number" value={value ?? ''} onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))} className={cls} placeholder="…" data-testid={`bulk-edit-${field}`} />;
  }
  return <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className={cls} placeholder="…" data-testid={`bulk-edit-${field}`} />;
};

// ---------------------------------------------------------------------------
// Public modal component — drives the field state + the bulk-edit POST.
// ---------------------------------------------------------------------------
const BulkEditModal = ({ properties, onClose, onSaved, API, auth }) => {
  const { t } = useTranslation();
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
      toast.error(t('bulk.pickField'));
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post(`${API}/properties/bulk-edit`, payload, auth);
      const summary = res.data?.summary || {};
      toast.success(t('bulk.updatedCount', { count: summary.updated || 0 }));
      onSaved(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || t('bulk.bulkEditFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-end md:items-center justify-center" data-testid="bulk-edit-modal">
      <div className="bg-white w-full md:max-w-3xl md:rounded-2xl shadow-2xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{t('bulk.bulkEditDetails')}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{t('bulk.selectedPropertiesHint', { count: properties.length })}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100" data-testid="bulk-edit-close">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {FIELD_GROUPS.map(group => (
            <div key={group.labelKey}>
              <h3 className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">{t(`bulk.fieldGroups.${group.labelKey}`)}</h3>
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
            {t('admin.cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-semibold bg-[var(--brand-primary)] text-white hover:bg-[#155454] disabled:bg-gray-300 flex items-center gap-2"
            data-testid="bulk-edit-save"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {t('bulk.saveAndApply', { count: properties.length })}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BulkEditModal;
