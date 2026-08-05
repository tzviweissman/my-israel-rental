/**
 * Stays Marketplace map view — CartoDB Voyager tiles + one marker per
 * property. Mirrors ServicesMapView but tuned for the higher-density
 * Stays inventory (dozens of pins per city, price labels visible at a
 * glance, click through to the Property Detail page).
 *
 * Uses vanilla Leaflet — the react-leaflet 4.2 MapContainer breaks under
 * React 18 StrictMode's double-invoke lifecycle. Managing the map via
 * useEffect + explicit `map.remove()` cleanup means the mount/unmount
 * cycle behaves regardless of how many times React runs it.
 */
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { areaLabel } from '../../utils/areaNames';

const TEAL = 'var(--brand-primary)';
const GOLD = 'var(--gold)';

// Israel-centric fallback bounds — used when we have no pins yet so the
// map opens on-country instead of the middle of the Atlantic.
const ISRAEL_BOUNDS = L.latLngBounds(L.latLng(29.5, 34.2), L.latLng(33.4, 35.9));

// Escape user-controlled strings before embedding into raw popup HTML.
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// Price label pin — replaces the traditional "location pin with a dot"
// with an Airbnb-style pill showing the actual price. Two big benefits
// for renters browsing the map: (1) they can pattern-match affordable
// vs. premium zones at a glance, (2) they don't have to click every
// pin to see the price.
const priceIcon = (label, isPremium) => new L.DivIcon({
  className: 'stays-price-pin',
  iconSize: null,   // let the pill size to its content
  iconAnchor: [30, 14],
  popupAnchor: [0, -14],
  html: `
    <div style="
      background:${isPremium ? GOLD : '#ffffff'};
      color:${isPremium ? '#0F3A3A' : '#111827'};
      border:1.5px solid ${isPremium ? GOLD : '#e5e7eb'};
      padding:5px 10px;
      border-radius:999px;
      font-size:12px;
      font-weight:700;
      white-space:nowrap;
      box-shadow:0 3px 8px rgba(15,58,58,0.18);
      transition:transform 0.15s ease, box-shadow 0.15s ease;
    ">${esc(label)}</div>`,
});

const userIcon = () => new L.DivIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 4px rgba(37,99,235,0.35), 0 4px 10px rgba(37,99,235,0.35);"></div>`,
});

// Currency symbol lookup — matches the rest of the app's price
// rendering. Fallback to bare code (e.g. "EUR") for unknown currencies.
const symOf = (cur) => {
  if (!cur) return '₪';
  const c = cur.toUpperCase();
  if (c === 'ILS') return '₪';
  if (c === 'USD') return '$';
  if (c === 'EUR') return '€';
  return c + ' ';
};

// Compact price label for the pin. Vacation/short-term show nightly,
// long-term show monthly, both abbreviated to keep the pill narrow.
const priceLabel = (p) => {
  const cur = p.currency || 'ILS';
  const s = symOf(cur);
  if (p.rental_type === 'long-term') {
    if (!p.monthly_price) return s + '—';
    return `${s}${Math.round(p.monthly_price / 1000)}k`;
  }
  const nightly = p.nightly_price ?? (p.monthly_price ? p.monthly_price / 30 : null);
  if (!nightly) return s + '—';
  return `${s}${Math.round(nightly)}`;
};

