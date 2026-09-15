/**
 * Business web addresses, in the browser app.
 *
 * Every business has <slug>.myisraelrental.com, serving the same page as
 * /business/<slug>. The subdomain IS the slug, so there is one identifier
 * and one rename history.
 *
 * A copy of frontend/businessHost.js (the server) and of the reserved list
 * in backend/utils/businesses.py. CRA cannot import from outside src/, and
 * the three run in different places; scripts/test-business-hosts.mjs fails
 * if they drift.
 *
 * Build-time settings (REACT_APP_* is baked into the bundle):
 *
 *   REACT_APP_PUBLIC_SITE_HOST     the apex, default myisraelrental.com
 *   REACT_APP_BUSINESS_SUBDOMAINS  "1" to SHOW owners the subdomain form.
 *                                  Off until wildcard DNS and its
 *                                  certificate exist: the site sends HSTS
 *                                  with includeSubDomains, so a subdomain
 *                                  without a valid certificate does not
 *                                  degrade, it refuses to open.
 *   REACT_APP_BUSINESS_CANONICAL   "path" (default) or "subdomain" - which
 *                                  of the two URLs search engines treat as
 *                                  the page. Mirrors BUSINESS_CANONICAL on
 *                                  the backend.
 */

const RESERVED_WORDS = `
www admin api app mail smtp imap pop ftp cdn static assets media img
ns1 ns2 dns mx autodiscover autoconfig webmail dev staging test preview
blog help support docs status dashboard account accounts auth login
p og short link links go my me new signup register business businesses
properties property stays services requests jobs manager chat
`;

export const RESERVED_SLUGS = new Set(RESERVED_WORDS.split(/\s+/).filter(Boolean));

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

export const normaliseHost = (host) =>
  String(host || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');

export const SITE_HOST = normaliseHost(process.env.REACT_APP_PUBLIC_SITE_HOST || 'myisraelrental.com');
export const SUBDOMAINS_ON = process.env.REACT_APP_BUSINESS_SUBDOMAINS === '1';
const CANONICAL_MODE = String(process.env.REACT_APP_BUSINESS_CANONICAL || 'path').toLowerCase();

/** The business slug a host belongs to, or null. Same rules as the server. */
export function slugFromHost(host, apex = SITE_HOST) {
  const h = normaliseHost(host);
  const a = normaliseHost(apex);
  if (!h || !a || !h.endsWith(`.${a}`)) return null;
  const label = h.slice(0, -(a.length + 1));
  if (!SLUG_PATTERN.test(label) || RESERVED_SLUGS.has(label)) return null;
  return label;
}

/** The business this tab is on, when it was opened at <slug>.<apex>. */
export const currentBusinessHostSlug = () =>
  (typeof window === 'undefined' ? null : slugFromHost(window.location.host));

/** An absolute URL on the main site. */
export const apexUrl = (path = '/', apex = SITE_HOST) =>
  `https://${apex}${String(path).startsWith('/') ? path : `/${path}`}`;

export const isSubdomainable = (slug) => SLUG_PATTERN.test(slug || '') && !RESERVED_SLUGS.has(slug);

/** The link an owner shares. The subdomain once that is switched on. */
export function businessPublicUrl(slug, id, { subdomains = SUBDOMAINS_ON, apex = SITE_HOST, origin } = {}) {
  if (subdomains && isSubdomainable(slug)) return `https://${slug}.${apex}`;
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : `https://${apex}`);
  return `${base}/business/${slug || id}`;
}

/** How an address reads on screen, without the scheme. */
export function businessAddressLabel(slug, { subdomains = SUBDOMAINS_ON, apex = SITE_HOST } = {}) {
  return subdomains ? `${slug}.${apex}` : `${apex}/business/${slug}`;
}

/** The canonical URL for a business page. Path by default; see the header. */
export function businessCanonicalUrl(slug, id, { mode = CANONICAL_MODE, apex = SITE_HOST } = {}) {
  if (mode === 'subdomain' && isSubdomainable(slug)) return `https://${slug}.${apex}/`;
  return `https://${apex}/business/${slug || id}`;
}
