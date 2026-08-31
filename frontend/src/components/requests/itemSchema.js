/**
 * The goods schema, fetched once and shared, plus the label lookups.
 *
 * WHY IT IS FETCHED AND NOT WRITTEN HERE. The categories and their item
 * specifics are declared in one place — `backend/routes/marketplace/
 * item_taxonomy.py` — and the writer validates every submission against
 * that declaration. A second copy in JS would be a second source of
 * truth, and the second one goes stale silently: the services taxonomy
 * already shipped a hand-kept `CATEGORY_LABELS` mirror carrying a slug
 * Python had renamed, and nothing failed. The label simply stopped
 * resolving.
 *
 * Here the same drift would be worse. A field this file offered that the
 * writer does not declare is dropped on write — so the seller fills it
 * in, sees the form accept it, and the listing does not have it.
 *
 * LABELS COME FROM i18n, STRUCTURE COMES FROM THE API. The endpoint
 * carries English labels too, but they are the fallback, not the source:
 * `en.js` and `he.js` hold the translated strings and a backend test
 * asserts they match the schema key for key. The API's own label is what
 * shows for the few minutes between a field being added and being
 * translated, so a new field reads as English rather than as a raw slug.
 *
 * ONE FETCH PER PAGE LOAD, module-scoped. Both the composer and the
 * listing page need this, and it does not change between them.
 */
import { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../../App';

let cached = null;
let inFlight = null;

export const fetchItemSchema = () => {
  if (cached) return Promise.resolve(cached);
  if (!inFlight) {
    inFlight = axios.get(`${API}/marketplace/item-schema`)
      .then((r) => { cached = r.data || null; return cached; })
      .catch(() => {
        // A composer with no schema still posts: title, description, area,
        // condition and photos are all unaffected. It loses the specifics,
        // which is a smaller loss than a form that will not render.
        inFlight = null;
        return null;
      });
  }
  return inFlight;
};

export const useItemSchema = () => {
  const [schema, setSchema] = useState(cached);
  useEffect(() => {
    let alive = true;
    fetchItemSchema().then((s) => { if (alive) setSchema(s); });
    return () => { alive = false; };
  }, []);
  return schema;
};

/** Every field that applies to a category, shared ones first. */
export const fieldsFor = (schema, category) => {
  if (!schema) return [];
  const shared = schema.shared_fields || [];
  const own = (schema.category_fields || {})[category] || [];
  return [...shared, ...own];
};

export const categoryLabel = (t, slug, fallback) =>
  (slug ? t(`itemCategories.${slug}`, fallback || slug) : '');

export const attributeLabel = (t, field) =>
  t(`itemAttributes.${field.key}`, field.label || field.key);

export const optionLabel = (t, fieldKey, option) =>
  t(`itemAttributeOptions.${fieldKey}.${option.value}`, option.label || option.value);

/**
 * The label for a stored value, which is not the same problem as the
 * label for an option.
 *
 * A listing written under an older schema can carry an enum value the
 * category no longer declares. Showing the raw slug is ugly but honest;
 * showing nothing would silently drop information the seller entered.
 */
export const valueLabel = (t, field, value) => {
  if (value === undefined || value === null || value === '') return '';
  if (field.type === 'bool') {
    return value === 'true' ? t('common.yes', 'Yes') : t('common.no', 'No');
  }
  if (field.type === 'enum') {
    const option = (field.options || []).find((o) => o.value === value);
    return option ? optionLabel(t, field.key, option) : String(value);
  }
  if (field.type === 'number' && field.unit) {
    return `${value} ${t(`itemUnits.${field.unit}`, field.unit)}`;
  }
  return String(value);
};
