/**
 * Services Marketplace map view — OSM tiles + one marker per gig.
 *
 * Uses vanilla Leaflet (no react-leaflet) because react-leaflet 4.2's
 * MapContainer trips a `Map container is already initialized` error
 * under React 18 StrictMode's double-invoke lifecycle. Managing the
 * Leaflet map instance ourselves in a single useEffect with an explicit
 * `map.remove()` cleanup means the StrictMode teardown → remount cycle
 * gets a fresh map every time, no matter how many times React
 * double-invokes in dev.
 *
 * When the renter has opted into "Show nearby":
 *   • Their coordinates are drawn as a distinct blue dot.
 *   • If `maxDistance` is set, a translucent circle marks the radius so
 *     they can see exactly which pins made the cut.
 */
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CITY_COORDS, resolveGigCoords } from '../../utils/servicesGeo';
import { localizedTitle } from '../../utils/gigLocale';

const TEAL = '#1E6A6A';
const GOLD = '#D4AF37';

// Inline SVG icon — Leaflet's default asset paths break under bundlers.
// Uses a soft drop-shadow filter so pins lift off the pale Positron tiles
// with a bit of depth (the flat OSM tiles didn't need it; Positron does).
const gigIcon = () => new L.DivIcon({
  className: 'gig-pin',
  iconSize: [30, 40],
  iconAnchor: [15, 38],
  popupAnchor: [0, -34],
  html: `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40" fill="none"
         style="filter: drop-shadow(0 3px 6px rgba(15,58,58,0.35));">
      <path d="M15 0C6.72 0 0 6.72 0 15c0 10.5 13.16 23.15 14.34 24.32a.94.94 0 0 0 1.32 0C16.84 38.15 30 25.5 30 15 30 6.72 23.28 0 15 0Z" fill="${TEAL}"/>
      <circle cx="15" cy="15" r="6.5" fill="${GOLD}"/>
    </svg>`,
});

const userIcon = () => new L.DivIcon({
  className: '',
  iconSize: [22, 22],
  iconAnchor: [11, 11],
  html: `<div style="width:22px;height:22px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 0 0 2px rgba(37,99,235,0.35);"></div>`,
});

// Israel-centric fallback bounds when we have no pins yet — keeps the
// map from showing a pointless view of the Atlantic on first paint.
const ISRAEL_BOUNDS = L.latLngBounds(L.latLng(29.5, 34.2), L.latLng(33.4, 35.9));

