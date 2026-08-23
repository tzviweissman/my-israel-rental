/**
 * A stable, meaningless id for this browser, so a refresh does not count as
 * a new visitor.
 *
 * L4 of docs/leads-and-views-spec.md. Without it "views" means page loads,
 * and a listing looks popular because one person hit reload six times.
 *
 * What this is NOT: it carries no identity. It is a random value with
 * nothing derived from the person, the device or the network — deliberately
 * not a fingerprint of IP and user-agent, which would work without asking
 * but would mean storing exactly the data this codebase has gone out of its
 * way not to keep (see `_referrer_host`, which keeps a hostname and throws
 * the rest away).
 *
 * Consequences of that choice, all acceptable for counting views:
 *  - Clearing site data makes someone a new visitor.
 *  - The same person on a phone and a laptop is two visitors.
 *  - It can be forged by anyone who wants to inflate a number, which is
 *    also true of the un-deduped count it replaces.
 *
 * localStorage, not a cookie: the API is on another origin, so a
 * cross-site cookie would need SameSite=None and is dropped outright by
 * default in some browsers — it would fail silently and unevenly, which is
 * the worst behaviour a metric can have.
 */
const KEY = 'mir_vid';

// Private browsing and locked-down settings can make localStorage throw on
// access, not just on write. A visitor we cannot identify is still a
// visitor: we return null and the server records the view without dedupe,
// rather than losing it.
const safeGet = () => {
  try { return window.localStorage.getItem(KEY); } catch { return null; }
};
const safeSet = (v) => {
  try { window.localStorage.setItem(KEY, v); } catch { /* not fatal */ }
};

const makeId = () => {
  try {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const a = new Uint8Array(16);
    window.crypto.getRandomValues(a);
    return [...a].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    // Math.random is fine here: this is a dedupe key, not a secret. A
    // collision costs one undercounted view.
    return `r${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  }
};

export function getVisitorId() {
  const existing = safeGet();
  if (existing) return existing;
  const fresh = makeId();
  safeSet(fresh);
  // If the write failed, return it anyway — this page load still gets
  // deduped against itself, and the next one starts over.
  return fresh;
}

/** Headers to merge into a request whose view should be counted once. */
export function visitorHeaders() {
  const id = getVisitorId();
  return id ? { 'X-Visitor-Id': id } : {};
}

export default getVisitorId;
