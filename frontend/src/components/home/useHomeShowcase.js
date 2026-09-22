/**
 * useHomeShowcase — the real listings and businesses the home page shows.
 *
 * One fetch of each public list, then three views over the same rows:
 *
 *   streamImages  the cards that ride the ImageStreamHero corridor —
 *                 rentals and businesses interleaved (a rental first,
 *                 per the positioning ruling), only rows that carry a
 *                 real photo, requested at card size so eighteen cards
 *                 do not pull eighteen full-resolution images;
 *   rentals       listings with a photo, featured ones first, for the
 *                 corridor and the gallery;
 *   recent        the same rows sorted purely by when they were posted, for
 *                 the moving "Recently added" row. Deliberately NOT the
 *                 featured-first order: five of the live listings carry
 *                 is_featured, so "featured" was a label on a row that was
 *                 mostly not featured;
 *   businesses    the newest services with a cover, for the businesses
 *                 rail.
 *
 * If either list fails or comes back empty the corridor falls back to
 * the site's own generated stills, so the hero never runs blank — the
 * same reason siteAssets.js exists at all.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import { API } from '../../lib/apiBase';
import SITE_ASSETS from '../../lib/siteAssets';
import { framedImage, sizedImage } from '../../utils/cdnImage';
import { getGigCover } from '../../utils/gigAvailability';

const CARD_WIDTH = 520;
// The gallery's cells are a fixed portrait box, so its photos are fitted into
// that box and padded rather than cropped — see framedImage.
const GALLERY_W = 700;
// The coverflow's cards are square.
const PICK_SIZE = 640;
const GALLERY_H = 900;

const FALLBACK_STILLS = [
  'scene2-villa-approach',
  'scene3-interior-reveal',
  'scene1-aerial',
  'scene5-lister-jerusalem',
  'scene9-kotel-exterior-v2',
  'scene7-ac-pro',
  'scene13-street-lit',
  'scene10-kotel-interior-v2',
].map((key) => ({ src: SITE_ASSETS[key], alt: '' }));

const isVideo = (u) => /\.(mp4|webm|mov)(\?|$)/i.test(u || '');

/** A property's cover, or null when it has no real photo. */
// Exported: the sign-up page's sphere draws from the same well.
export const propertyPhoto = (p) => {
  const first = (p.images || []).find((u) => typeof u === 'string' && u.startsWith('http') && !isVideo(u));
  return first || null;
};

const byNewest = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''));

const SOURCES = {
  properties: () => axios.get(`${API}/properties`, { params: { limit: 200 } }),
  gigs: () => axios.get(`${API}/marketplace/gigs`, { params: { limit: 60 } }),
  // The offers shelf. Its own endpoint, so an empty result here is a fact
  // about the site - nobody is running an offer today - and not a filter
  // that failed.
  deals: () => axios.get(`${API}/marketplace/deals`, { params: { limit: 24 } }),
};
const ALL_SOURCES = Object.keys(SOURCES);
const NONE_FAILED = { properties: false, gigs: false, deals: false };

// A FAILED LIST IS NOT AN EMPTY LIST. A failed request used to leave its
// list at [] and still set `loaded`, so the page could not tell "nothing is
// listed" from "the API did not answer". During a backend deploy the API is
// unreachable for about a minute, and in that window the home page told
// visitors "No offers yet" and "New listings are on their way" on a site with
// 164 listings. Every outage would do the same.
//
// So a list that fails is retried on its own, on a schedule that outlasts a
// deploy swap, and `failed` says which lists never arrived. The page shows an
// empty state only when every list it depends on actually answered.
//
// Attempts at 0, 3, 11, 31 and 61 seconds. A Railway deploy swap takes about
// a minute; the schedule was 31 seconds while this comment said a minute, so
// a visitor arriving mid-deploy had to click for the back half of it.
const RETRY_DELAYS_MS = [3000, 8000, 20000, 30000];

