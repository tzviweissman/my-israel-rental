/**
 * Which button or link was pressed on a business page, for the owner's "Taps on your site" (Tzvi, 12 Nov 2026:
 * "track clicks on the business pages too"). The same rule as public/pages/mir-taps.js on hand-built sites: change
 * both together. Returns null for a click on nothing pressable.
 */
import axios from 'axios';
import { visitorHeaders } from './visitorId';

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
