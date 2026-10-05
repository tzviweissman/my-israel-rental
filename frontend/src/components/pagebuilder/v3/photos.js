/**
 * A brief names pictures by reference, never by URL (backend
 * utils/design_brief.py PHOTO_REF): "cover", or one image of one listing,
 * "listing:<id>:gallery:<n>" or "listing:<id>:item:<n>:<k>". This is the one
 * place a reference becomes a URL, against what the business actually has
 * now; a reference that no longer resolves gives null and draws nothing.
 */
export function resolvePhoto(biz, ref) {
  if (!biz || !ref) return null;
  if (ref === 'cover') return biz.cover_url || null;
  const m = /^listing:([A-Za-z0-9_-]{1,64}):(gallery:(\d{1,2})|item:(\d{1,2}):(\d{1,2}))$/.exec(ref);
  if (!m) return null;
  const gig = (biz.listings || []).find((g) => g && g.id === m[1]);
  if (!gig) return null;
  if (m[3] !== undefined) return (gig.gallery || [])[Number(m[3])] || null;
  const item = [...(gig.tiers || []), ...(gig.products || [])][Number(m[4])];
  if (!item) return null;
  const pics = item.images || (item.image ? [item.image] : []);
  return pics[Number(m[5])] || null;
}

/** The brief's pictures of one kind, resolved, without repeats. */
export function photosOfKind(biz, brief, kind) {
  const seen = new Set();
  return ((brief && brief.photos) || [])
    .filter((p) => p.kind === kind)
    .map((p) => resolvePhoto(biz, p.ref))
    .filter((url) => url && !seen.has(url) && seen.add(url));
}