// Escape user-controlled strings before we drop them into a raw HTML
// popup so a malicious gig title can't inject markup.
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const formatDistance = (km) => {
  if (km == null) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0)} km`;
};

const ServicesMapView = ({ gigs, userCoords, maxDistanceKm }) => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);

  // Build pin coordinates + drop gigs whose city we can't resolve —
  // they still show in the list view, they just can't be plotted.
  const pinRows = gigs
    .map((g) => {
      const c = resolveGigCoords(g);
      return c ? { gig: g, lat: c[0], lng: c[1] } : null;
    })
    .filter(Boolean);

  // Initialize the map exactly once per mount. StrictMode's teardown
  // triggers the cleanup which calls `map.remove()`, so the next mount
  // gets a fresh Leaflet map on the same node without collision.
  useEffect(() => {
    if (!containerRef.current) return;
    // Belt-and-braces: if a prior init left a `_leaflet_id` marker on
    // the node, strip it so `new L.Map(el)` won't refuse to bind.
    if (containerRef.current._leaflet_id != null) {
      delete containerRef.current._leaflet_id;
    }
    const map = L.map(containerRef.current, {
      center: [CITY_COORDS.telAviv.lat, CITY_COORDS.telAviv.lng],
      zoom: 9,
      scrollWheelZoom: true,
      // Cleaner UX defaults for the modern basemap:
      //  - Zoom controls repositioned to top-right so they never
      //    collide with our overlay pins clustered around city
      //    centers on first load.
      //  - `preferCanvas` renders shapes on <canvas> instead of SVG,
      //    which is markedly faster with hundreds of markers.
      //  - `zoomSnap: 0.25` gives a silky smooth pinch/scroll zoom
      //    instead of the default hard-integer 1-step snap.
      zoomControl: false,
      preferCanvas: true,
      zoomSnap: 0.25,
      wheelDebounceTime: 40,
    });
    L.control.zoom({ position: 'topright' }).addTo(map);
    // CartoDB Voyager — the clean, muted basemap used by most modern
    // travel + services apps (subtle grey roads, soft greens for parks,
    // light blue water). Retains just enough visual character to help
    // renters pick out neighborhoods without competing with our teal
    // pins for attention. Free under CC BY, no API key required.
    // Retina tiles (`{r}` = "@2x") auto-serve on hi-DPI screens so the
    // base looks tack-sharp on modern laptops + phones.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · ' +
        '&copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
      // A hair of extra tile buffer keeps the edges smooth when the
      // user pans quickly — otherwise Positron flashes empty grey
      // rectangles for a beat.
      keepBuffer: 4,
    }).addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Rebuild the pin/circle layer whenever the gig set, user coords,
  // or distance filter changes. Keeping this in its own effect means
  // the map lifecycle (above) never re-runs on data updates.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Wipe the previous layer group before drawing the new one.
    if (layerRef.current) {
      layerRef.current.remove();
      layerRef.current = null;
    }
    const group = L.layerGroup().addTo(map);
    layerRef.current = group;

    // Aggregate pins by exact city coord so a stack of gigs in Tel Aviv
    // doesn't render 30 overlapping markers — we show one pin per city
    // with an internal list in the popup.
    const clusters = new Map();
    for (const p of pinRows) {
      const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
      if (!clusters.has(key)) clusters.set(key, { lat: p.lat, lng: p.lng, items: [] });
      clusters.get(key).items.push(p.gig);
    }

    const points = [];
    for (const cluster of clusters.values()) {
      const items = cluster.items.slice(0, 4);
      const extra = cluster.items.length - items.length;
      const rows = items.map((g) => {
        const title = esc(localizedTitle(g, i18n));
        const provider = esc(g.provider?.name || '');
        const area = g.area ? ` · ${esc(g.area)}` : '';
        const dist = typeof g.distance_km === 'number'
          ? `<span style="color:${TEAL};font-weight:600;"> · ${formatDistance(g.distance_km)}</span>`
          : '';
        return `
          <button type="button" data-gig-id="${esc(g.id)}"
            data-testid="services-map-pin-${esc(g.id)}"
            style="display:block;width:100%;text-align:start;padding:6px 4px;border:0;background:transparent;border-bottom:1px solid #f3f4f6;cursor:pointer;font-family:inherit;">
            <div style="font-weight:600;font-size:13px;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${title}</div>
            <div style="font-size:11px;color:#6b7280;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${provider}${area}${dist}</div>
          </button>`;
      }).join('');
      const more = extra > 0
        ? `<div style="font-size:11px;color:#6b7280;padding-top:4px;">+ ${extra} more</div>`
        : '';
      const html = `<div data-testid="services-map-popup" style="min-width:220px;max-width:280px;">${rows}${more}</div>`;

      const marker = L.marker([cluster.lat, cluster.lng], { icon: gigIcon() }).addTo(group);
      marker.bindPopup(html);
      // Wire click events on rendered buttons the moment the popup opens.
      marker.on('popupopen', (e) => {
        const el = e.popup.getElement();
        if (!el) return;
        el.querySelectorAll('button[data-gig-id]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.getAttribute('data-gig-id');
            if (id) navigate(`/services/gig/${id}`);
          });
        });
      });
      points.push([cluster.lat, cluster.lng]);
    }

    // Nearby radius circle — only when both coords + a distance filter
    // are active. Same TEAL as the rest of the site.
    if (userCoords && maxDistanceKm) {
      L.circle([userCoords.lat, userCoords.lng], {
        radius: Number(maxDistanceKm) * 1000,
        color: TEAL,
        fillColor: TEAL,
        fillOpacity: 0.08,
        weight: 1.5,
      }).addTo(group);
    }
    if (userCoords) {
      const um = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon() }).addTo(group);
      um.bindPopup(
        `<span style="font-size:13px;font-weight:600;color:${TEAL};">${esc(t('services.youAreHere', 'You are here'))}</span>`
      );
      points.push([userCoords.lat, userCoords.lng]);
    }

    // Fit map to whatever we drew — fall back to Israel bounds if empty.
    if (points.length === 0) {
      map.fitBounds(ISRAEL_BOUNDS, { padding: [24, 24] });
    } else if (points.length === 1) {
      map.setView(points[0], 12);
    } else {
      map.fitBounds(L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng))), {
        padding: [48, 48],
        maxZoom: 13,
      });
    }
  }, [
    // Use JSON of a lightweight projection so we re-run only when the
    // rendered pin set actually changes, not on every parent re-render.
    JSON.stringify(pinRows.map((p) => [p.gig.id, p.lat, p.lng, p.gig.distance_km ?? null])),
    userCoords?.lat, userCoords?.lng, maxDistanceKm,
    i18n.language, navigate, t,
  ]);

  return (
    <div
      ref={containerRef}
      className="services-map w-full rounded-3xl overflow-hidden ring-1 ring-black/5 shadow-[0_10px_40px_-15px_rgba(15,58,58,0.25)] h-[360px] sm:h-[480px] md:h-[560px] lg:h-[640px] lg:max-h-[72vh]"
      data-testid="services-map"
    />
  );
};

export default ServicesMapView;
