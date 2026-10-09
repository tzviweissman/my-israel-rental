// Businesses with a hand-built page (scripts/publish-page.mjs writes the list
// to /pages/pages.json). Their address, /business/<slug>, is answered by the
// server with that page; inside the app the standard page must hand over
// to it WITHOUT showing first. Showing it and then jumping (Tzvi, 9 Oct
// 2026: "first i see the original then it jumps to the new one") is what
// this prevents: the list is fetched once at start-up, and a page that might
// be hand-built holds a loader until the answer is known.
//
// Production only: the dev server does not serve those pages, and reloading
// into them there would loop.
import { useEffect, useState } from 'react';

const LIVE = process.env.NODE_ENV === 'production';
let list = null;
let pending = null;

export function loadHandBuilt() {
  if (!LIVE) return Promise.resolve([]);
  if (list) return Promise.resolve(list);
  if (!pending) {
    pending = fetch('/pages/pages.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((l) => { list = Array.isArray(l) ? l : []; return list; });
  }
  return pending;
}

/* The list itself, in any build: the dashboard's "Edit your page" needs it
   in development too (the dev server serves public/pages/pages.json). */
let anyList = null;
export function handBuiltList() {
  if (!anyList) {
    anyList = fetch('/pages/pages.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : []))
      .then((l) => (Array.isArray(l) ? l : []))
      .catch(() => []);
  }
  return anyList;
}

/* hold: true while the page must not render (still checking, or leaving for
   the hand-built page). A null slug never holds. */
export function useHandBuilt(slug) {
  const known = !LIVE || !slug ? false : list ? list.includes(slug) : null;
  const [answer, setAnswer] = useState(known);
  useEffect(() => {
    if (!LIVE || !slug) { setAnswer(false); return undefined; }
    let cancelled = false;
    loadHandBuilt().then((l) => {
      if (cancelled) return;
      const yes = l.includes(slug);
      setAnswer(yes);
      if (yes) window.location.replace(`/business/${slug}${window.location.hash}`);
    });
    return () => { cancelled = true; };
  }, [slug]);
  if (!LIVE || !slug) return { hold: false };
  const now = known !== null ? known : answer;
  return { hold: now !== false };
}
