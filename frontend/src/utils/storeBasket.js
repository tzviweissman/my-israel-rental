/**
 * The small basket on one storefront (storefront phase 4).
 *
 * Per business, kept in this browser only (localStorage, try/catch: a
 * private window simply starts empty). Grouped by store listing, because an
 * order is placed per listing through the existing order form
 * (/order/:gigId), which needs no account and takes no payment.
 * Shape: { [gigId]: { [productId]: qty } }.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

const KEY = (bizId) => `storeBasket:${bizId}`;
const MAX_QTY = 99;

function read(bizId) {
  try {
    const v = JSON.parse(window.localStorage.getItem(KEY(bizId)) || '{}');
    return v && typeof v === 'object' ? v : {};
  } catch {
    return {};
  }
}

export function useBasket(bizId) {
  const [items, setItems] = useState(() => (bizId ? read(bizId) : {}));
  useEffect(() => { if (bizId) setItems(read(bizId)); }, [bizId]);
  useEffect(() => {
    if (!bizId) return;
    try { window.localStorage.setItem(KEY(bizId), JSON.stringify(items)); } catch { /* not kept, still works */ }
  }, [bizId, items]);

  const setQty = useCallback((gigId, productId, qty) => {
    setItems((cur) => {
      const n = Math.max(0, Math.min(MAX_QTY, Math.round(Number(qty) || 0)));
      const group = { ...(cur[gigId] || {}) };
      if (n) group[productId] = n; else delete group[productId];
      const next = { ...cur, [gigId]: group };
      if (!Object.keys(group).length) delete next[gigId];
      return next;
    });
  }, []);
  const add = useCallback((gigId, productId, qty = 1) => {
    setItems((cur) => {
      const group = { ...(cur[gigId] || {}) };
      group[productId] = Math.min(MAX_QTY, (group[productId] || 0) + qty);
      return { ...cur, [gigId]: group };
    });
  }, []);
  const clearGroup = useCallback((gigId) => setItems((cur) => {
    const next = { ...cur };
    delete next[gigId];
    return next;
  }), []);

  const count = useMemo(() => Object.values(items).reduce((s, g) => s + Object.values(g).reduce((a, b) => a + b, 0), 0), [items]);
  return { items, setQty, add, clearGroup, count };
}

/** The order form's link for one listing's group: /order/<gig>?items=p~2,q~1
 *  ("~", not ":", because older products are addressed as `idx:N`). */
export function orderHref(gigId, group) {
  const items = Object.entries(group || {}).filter(([, q]) => q > 0).map(([p, q]) => `${encodeURIComponent(p)}~${q}`).join(',');
  return `/order/${encodeURIComponent(gigId)}${items ? `?items=${items}` : ''}`;
}

/** Read ?items=p~2,q~1 back into { p: 2, q: 1 } for the products that
 *  exist. The query string arrives already decoded. */
export function parseItems(param, productIds) {
  const known = new Set(productIds || []);
  const out = {};
  for (const part of String(param || '').split(',')) {
    const cut = part.lastIndexOf('~');
    if (cut < 1) continue;
    const id = part.slice(0, cut);
    const rawQty = part.slice(cut + 1);
    const q = Math.max(0, Math.min(MAX_QTY, parseInt(rawQty, 10) || 0));
    if (id && q && known.has(id)) out[id] = q;
  }
  return out;
}
