/**
 * PropertyServicesSelector
 *
 * Replaces the flat 13-item amenity checkbox grid in AddPropertyModal.
 * Renders:
 *   1. Category accordions with multi-select checkboxes + "(3 / 9)" counts.
 *   2. "Add custom service" button opening a small modal.
 *   3. Persistent chip row at the top showing everything selected —
 *      predefined items show a category badge, customs show a ★.
 *   4. Smart-default pre-selection based on the parent's rental_type +
 *      holiday_context, applied ONCE per new listing (via `initialize`).
 *
 * Storage contract: `value` is a `string[]`. Parents keep passing whatever
 * they already stored in `amenities`. No backend migration.
 *
 * Design goal: a host can finish this section in under 60 seconds — big
 * hit-targets, no page reload, and every action stays under a fold.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown, ChevronUp, Plus, X, Sparkles, CookingPot, Baby, Tv,
  Building2, Waves, MapPin, Star, Check,
} from 'lucide-react';
import {
  SERVICE_CATEGORIES, CATEGORY_BY_SERVICE, isCustomService,
  defaultServicesFor, serviceLabel, serviceCategoryLabel,
} from './servicesCatalog';

const ICONS = { Sparkles, CookingPot, Baby, Tv, Building2, Waves, MapPin };

const CategoryAccordion = ({ category, selected, onToggle, open, onOpenToggle }) => {
  const { t } = useTranslation();
  const Icon = ICONS[category.icon] || Sparkles;
  const selectedCount = category.services.filter((s) => selected.includes(s)).length;
  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden" data-testid={`svc-cat-${category.slug}`}>
      <button
        type="button"
        onClick={onOpenToggle}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 text-left"
        data-testid={`svc-cat-toggle-${category.slug}`}
      >
        <span className="flex items-center gap-3">
          <span className="w-8 h-8 rounded-lg bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/8 flex items-center justify-center">
            <Icon size={16} className="text-[var(--brand-primary)]" />
          </span>
          <span className="font-semibold text-sm text-gray-900">{serviceCategoryLabel(t, category)}</span>
          <span className={`text-xs font-medium ${selectedCount > 0 ? 'text-[var(--brand-primary)]' : 'text-gray-400'}`}>
            ({selectedCount} / {category.services.length})
          </span>
        </span>
        {open ? <ChevronUp size={16} className="text-gray-500" /> : <ChevronDown size={16} className="text-gray-500" />}
      </button>
      {open && (
        <div className="px-4 py-3 bg-gray-50/50 border-t border-gray-100 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
          {category.services.map((s) => {
            const on = selected.includes(s);
            return (
              <label
                key={s}
                className={`flex items-center gap-2 py-1.5 cursor-pointer rounded-md ${on ? 'text-gray-900' : 'text-gray-600'}`}
                data-testid={`svc-opt-${s.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onToggle(s)}
                  className="w-4 h-4 rounded border-gray-300 text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                />
                {/* `s` remains the stored value everywhere it is compared or
                    written back — only the visible text is translated. */}
                <span className="text-sm">{serviceLabel(t, s)}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CustomServiceModal = ({ onClose, onAdd }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('essentials');

  const submit = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    // Prepend a ★ so the storage layer can still be a flat string[] but the
    // UI can visually flag customs at render time.
    onAdd(`★ ${trimmed}${description.trim() ? ` — ${description.trim()}` : ''}`, category);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
        data-testid="custom-svc-modal"
      >
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-bold" style={{ fontFamily: 'Playfair Display' }}>Add a custom service</h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-700" data-testid="custom-svc-close">
            <X size={18} />
          </button>
        </div>
        <p className="text-xs text-gray-500">Something we didn&apos;t list? Add your own — it&apos;ll appear in your listing.</p>

        <div>
          <label className="text-xs font-semibold text-gray-700">Service name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Kotel-facing balcony"
            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
            data-testid="custom-svc-name"
            maxLength={80}
            required
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="e.g. Direct view of the Western Wall from the master bedroom"
            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
            data-testid="custom-svc-desc"
            maxLength={200}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-gray-700">Best-fit category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm bg-white"
            data-testid="custom-svc-category"
          >
            {SERVICE_CATEGORIES.map((c) => (
              <option key={c.slug} value={c.slug}>{serviceCategoryLabel(t, c)}</option>
            ))}
            <option value="other">Other / uncategorized</option>
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600">Cancel</button>
          <button
            type="submit"
            disabled={!name.trim()}
            className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--gold)] hover:bg-[#c19f2c] disabled:opacity-50 flex items-center gap-1.5"
            data-testid="custom-svc-add"
          >
            <Check size={14} /> Add to listing
          </button>
        </div>
      </form>
    </div>
  );
};

