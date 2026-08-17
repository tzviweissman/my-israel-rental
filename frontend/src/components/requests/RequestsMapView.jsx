/**
 * Requests map — demand and supply plotted on the same map (C5).
 *
 * This is the view an owner working one neighbourhood actually wants: not
 * "here is everything people want anywhere in Israel", but "here is what
 * is happening on my streets". A list cannot answer that question; a map
 * answers it before you read a word.
 *
 * Modelled on StaysMapView rather than reusing it. That component is built
 * around price pins — priceIcon, priceLabel, displayCurrency, premium
 * styling — and a request has no price to show, so reusing it would mean
 * either fake prices or gutting a component the Stays page depends on. The
 * Leaflet lifecycle handling below is copied deliberately, including the
 * reason for it:
 *
 * Vanilla Leaflet, not react-leaflet — its MapContainer breaks under React
 * 18 StrictMode's double-invoke lifecycle. Managing the map by hand with
 * an explicit `map.remove()` on cleanup behaves however many times React
 * decides to run the effect.
 *
 * Pins are coloured by SIDE, not by rental-vs-service: someone scanning
 * this map is either looking for supply or looking for demand, and that is
 * the cut that decides whether a pin is worth clicking.
 */
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

// Israel-centric fallback so an empty map opens on-country rather than in
// the middle of the Atlantic.
const ISRAEL_BOUNDS = L.latLngBounds(L.latLng(29.5, 34.2), L.latLng(33.4, 35.9));

// Popups take raw HTML, and every string in one of these is user-written.
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const pin = (isOffer, label) => new L.DivIcon({
  className: '',
  html: `<span style="
    display:inline-flex;align-items:center;gap:5px;
    background:${isOffer ? 'var(--ink)' : '#fff'};
    color:${isOffer ? '#fff' : 'var(--ink)'};
    border:1.5px solid ${isOffer ? 'var(--ink)' : 'var(--brand-border)'};
    border-radius:999px;padding:5px 10px;
    font:700 11px/1 Manrope,system-ui,sans-serif;white-space:nowrap;
    box-shadow:0 3px 10px rgba(0,0,0,.18);
  ">${esc(label)}</span>`,
  iconSize: [0, 0],
  iconAnchor: [0, 0],
});

// Geocoding an area gives the CENTRE of that area, so every post in the
// same neighbourhood lands on the identical point and all but the top one
// become unclickable — a board of twelve reads as a board of two. Nudging
// exact collisions apart in a small ring is the standard answer and is
// honest at this zoom: the pin was never the building, only the
// neighbourhood, and the ring is smaller than the neighbourhood.
const spread = (rows) => {
  const seen = new Map();
  return rows.map((r) => {
    const key = `${r.lat.toFixed(4)},${r.lng.toFixed(4)}`;
    const n = seen.get(key) || 0;
    seen.set(key, n + 1);
    if (n === 0) return r;
    const angle = (n * 2.399963); // golden angle, so the ring fills evenly
    const radius = 0.0016 * Math.ceil(n / 6); // ~180m per ring
    return {
      ...r,
      lat: r.lat + radius * Math.cos(angle),
      lng: r.lng + radius * Math.sin(angle),
    };
  });
};

// "Ramat Eshkol" tells a reader where they are; "Request" tells them what
// they could already see from the pin's colour.
const pinLabel = (area) => {
  const s = String(area || '').trim();
  if (!s) return '•';
  const parts = s.split(' - ');
  return (parts[1] || parts[0]).slice(0, 22);
};

const RequestsMapView = ({ requests, activeId, onPinClick }) => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const hostRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  // Held in a ref so the pin effect can call the latest handler without
  // listing it as a dependency and rebuilding every marker on each render.
  const onPinClickRef = useRef(onPinClick);
  onPinClickRef.current = onPinClick;

  const pinRows = spread((requests || []).filter(
    (r) => typeof r.lat === 'number' && typeof r.lng === 'number',
  ));

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return undefined;
    const map = L.map(hostRef.current, { scrollWheelZoom: false, zoomControl: true });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      maxZoom: 19,
    }).addTo(map);
    map.fitBounds(ISRAEL_BOUNDS);
    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;
    // Leaflet caches the container size at construction. This map is
    // created inside a tab that has just been switched to, so that
    // measurement can be of a box that had no height yet — and fitBounds
    // against a stale size puts every pin outside the visible frame while
    // reporting success. Re-measure before fitting.
    map.invalidateSize();
    group.clearLayers();

    const points = [];
    pinRows.forEach((r) => {
      const isOffer = r.post_kind === 'have';
      const marker = L.marker([r.lat, r.lng], { icon: pin(isOffer, pinLabel(r.area)) }).addTo(group);
      marker.bindPopup(
        `<div style="font:600 13px/1.35 Manrope,system-ui,sans-serif;max-width:220px">
           <div style="font-weight:700;margin-bottom:3px">${esc(r.title)}</div>
           <div style="color:#6B6459;font-weight:500">${esc(r.area || '')}</div>
           <div style="color:#6B6459;font-weight:600;margin-top:4px;font-size:11px;text-transform:uppercase;letter-spacing:.04em">${
             isOffer ? esc(t('requests.badgeHave', 'Post')) : esc(t('requests.badgeWant', 'Request'))
           }</div>
         </div>`,
      );
      marker.on('click', () => {
        if (onPinClickRef.current) onPinClickRef.current(r.id);
      });
      marker.on('dblclick', () => navigate(`/requests/${r.id}`));
      points.push([r.lat, r.lng]);
    });

    if (points.length) {
      map.fitBounds(L.latLngBounds(points.map(([la, ln]) => L.latLng(la, ln))), {
        padding: [40, 40],
        maxZoom: 15,
      });
    } else {
      map.fitBounds(ISRAEL_BOUNDS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pinRows.map((r) => [r.id, r.lat, r.lng, r.post_kind, r.area])), t]);

  // Everything with coordinates is drawn; anything without is not, and
  // saying so is the difference between "no demand here" and "we could not
  // place three of these". Silence would be read as the former.
  const missing = (requests || []).length - pinRows.length;

  return (
    <div data-testid="requests-map-view">
      <div
        ref={hostRef}
        className="w-full rounded-2xl border overflow-hidden"
        style={{ height: 'min(70vh, 560px)', borderColor: 'var(--brand-border)' }}
      />
      {missing > 0 && (
        <p className="mt-2 text-xs" style={{ color: 'var(--brand-muted)' }} data-testid="requests-map-missing">
          {t('requests.mapMissing', '{{n}} not shown — we could not place their area on the map.', { n: missing })}
        </p>
      )}
      {activeId && null}
    </div>
  );
};

export default RequestsMapView;
