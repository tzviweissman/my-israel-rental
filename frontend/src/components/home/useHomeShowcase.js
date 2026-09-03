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
 *   rentals       the newest listings with a photo, featured ones first,
 *                 for the "Featured rentals" rail;
 *   businesses    the newest services with a cover, for the businesses
 *                 rail.
 *
 * If either list fails or comes back empty the corridor falls back to
 * the site's own generated stills, so the hero never runs blank — the
 * same reason siteAssets.js exists at all.
 */
import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

import { API } from '../../lib/apiBase';
import SITE_ASSETS from '../../lib/siteAssets';
import { framedImage, sizedImage } from '../../utils/cdnImage';
import { getGigCover } from '../../utils/gigAvailability';

const CARD_WIDTH = 520;
// The gallery's cells are a fixed portrait box, so its photos are fitted into
// that box and padded rather than cropped — see framedImage.
const GALLERY_W = 700;
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
const propertyPhoto = (p) => {
  const first = (p.images || []).find((u) => typeof u === 'string' && u.startsWith('http') && !isVideo(u));
  return first || null;
};

const byNewest = (a, b) => String(b.created_at || '').localeCompare(String(a.created_at || ''));

export default function useHomeShowcase() {
  const [properties, setProperties] = useState([]);
  const [gigs, setGigs] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      axios.get(`${API}/properties`, { params: { limit: 200 } }),
      axios.get(`${API}/marketplace/gigs`, { params: { limit: 60 } }),
    ]).then(([props, svc]) => {
      if (!alive) return;
      if (props.status === 'fulfilled' && Array.isArray(props.value.data)) setProperties(props.value.data);
      if (svc.status === 'fulfilled' && Array.isArray(svc.value.data)) setGigs(svc.value.data);
      setLoaded(true);
    });
    return () => { alive = false; };
  }, []);

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

  // Four photos for the supply-side gallery: two businesses, two rentals,
  // taken from deeper in each list than the rails show so the same photo is
  // not on screen twice in one scroll.
  const gallery = useMemo(() => {
    const b = businesses.slice(8, 12).map((g) => framedImage(getGigCover(g), GALLERY_W, GALLERY_H));
    const r = rentals.slice(6, 10).map((p) => framedImage(propertyPhoto(p), GALLERY_W, GALLERY_H));
    const out = [b[0], r[0], b[1], r[1]].filter(Boolean);
    // Short lists fall back to the front of each, then to the site stills, so
    // the grid is never a row of empty boxes.
    const spare = [...businesses, ...rentals].map((x) => framedImage(getGigCover(x) || propertyPhoto(x), GALLERY_W, GALLERY_H));
    for (const u of spare) { if (out.length >= 4) break; if (u && !out.includes(u)) out.push(u); }
    for (const f of FALLBACK_STILLS) { if (out.length >= 4) break; out.push(f.src); }
    return out.slice(0, 4);
  }, [rentals, businesses]);

  return { loaded, streamImages, gallery, rentals: rentals.slice(0, 6), businesses: businesses.slice(0, 8) };
}
