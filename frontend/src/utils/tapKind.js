/**
 * Which button or link was pressed on a business page, for the owner's "Taps on your site" (Tzvi, 12 Nov 2026:
 * "track clicks on the business pages too"). The same rule as public/pages/mir-taps.js on hand-built sites: change
 * both together. Returns null for a click on nothing pressable.
 */
import axios from 'axios';
import { visitorHeaders, getVisitorId } from './visitorId';
import { API } from '../lib/apiBase';

export function tapOf(target) {
  const el = target?.closest?.('a[href],button,[role=button],summary,input[type=submit]');
  if (!el) return null;
  const label = String(el.getAttribute('aria-label') || el.textContent || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 40);
  const u = el.href || '';
  const kind = /wa\.me|whatsapp/i.test(u) ? 'whatsapp' : /^tel:/i.test(u) ? 'phone' : /^mailto:/i.test(u) ? 'email'
    : /waze|maps\.|\/maps/i.test(u) ? 'directions' : /instagram/i.test(u) ? 'instagram'
    : /facebook|fb\.com/i.test(u) ? 'facebook' : /tiktok/i.test(u) ? 'tiktok'
    : /order|basket|cart|checkout/i.test(u) || /order|basket|cart|checkout|\bbuy\b|הזמ|לסל|הסל|בסל|לקנות|קנו/i.test(label) ? 'order'
    : label ? 'button' : '';
  return kind ? { kind, label: label || null } : null;
}

export function countBusinessTap(api, slugOrId, e) {
  const tap = tapOf(e.target);
  if (!tap || !slugOrId) return;
  axios.post(`${api}/marketplace/business/${encodeURIComponent(slugOrId)}/tap`, { ...tap, page: 'profile' },
    { headers: visitorHeaders() }).catch(() => {});
}

// One small POST with the browser id and, when signed in, the token (so admins are skipped). Never fails loudly.
export function send(path, body) {
  let token = null;
  try { token = sessionStorage.getItem('token'); } catch { /* private mode */ }
  const headers = { 'X-Visitor-Id': getVisitorId() || '', 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body), keepalive: true }).catch(() => {});
  } catch { /* not fatal */ }
}

// How far someone got in signing up, adding a business or ordering (backend FLOW_STEPS). Counted once per visitor
// per day per step by the server, so calling it on every render of a step is fine.
export const countStep = (flow, step) => send('/site/step', { flow, step: String(step) });