export default function useHomeShowcase() {
  const [properties, setProperties] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [deals, setDeals] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(NONE_FAILED);
  // True while a failed list is waiting for its next attempt. The page shows
  // nothing during it, rather than flashing an error that the next attempt
  // is likely to clear.
  const [retrying, setRetrying] = useState(false);
  // Bumped by retry() and by the browser coming back online; each bump is a
  // fresh round of attempts.
  const [round, setRound] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer = null;
    const setters = { properties: setProperties, gigs: setGigs, deals: setDeals };
    const attempt = (names, tryIndex) => {
      Promise.allSettled(names.map((n) => SOURCES[n]())).then((results) => {
        if (!alive) return;
        const stillFailing = names.filter((n, i) => {
          const r = results[i];
          if (r.status === 'fulfilled' && Array.isArray(r.value.data)) {
            setters[n](r.value.data);
            return false;
          }
          return true;
        });
        // Lists not in this attempt already arrived, so they are not failed.
        setFailed({ ...NONE_FAILED, ...Object.fromEntries(stillFailing.map((n) => [n, true])) });
        setLoaded(true);
        if (stillFailing.length && tryIndex < RETRY_DELAYS_MS.length) {
          setRetrying(true);
          timer = window.setTimeout(() => attempt(stillFailing, tryIndex + 1), RETRY_DELAYS_MS[tryIndex]);
        } else {
          setRetrying(false);
        }
      });
    };
    attempt(ALL_SOURCES, 0);
    return () => { alive = false; window.clearTimeout(timer); };
  }, [round]);

  const retry = useCallback(() => {
    setRetrying(true);
    setRound((r) => r + 1);
  }, []);

  // A dropped connection that comes back should not need a click.
  const anyFailed = failed.properties || failed.gigs || failed.deals;
  useEffect(() => {
    if (!anyFailed) return undefined;
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [anyFailed, retry]);

  const rentals = useMemo(
    () =>
      properties
        .filter((p) => propertyPhoto(p))
        .sort((a, b) => Number(!!b.is_featured) - Number(!!a.is_featured) || byNewest(a, b)),
    [properties],
  );

  const businesses = useMemo(
    () => gigs.filter((g) => g.status !== 'unpublished' && getGigCover(g)).sort(byNewest),
    [gigs],
  );

  // Newest first, nothing else. Twelve is enough for the moving row to be a
  // continuous band at desktop width rather than a short strip that visibly
  // restarts; the row halts itself if there are too few (see MARQUEE_MIN in
  // HomePreview).
  const recent = useMemo(
    () => properties.filter((p) => propertyPhoto(p)).sort(byNewest).slice(0, 12),
    [properties],
  );

  const streamImages = useMemo(() => {
    const r = rentals.map((p) => ({ src: sizedImage(propertyPhoto(p), CARD_WIDTH), alt: p.title || '' }));
    const b = businesses.map((g) => ({ src: sizedImage(getGigCover(g), CARD_WIDTH), alt: g.title || '' }));
    const out = [];
    for (let i = 0; out.length < 12 && (i < r.length || i < b.length); i++) {
      if (r[i]) out.push(r[i]);
      if (b[i]) out.push(b[i]);
    }
    return out.length >= 4 ? out : FALLBACK_STILLS;
  }, [rentals, businesses]);

  // Four cards for the supply-side gallery. Each one is an identified listing
  // or business - photo, name, where it is, and a link through - rather than an
  // anonymous photo, and every one is taken from deeper in its list than the
  // rails above show, so no card on this page is a repeat of another.
  const gallery = useMemo(() => {
    const bizCard = (g) => g && {
      key: `b-${g.id}`,
      src: framedImage(getGigCover(g), GALLERY_W, GALLERY_H),
      title: g.title || '',
      title_he: g.title_he || '',
      sub: g.area || '',
      href: `/businesses/${g.id}`,
    };
    const stayCard = (p) => p && {
      key: `p-${p.id}`,
      src: framedImage(propertyPhoto(p), GALLERY_W, GALLERY_H),
      title: p.title || '',
      title_he: '',
      sub: p.area || '',
      href: `/property/${p.id}`,
    };
    const b = businesses.slice(8, 12).map(bizCard);
    const r = rentals.slice(6, 10).map(stayCard);
    const out = [b[0], r[0], b[1], r[1]].filter(Boolean);
    // Short lists fall back to whatever is left that is not already used, so
    // the grid is never a row of empty boxes and never shows one thing twice.
    const spare = [...businesses.slice(0, 8).map(bizCard), ...rentals.slice(0, 6).map(stayCard)];
    for (const c of spare) {
      if (out.length >= 4) break;
      if (c && c.src && !out.some((o) => o.key === c.key)) out.push(c);
    }
    return out.slice(0, 4);
  }, [rentals, businesses]);

  // The offers, as cards.
  //
  // TWO RULES, both learned the hard way.
  //
  // A deal must have a cover. getGigCover returns null for a business with no
  // photos anywhere and framedImage passes null straight through, so an offer
  // from a business that never uploaded a picture rendered a card with no
  // image in it - a literal empty card sitting under "Today's deals". The
  // businesses rail has always filtered on this; the deals branch did not.
  //
  // And ONE offer is enough to be an offer. This used to need four before it
  // would say "deals" at all, which meant a business that ran the first offer
  // on the site had it silently dropped and saw a rotation of everything
  // instead. Nothing is ever padded to reach a count: the page renders as many
  // cards as there are offers and says so when there are none.
  const dealCards = useMemo(
    () =>
      deals
        .filter((g) => getGigCover(g))
        .slice(0, 12)
        .map((g) => ({
          key: `d-${g.id}`,
          src: framedImage(getGigCover(g), PICK_SIZE, PICK_SIZE),
          alt: g.title || '',
          kind: 'biz',
          title: g.title || '',
          title_he: g.title_he || '',
          area: g.area || '',
          href: `/businesses/${g.id}`,
          discount: g.discount || null,
        })),
    [deals],
  );
  const hasDeals = dealCards.length > 0;

  return {
    loaded, failed, retrying, retry,
    streamImages, gallery, dealCards, hasDeals, recent,
    rentals: rentals.slice(0, 6), businesses: businesses.slice(0, 8),
  };
}
