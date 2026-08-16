// Shared back-navigation helpers.
//
// The rental app keeps its filter state in the URL (?area=…&type=…) on every
// listing / search page. When a renter clicks a card, we need to remember the
// exact filtered path they came from so the detail page's "Back to Listings"
// button lands them back on the same view — not a wiped, unfiltered page.
//
// Two helpers:
//
//   saveReturnPath()
//     Call once, right before `navigate(<detail-url>)`. Writes the current
//     pathname + search to sessionStorage.previousPath so the detail page
//     can read it back on mount.
//
//   useReturnDestination(prefixWhitelist, fallback)
//     React hook used by detail pages to compute their back-button target.
//     Returns the stored previousPath if (and only if) it starts with one
//     of the whitelisted prefixes — that guards against a stale entry from
//     a totally unrelated page (e.g. leftover /dashboard entry) hijacking
//     the back button on a listing detail.

import { useMemo } from 'react';

const STORAGE_KEY = 'previousPath';

export const saveReturnPath = () => {
  try {
    sessionStorage.setItem(
      STORAGE_KEY,
      window.location.pathname + window.location.search,
    );
  } catch {
    // sessionStorage can be blocked in some privacy modes; back-nav falls
    // through to the caller's fallback in that case, so silent-skip is fine.
  }
};

export const readReturnPath = () => {
  try {
    return sessionStorage.getItem(STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const matchesPrefix = (path, prefixes) => {
  if (!path) return false;
  return prefixes.some((prefix) => path === prefix || path.startsWith(prefix));
};

export const useReturnDestination = (prefixWhitelist, fallback) => {
  return useMemo(() => {
    const stored = readReturnPath();
    if (matchesPrefix(stored, prefixWhitelist)) return stored;
    return fallback;
  }, [prefixWhitelist, fallback]);
};

// Convenience predicate for detail pages that vary their UI (label, button
// destination) based on where the visitor arrived from. Kept out of the
// hook so pages can call it during render without extra memoization.
export const matchesReturnPrefix = (prefixes) => {
  return matchesPrefix(readReturnPath(), prefixes);
};

// The label for a back button, derived from where it actually goes.
//
// This exists because "Back to Jobs" was hardcoded on the post-a-job page,
// so someone who arrived from their dashboard was told they were going
// back to a board they had never been on — and then was. The label and the
// destination must come from the same fact or they drift apart again.
export const backLabelFor = (destination, t, fallbackKey, fallbackText) => {
  if (String(destination || '').startsWith('/dashboard')) {
    return t('common.backToDashboard', 'Back to my dashboard');
  }
  return t(fallbackKey, fallbackText);
};