const Chip = ({ value, onRemove }) => {
  const { t } = useTranslation();
  const custom = isCustomService(value);
  const cat = CATEGORY_BY_SERVICE[value];
  const label = serviceLabel(t, value);
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${
        custom ? 'bg-[rgb(var(--gold-rgb)/<alpha-value>)]/10 text-[#8a6f1c] border border-[rgb(var(--gold-rgb)/<alpha-value>)]/40' : 'bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/8 text-[#0F3A3A] border border-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20'
      }`}
      data-testid="svc-chip"
    >
      {custom && <Star size={10} className="text-[var(--gold)] fill-[var(--gold)]" />}
      <span>{label}</span>
      {cat && !custom && (
        <span className="text-[10px] text-gray-500 ms-0.5">· {serviceCategoryLabel(t, cat)}</span>
      )}
      <button
        type="button"
        onClick={() => onRemove(value)}
        className="ms-0.5 w-4 h-4 rounded-full inline-flex items-center justify-center hover:bg-black/10"
        aria-label={`Remove ${label}`}
        data-testid="svc-chip-remove"
      >
        <X size={10} />
      </button>
    </span>
  );
};

const PropertyServicesSelector = ({
  value = [],
  onChange,
  rentalType,
  holidayContext,
  firstEdit = false,
}) => {
  const [open, setOpen] = useState(() => new Set([SERVICE_CATEGORIES[0].slug])); // essentials expanded by default
  const [showCustom, setShowCustom] = useState(false);
  // Track whether we've applied smart defaults already so a re-render (or
  // user manually clearing) doesn't re-add them.
  const seededRef = useRef(false);

  useEffect(() => {
    if (seededRef.current) return;
    if (firstEdit && (value?.length ?? 0) === 0) {
      const defaults = defaultServicesFor(rentalType, holidayContext);
      if (defaults.length > 0) onChange(defaults);
    }
    seededRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firstEdit, rentalType, holidayContext]);

  const toggle = (s) => {
    const next = value.includes(s) ? value.filter((x) => x !== s) : [...value, s];
    onChange(next);
  };

  const remove = (s) => onChange(value.filter((x) => x !== s));

  const addCustom = (name) => {
    if (value.includes(name)) return;
    onChange([...value, name]);
  };

  const setOpenToggle = (slug) => {
    setOpen((prev) => {
      const n = new Set(prev);
      if (n.has(slug)) n.delete(slug); else n.add(slug);
      return n;
    });
  };

  const totalSelected = value.length;
  const groupedChips = useMemo(() => {
    // Sort chips: predefined by category order, customs last.
    const orderedCats = SERVICE_CATEGORIES.map((c) => c.slug);
    return [...value].sort((a, b) => {
      const aCust = isCustomService(a);
      const bCust = isCustomService(b);
      if (aCust !== bCust) return aCust ? 1 : -1;
      if (aCust) return 0;
      const ai = orderedCats.indexOf(CATEGORY_BY_SERVICE[a]?.slug);
      const bi = orderedCats.indexOf(CATEGORY_BY_SERVICE[b]?.slug);
      return ai - bi;
    });
  }, [value]);

  return (
    <div className="space-y-4" data-testid="property-services-selector">
      {/* Header + Add-custom CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Services & amenities</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Select all that apply or add your own unique services.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCustom(true)}
          className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white bg-[var(--gold)] hover:bg-[#c19f2c] inline-flex items-center gap-1.5 self-start sm:self-auto"
          data-testid="add-custom-service-btn"
        >
          <Plus size={14} /> Add custom service
        </button>
      </div>

      {/* Selected chips summary — persistent at top so hosts see their picks
          without scrolling all the way down. */}
      {totalSelected > 0 && (
        <div
          className="rounded-xl border border-gray-200 bg-white p-3"
          data-testid="svc-selected-summary"
        >
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-xs font-semibold text-gray-700">
              Selected · {totalSelected}
            </span>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-red-500 hover:underline"
              data-testid="svc-clear-all"
            >
              Clear all
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {groupedChips.map((s) => (
              <Chip key={s} value={s} onRemove={remove} />
            ))}
          </div>
        </div>
      )}

      {/* Accordion list */}
      <div className="space-y-2">
        {SERVICE_CATEGORIES.map((c) => (
          <CategoryAccordion
            key={c.slug}
            category={c}
            selected={value}
            onToggle={toggle}
            open={open.has(c.slug)}
            onOpenToggle={() => setOpenToggle(c.slug)}
          />
        ))}
      </div>

      {showCustom && (
        <CustomServiceModal
          onClose={() => setShowCustom(false)}
          onAdd={addCustom}
        />
      )}
    </div>
  );
};

export default PropertyServicesSelector;
