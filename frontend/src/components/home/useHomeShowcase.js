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

  // Today's picks: a dozen square cards for the coverflow, drawn from the same
  // two lists and rotated by the calendar day so the section genuinely differs
  // from one day to the next rather than only saying so.
  //
  // It is "picks", not "deals". Nothing in this product records a discount —
  // no was-price, no sale flag, no expiry — so a card headed "deal" would be a
  // claim about price that no field on the listing supports. The rotation is
  // what makes "today's" true; the word above it has to be true as well.
  const picks = useMemo(() => {
    const day = Math.floor(Date.now() / 86400000);
    const money = (n, currency, per) => (
      n ? `${currency === 'USD' ? '$' : '₪'}${Number(n).toLocaleString()}${per}` : null
    );
    const stay = (p) => ({
      key: `p-${p.id}`,
      src: framedImage(propertyPhoto(p), PICK_SIZE, PICK_SIZE),
      alt: p.title || '',
      kind: 'stay',
      // The whole row, so the page can build the headline with propertyTitle
      // rather than the raw title, which for most listings is just the area.
      property: p,
      title: p.title || '',
      area: p.area || '',
      href: `/property/${p.id}`,
      price: money(p.monthly_price, p.currency, '/mo') || money(p.nightly_price, p.currency, '/night'),
      beds: p.bedrooms ? String(p.bedrooms) : null,
      rentalType: p.rental_type || '',
    });
    const biz = (g) => ({
      key: `b-${g.id}`,
      src: framedImage(getGigCover(g), PICK_SIZE, PICK_SIZE),
      alt: g.title || '',
      kind: 'biz',
      title: g.title || '',
      title_he: g.title_he || '',
      area: g.area || '',
      href: `/businesses/${g.id}`,
      category: g.category || '',
    });
    const pool = [];
    const r = rentals.map(stay);
    const b = businesses.map(biz);
    for (let i = 0; i < Math.max(r.length, b.length); i++) {
      if (r[i]) pool.push(r[i]);
      if (b[i]) pool.push(b[i]);
    }
    if (pool.length < 4) return [];
    // Rotate the whole pool, so every listing comes round over time instead of
    // the same twelve showing for ever.
    const start = (day * 3) % pool.length;
    return Array.from({ length: Math.min(12, pool.length) }, (_, i) => pool[(start + i) % pool.length]);
  }, [rentals, businesses]);

  return { loaded, streamImages, gallery, picks, rentals: rentals.slice(0, 6), businesses: businesses.slice(0, 8) };
}
