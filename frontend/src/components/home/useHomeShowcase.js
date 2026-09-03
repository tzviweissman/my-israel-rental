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

  return { loaded, streamImages, gallery, rentals: rentals.slice(0, 6), businesses: businesses.slice(0, 8) };
}
