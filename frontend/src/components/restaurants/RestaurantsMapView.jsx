/**
 * The restaurants on a map: one pin each, the popup names it and offers
 * directions. Vanilla Leaflet for the same reason as ServicesMapView (whose
 * header explains the StrictMode trap); map made once, pins redrawn on data.
 */
import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { addBaseTiles } from '../../utils/mapTiles';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import { directionsUrl } from './RestaurantCard';

const ACCENT = '#167AB8';
const ISRAEL_BOUNDS = L.latLngBounds(L.latLng(29.5, 34.2), L.latLng(33.4, 35.9));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const pin = () => new L.DivIcon({
  className: '',
  iconSize: [26, 34],
  iconAnchor: [13, 33],
  popupAnchor: [0, -28],
  html: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 30 40" style="filter:drop-shadow(0 2px 4px rgba(15,94,143,.35))">
    <path d="M15 0C6.72 0 0 6.72 0 15c0 10.5 13.16 23.15 14.34 24.32a.94.94 0 0 0 1.32 0C16.84 38.15 30 25.5 30 15 30 6.72 23.28 0 15 0Z" fill="${ACCENT}"/>
    <circle cx="15" cy="15" r="6" fill="#fff"/></svg>`,
});

const youIcon = () => new L.DivIcon({
  className: '', iconSize: [20, 20], iconAnchor: [10, 10],
  html: '<div style="width:20px;height:20px;border-radius:50%;background:#111827;border:3px solid #fff;box-shadow:0 0 0 2px rgba(17,24,39,.3)"></div>',
});

export default function RestaurantsMapView({ items, userCoords }) {
  const { t, i18n } = useTranslation();
  const box = useRef(null);
  const mapRef = useRef(null);
  const layer = useRef(null);

  useEffect(() => {
    if (!box.current) return undefined;
    if (box.current._leaflet_id != null) delete box.current._leaflet_id;
    const map = L.map(box.current, { zoomControl: false, preferCanvas: true, zoomSnap: 0.25 });
    L.control.zoom({ position: 'topright' }).addTo(map);
    addBaseTiles(map); // see utils/mapTiles.js: CARTO now needs a key
    map.fitBounds(ISRAEL_BOUNDS);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; layer.current = null; };
  }, []);

  const he = i18n.language?.startsWith('he');
  const rows = items.filter((r) => r.lat != null);
  const key = JSON.stringify(rows.map((r) => r.id)) + (userCoords ? `${userCoords.lat},${userCoords.lng}` : '');

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layer.current) layer.current.remove();
    const group = L.layerGroup().addTo(map);
    layer.current = group;
    const pts = [];
    rows.forEach((r) => {
      const name = he ? (r.name_he || r.name_en) : (r.name_en || r.name_he);
      const html = `<div style="min-width:200px;font-family:inherit">
        <div style="font-weight:700;font-size:14px;color:#111827">${esc(name)}</div>
        ${r.certification ? `<div style="font-size:12px;color:#374151;margin-top:2px">${esc(r.certification)}</div>` : ''}
        <div style="font-size:12px;color:#6b7280;margin-top:2px">${esc([r.neighborhood, r.city].filter(Boolean).join(', '))}</div>
        <a href="${esc(directionsUrl(r))}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;margin-top:6px;font-size:13px;font-weight:700;color:${ACCENT}">${esc(t('restaurants.directions', 'Directions'))}</a>
      </div>`;
      L.marker([r.lat, r.lng], { icon: pin() }).bindPopup(html).addTo(group);
      pts.push([r.lat, r.lng]);
    });
    if (userCoords) {
      L.marker([userCoords.lat, userCoords.lng], { icon: youIcon() }).addTo(group);
      pts.push([userCoords.lat, userCoords.lng]);
    }
    if (pts.length === 1) map.setView(pts[0], 14);
    else if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 15 });
  }, [key, he, t]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={box}
      className="h-[420px] w-full overflow-hidden rounded-2xl border sm:h-[560px]"
      style={{ borderColor: 'var(--brand-border)' }}
      data-testid="restaurants-map"
    />
  );
}
