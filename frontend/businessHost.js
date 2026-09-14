/**
 * Which business, if any, a Host header names — for the Node server.
 *
 * `blazinboards.myisraelrental.com` is the same page as
 * `myisraelrental.com/business/blazinboards`: the subdomain IS the slug.
 * server.js uses this to give link-preview crawlers the right card on a
 * business host, and to send every other path on that host to the main site.
 *
 * THREE COPIES OF THE RULES, ON PURPOSE. backend/utils/businesses.py
 * (which refuses to MINT a reserved slug), this file (the server, CommonJS,
 * outside the CRA bundle), and frontend/src/utils/businessHost.js (the
 * browser app, which CRA cannot import from outside src/). They run in
 * three different places, so they cannot share a module;
 * scripts/test-business-hosts.mjs fails if the lists or the parsing differ.
 */

const RESERVED_WORDS = `
www admin api app mail smtp imap pop ftp cdn static assets media img
ns1 ns2 dns mx autodiscover autoconfig webmail dev staging test preview
blog help support docs status dashboard account accounts auth login
p og short link links go my me new signup register business businesses
properties property stays services requests jobs manager chat
`;

const RESERVED_SLUGS = new Set(RESERVED_WORDS.split(/\s+/).filter(Boolean));

// A DNS label, capped at the slug's 60 characters.
const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,58}[a-z0-9])?$/;

/** Lowercase, no port, no trailing root dot. Hostnames are case-insensitive. */
function normaliseHost(host) {
  return String(host || '').trim().toLowerCase().replace(/:\d+$/, '').replace(/\.$/, '');
}

/**
 * The business slug a host belongs to, or null.
 *
 * Null for the apex, for www, for a reserved label, for anything that is
 * not exactly ONE label under the apex (a.b.myisraelrental.com is not a
 * business), and for any other domain — a Host header is client-supplied
 * and `myisraelrental.com.evil.com` must not match.
 */
function slugFromHost(host, apex) {
  const h = normaliseHost(host);
  const a = normaliseHost(apex);
  if (!h || !a || !h.endsWith(`.${a}`)) return null;
  const label = h.slice(0, -(a.length + 1));
  if (!SLUG_PATTERN.test(label) || RESERVED_SLUGS.has(label)) return null;
  return label;
}

module.exports = { RESERVED_SLUGS, SLUG_PATTERN, normaliseHost, slugFromHost };
