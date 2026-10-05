/**
 * "Say it once" (docs/page-builder-design-rules.md, rule 1.4): a fact or a
 * badge appears at most once above the fold and at most twice on the page.
 * Enforced here, in what the page draws, rather than hoped for in a prompt.
 *
 * Pure, so scripts/test-page-v3-ledger.mjs can test it without a browser.
 */

/** Keep each key's first `max` items, in order; drop the rest. */
export function limitRepeats(items, keyOf, max = 2) {
  const seen = new Map();
  return (items || []).filter((item) => {
    const k = keyOf(item);
    if (k == null) return true;
    const n = (seen.get(k) || 0) + 1;
    seen.set(k, n);
    return n <= max;
  });
}

/**
 * The composed body under a v3 hero.
 *
 * - The v3 hero IS the hero: a composed hero or cover band would be a second
 *   one (and crop the cover, which may be a flyer, rule 4).
 * - The chat button already sits in the hero, after the content and in the
 *   phone bar (rule 1.3: hero, after the offer, sticky); a contact block
 *   would be a fourth.
 * - The offer block carries the facts and, for one listing, the listing.
 * - Each remaining block type at most once: two galleries repeat each other.
 */
export function v3BodyBlocks(blocks, { listings = 0 } = {}) {
  // Phase 4: the offer block says the facts (hours, supervision, where), so a
  // facts band would be the second and third time; and one listing is the
  // offer, so its card would repeat it. A catalogue keeps its cards.
  const drop = ['hero', 'cover', 'contact', 'facts', ...(listings <= 1 ? ['services'] : [])];
  const kept = (blocks || []).filter((b) => b && !drop.includes(b.type));
  return limitRepeats(kept, (b) => (b.type === 'services' ? null : b.type), 1);
}
