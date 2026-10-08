/**
 * The one place every map gets its background tiles from.
 *
 * Until 8 Oct 2026 the four maps each named CARTO's Voyager tiles. CARTO
 * then started requiring an API key, and every tile came back as a grey
 * square saying "API KEY REQUIRED", on Stays, Services, Requests and
 * Restaurants at once. Found while building /restaurants.
 *
 * Now: OpenStreetMap's standard tiles, which need no key. Their usage
 * policy asks for attribution (below) and for modest traffic; if the site
 * outgrows that, put a keyed provider here (CARTO's paid plan, Stadia,
 * MapTiler) and every map follows.
 */
import L from 'leaflet';

export const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

export const TILE_OPTIONS = {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  maxZoom: 19,
  keepBuffer: 4,
};

export const addBaseTiles = (map) => L.tileLayer(TILE_URL, TILE_OPTIONS).addTo(map);
