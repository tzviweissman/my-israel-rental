/**
 * Per-category visual theme for the Services Marketplace hub.
 *
 * Mirrors Fiverr's tall-card "Popular services" carousel — each card has
 * a dark solid header (with the category name in white) sitting above a
 * pastel body with a category-representative photo.
 *
 * Colors are picked to feel intentional as a set (not a rainbow) —
 * warm/earthy for hands-on trades, cool/pastel for creative and
 * professional services, so the row reads coherently at a glance.
 *
 * Images are stable Unsplash CDN URLs served with `f=auto&q=70&w=400`
 * for fast card thumbnails.
 */
const un = (id) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=520&q=75`;

const CATEGORY_THEME = {
  cleaning: {
    header: '#0F3A3A', body: '#CFE6DE',
    image: un('photo-1581578731548-c64695cc6952'),
  },
  moving: {
    header: '#5A3720', body: '#F3D7B5',
    icon: 'Truck', iconColor: '#5A3720',
  },
  locksmith: {
    header: '#3B2312', body: '#EDCBA6',
    icon: 'Key', iconColor: '#3B2312',
  },
  handyman: {
    header: '#402A16', body: '#EDCFA4',
    image: un('photo-1504148455328-c376907d081c'),
  },
  photography: {
    header: '#1A1A1A', body: '#EAE3D7',
    image: un('photo-1502920917128-1aa500764cbd'),
  },
  'interior-design': {
    header: '#5D3C2A', body: '#F0CFA8',
    image: un('photo-1618221195710-dd6b41faaea6'),
  },
  'tour-guide': {
    header: '#3E5A2A', body: '#DCE9B8',
    icon: 'Map', iconColor: '#3E5A2A',
  },
  'furniture-assembly': {
    header: '#2A3A4A', body: '#CFDBE7',
    image: un('photo-1555041469-a586c61ea9bc'),
  },
  barber: {
    header: '#1E2A38', body: '#D8CDBF',
    image: un('photo-1503951914875-452162b0f3f1'),
  },
  'ac-cleaner': {
    header: '#134256', body: '#C6DFEE',
    icon: 'Wind', iconColor: '#134256',
  },
  plumber: {
    header: '#22405C', body: '#C6D6E6',
    image: un('photo-1585704032915-c3400ca199e7'),
  },
  electrician: {
    header: '#4A3714', body: '#F1D68A',
    image: un('photo-1621905251189-08b45d6a269e'),
  },
};

// Neutral fallback so a new category from the backend still renders
// something reasonable even before we add a bespoke theme.
export const DEFAULT_THEME = {
  header: '#1E6A6A', body: '#E7EEE9',
  image: un('photo-1497366216548-37526070297c'),
};

export const themeForCategory = (slug) => CATEGORY_THEME[slug] || DEFAULT_THEME;
