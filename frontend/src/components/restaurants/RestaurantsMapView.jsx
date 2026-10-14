/**
 * The restaurants on a map: every place matching the filters (GET
 * /restaurants/pins, not just the cards loaded in the list), one dot each on
 * the canvas so thousands stay fast. Tapping a dot opens a small card with
 * the place's photo, like Airbnb's map (Tzvi, 14 Oct 2026). Vanilla Leaflet
 * for the same reason as ServicesMapView (whose header explains the
 * StrictMode trap); map made once, pins redrawn on data.
 */
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import L from 'leaflet';
import { addBaseTiles } from '../../utils/mapTiles';
import 'leaflet/dist/leaflet.css';
import { useTranslation } from 'react-i18next';
import { API } from '../../App';
import { directionsUrl, categoryLabel } from './RestaurantCard';

const ACCENT = '#167AB8';
const ISRAEL_BOUNDS = L.latLngBounds(L.latLng(29.5, 34.2), L.latLng(33.4, 35.9));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const youIcon = () => new L.DivIcon({
  className: '', iconSize: [20, 20], iconAnchor: [10, 10],
  html: '<div style="width:20px;height:20px;border-radius:50%;background:#111827;border:3px solid #fff;box-shadow:0 0 0 2px rgba(17,24,39,.3)"></div>',
});

export default function RestaurantsMapView({ filters, userCoords, highlight, onPick }) {
  const { t, i18n } = useTranslation();
  const box = useRef(null);
  const mapRef = useRef(null);
  const layer = useRef(null);
  const dots = useRef({});
  const pick = useRef(onPick);
  pick.current = onPick;
  const [pins, setPins] = useState([]);

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

  const fkey = JSON.stringify(filters);
  useEffect(() => {
    let alive = true;
    axios.get(`${API}/restaurants/pins`, { params: filters })
      .then((r) => alive && setPins(r.data))
      .catch(() => alive && setPins([]));
    return () => { alive = false; };
  }, [fkey]); // eslint-disable-line react-hooks/exhaustive-deps

  const he = i18n.language?.startsWith('he');

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (layer.current) layer.current.remove();
    const group = L.layerGroup().addTo(map);
    layer.current = group;
    dots.current = {};
    pins.forEach((r) => {
      const name = he ? (r.name_he || r.name_en) : (r.name_en || r.name_he);
      const cats = (r.categories || []).slice(0, 2).map((c) => categoryLabel(t, c)).join(', ');
      const html = `<div style="width:220px;font-family:inherit">
        ${r.photo ? `<img src="${esc(r.photo)}" alt="" loading="lazy" style="display:block;width:100%;height:124px;object-fit:cover;border-radius:12px;background:#F3F4F6" onerror="this.remove()">` : ''}
        <div style="margin-top:${r.photo ? 8 : 0}px;font-weight:700;font-size:14px;color:#111827" dir="auto">${esc(name)}</div>
        ${cats ? `<div style="font-size:12px;color:#6b7280;margin-top:1px">${esc(cats)}</div>` : ''}
        ${r.certification ? `<div style="font-size:12px;color:#374151;margin-top:2px;font-weight:600">${esc(r.certification)}</div>` : ''}
        <a href="${esc(directionsUrl(r))}" target="_blank" rel="noopener noreferrer"
           style="display:inline-block;margin-top:6px;font-size:13px;font-weight:700;color:${ACCENT}">${esc(t('restaurants.directions', 'Directions'))}</a>
      </div>`;
      const dot = L.circleMarker([r.lat, r.lng], { radius: 7, color: '#fff', weight: 2, fillColor: ACCENT, fillOpacity: 1 })
        .bindPopup(html, { maxWidth: 240, minWidth: 220, className: 'restaurant-popup' })
        .on('click', () => pick.current && pick.current(r.id))
        .addTo(group);
      dots.current[r.id] = dot;
    });
    if (userCoords) {
      L.marker([userCoords.lat, userCoords.lng], { icon: youIcon() }).addTo(group);
      map.setView([userCoords.lat, userCoords.lng], 14);
    } else if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 14);
    } else if (pins.length) {
      map.fitBounds(L.latLngBounds(pins.map((r) => [r.lat, r.lng])), { padding: [40, 40], maxZoom: 15 });
    }
  }, [pins, he, t, userCoords]); // eslint-disable-line react-hooks/exhaustive-deps

  // The card under the pointer lights its pin: bigger and dark, on top.
  useEffect(() => {
    Object.entries(dots.current).forEach(([id, dot]) => {
      const on = id === String(highlight);
      dot.setStyle({ radius: on ? 11 : 7, fillColor: on ? '#111827' : ACCENT, weight: on ? 3 : 2 });
      if (on) dot.bringToFront();
    });
  }, [highlight, pins]);

  return (
    <div
      ref={box}
      className="h-[380px] w-full overflow-hidden rounded-2xl border sm:h-[480px] lg:h-[78vh]"
      style={{ borderColor: 'var(--brand-border)' }}
      data-testid="restaurants-map"
    />
  );
}