const StaysMapView = ({ properties, userCoords, focusOnUser, displayCurrency, activeId, onPinClick }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  // Once the user pans / zooms the map manually we STOP moving the
  // view programmatically. Address selections then drop a "you
  // searched here" pin without hijacking whatever the user was
  // looking at — the direct fix for "don't zoom in when I search
  // nearby". Only the very first render frames the view.
  const hasUserInteractedRef = useRef(false);
  const hasFramedRef = useRef(false);
  const markersByIdRef = useRef(new Map());
  // Stash the callback in a ref so the pin-click handler always sees
  // the latest without needing to appear in the pin-effect dep array
  // (adding it there would rebuild the entire marker layer on every
  // parent re-render — janky when the parent re-renders often).
  const onPinClickRef = useRef(onPinClick);
  useEffect(() => { onPinClickRef.current = onPinClick; }, [onPinClick]);

  const pinRows = properties.filter(
    (p) => typeof p.lat === 'number' && typeof p.lng === 'number',
  );

  // Init exactly once per mount, tear down on unmount so StrictMode's
  // synthetic double-mount never leaves an orphaned Leaflet instance
  // stuck to the DOM node.
  useEffect(() => {
    if (!containerRef.current) return;
    if (containerRef.current._leaflet_id != null) {
      delete containerRef.current._leaflet_id;
    }
    const map = L.map(containerRef.current, {
      center: [32.084, 34.782], // Tel Aviv seed
      zoom: 9,
      scrollWheelZoom: true,
      zoomControl: false,
      preferCanvas: true,
      zoomSnap: 0.25,
      wheelDebounceTime: 40,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · ' +
        '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
      keepBuffer: 4,
    }).addTo(map);
    mapRef.current = map;
    // The moment the user grabs the map (drag) or scrolls it (zoom)
    // we lock our programmatic recentering out — see hasUserInteractedRef.
    map.on('dragstart zoomstart', () => {
      hasUserInteractedRef.current = true;
    });
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      markersByIdRef.current = new Map();
    };
  }, []);

  // Redraw pins whenever the filtered property set, user coords, or
  // display currency changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }
    const group = L.layerGroup().addTo(map);
    layerRef.current = group;
    markersByIdRef.current = new Map();

    // Vacation + short-term listings priced in the top 25% of the
    // filtered set get a gold pin — a subtle visual cue that these are
    // the premium picks in the current viewport. Long-term listings
    // never get the boost since their price scale is different.
    const shortTerm = pinRows.filter(
      (p) => p.rental_type !== 'long-term' && (p.nightly_price || p.monthly_price),
    );
    let premiumThreshold = Infinity;
    if (shortTerm.length >= 4) {
      const prices = shortTerm.map((p) => p.nightly_price || (p.monthly_price / 30));
      prices.sort((a, b) => a - b);
      premiumThreshold = prices[Math.floor(prices.length * 0.75)];
    }

    const points = [];
    for (const p of pinRows) {
      const label = priceLabel(p);
      const nightly = p.nightly_price || (p.monthly_price ? p.monthly_price / 30 : 0);
      const isPremium = p.rental_type !== 'long-term' && nightly >= premiumThreshold;
      const marker = L.marker([p.lat, p.lng], { icon: priceIcon(label, isPremium) }).addTo(group);

      // Rich popup: cover thumbnail (if any) + title + area + click-through.
      const cover = (p.images && p.images[0]) || '';
      const title = esc(p.title || t('stays.untitledProperty', 'Property'));
      // Localised through utils/areaNames (DB value, not an i18n string);
      // still escaped because it goes into a raw popup HTML string.
      const area = esc(areaLabel(p.area, t));
      const cur = p.currency || 'ILS';
      const priceLine = p.rental_type === 'long-term'
        ? `${symOf(cur)}${(p.monthly_price || 0).toLocaleString()} / ${t('stays.unitMonth', 'month')}`
        : `${symOf(cur)}${Math.round(nightly).toLocaleString()} / ${t('stays.unitNight', 'night')}`;
      const html = `
        <div data-testid="stays-map-popup" style="width:220px;font-family:inherit;">
          ${cover ? `<div style="height:120px;border-radius:10px;background:url(${esc(cover)}) center/cover no-repeat;margin-bottom:8px;"></div>` : ''}
          <div style="font-weight:700;font-size:14px;color:#111827;line-height:1.3;margin-bottom:2px;">${title}</div>
          <div style="font-size:11px;color:#6b7280;margin-bottom:6px;">${area}</div>
          <div style="font-size:13px;color:${TEAL};font-weight:700;margin-bottom:8px;">${priceLine}</div>
          <button type="button" data-property-id="${esc(p.id)}"
            style="display:block;width:100%;padding:8px 10px;border:0;border-radius:8px;background:${TEAL};color:#fff;font-size:12px;font-weight:600;cursor:pointer;">
            ${esc(t('stays.viewDetailsArrow', 'View details →'))}
          </button>
        </div>`;
      marker.bindPopup(html, { closeButton: false, minWidth: 220 });
      // Every pin click echoes up to the parent so the peek-strip can
      // scroll the matching card into view + light it up. `preventOpen`
      // isn't a Leaflet API — instead we let the popup open normally
      // AND bubble the id so both affordances stay in sync.
      marker.on('click', () => { onPinClickRef.current?.(p.id); });
      marker.on('popupopen', (e) => {
        const el = e.popup.getElement();
        if (!el) return;
        el.querySelectorAll('button[data-property-id]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-property-id');
            if (id) navigate(`/property/${id}`);
          });
        });
      });
      markersByIdRef.current.set(p.id, marker);
      points.push([p.lat, p.lng]);
    }

    if (userCoords) {
      L.marker([userCoords.lat, userCoords.lng], { icon: userIcon() })
        .addTo(group)
        .bindPopup(`<span style="font-size:13px;font-weight:600;color:${TEAL};">${esc(t('stays.youSearchedHere', 'You searched here'))}</span>`);
      points.push([userCoords.lat, userCoords.lng]);
    }

    // Framing rules:
    //   • Once the user has panned or zoomed manually, we never
    //     move the view again. Explicit fix for "don't zoom in when
    //     I search stays nearby" — a new address pin drops in place,
    //     but their existing pan/zoom is respected.
    //   • On the very first paint (before any interaction) we frame
    //     the map: fit to all pins, or the Israel bounding box when
    //     empty. `hasFramedRef` guards against re-framing on data
    //     refresh even if the user hasn't yet interacted — otherwise
    //     an admin editing a listing would see the map jump every
    //     time the WebSocket delivered fresh inventory.
    if (hasUserInteractedRef.current) {
      // No-op: the user has taken control.
    } else if (!hasFramedRef.current) {
      hasFramedRef.current = true;
      if (points.length === 0) {
        map.fitBounds(ISRAEL_BOUNDS, { padding: [24, 24] });
      } else if (points.length === 1) {
        map.setView(points[0], 13);
      } else {
        map.fitBounds(
          L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng))),
          { padding: [48, 48], maxZoom: 14 },
        );
      }
    }
    // `focusOnUser` is intentionally NOT honoured here anymore — the
    // request "don't zoom in when I click Show stays nearby" is the
    // whole reason we moved to interaction-locked framing. The user
    // pin is drawn above; framing happens only on first paint.
  }, [
    // Serialize a compact projection so we re-run only when the pin set
    // actually changes, not on every parent re-render.
    JSON.stringify(pinRows.map((p) => [p.id, p.lat, p.lng, p.nightly_price, p.monthly_price])),
    userCoords?.lat, userCoords?.lng, focusOnUser, displayCurrency, navigate, i18n.language,
  ]);

  // Open the matching marker's popup whenever the peek strip / list
  // highlights a card. Keeping this in its own effect means we never
  // tear down and rebuild the pin layer just because a card was
  // hovered — critical for smooth map ↔ list cross-linking.
  useEffect(() => {
    if (!activeId) return;
    const marker = markersByIdRef.current.get(activeId);
    if (marker && !marker.isPopupOpen?.()) {
      marker.openPopup();
    }
  }, [activeId]);

  return (
    <div
      ref={containerRef}
      className="stays-map w-full rounded-3xl overflow-hidden ring-1 ring-black/5 shadow-[0_10px_40px_-15px_rgba(15,58,58,0.25)] h-[380px] sm:h-[520px] md:h-[620px] lg:h-[720px] lg:max-h-[78vh]"
      data-testid="stays-map"
    />
  );
};

export default StaysMapView;
