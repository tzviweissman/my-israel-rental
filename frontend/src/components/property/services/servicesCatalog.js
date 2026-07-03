/**
 * Property services catalog — frontend-only source of truth.
 *
 * We keep the whole taxonomy in one small module so the PropertyServicesSelector,
 * the PropertyDetail amenity renderer, and the Stays search filter all agree on
 * (a) which strings are "predefined" (vs custom free-text hosts type in),
 * (b) which category each predefined string belongs to, and
 * (c) which smart-defaults to auto-select for a given rental type.
 *
 * Storage stays a flat `amenities: string[]` on the property doc — anything
 * not in ALL_PREDEFINED is treated as a custom service and rendered with a ★.
 * That means zero backend migration for existing listings.
 */

export const SERVICE_CATEGORIES = [
  {
    slug: 'essentials',
    label: 'Essentials',
    icon: 'Sparkles',
    services: [
      'WiFi included',
      'Central AC / Heating',
      'Fresh linens & towels',
      'Cleaning included',
      'Hair dryer',
      'Iron',
      'Hot water 24/7',
      'Extra bedding on request',
      'Toiletries provided',
    ],
  },
  {
    slug: 'kitchen',
    label: 'Kitchen & dining',
    icon: 'CookingPot',
    services: [
      'Full kitchen',
      'Coffee maker',
      'Espresso machine',
      'Dishwasher',
      'Microwave',
      'Oven',
      'Electric kettle',
      'Kosher-certified kitchen',
      'Wine glasses',
    ],
  },
  {
    slug: 'family',
    label: 'Family-friendly',
    icon: 'Baby',
    services: [
      'Crib on request',
      'High chair',
      'Baby bath',
      'Toys & books',
      'Baby monitor',
      'Stroller available',
    ],
  },
  {
    slug: 'comforts',
    label: 'Home comforts',
    icon: 'Tv',
    services: [
      'Smart TV',
      'Netflix / streaming',
      'Sound system',
      'Workspace / desk',
      'Blackout curtains',
      'Balcony / terrace',
      'Fireplace',
    ],
  },
  {
    slug: 'access',
    label: 'Building & access',
    icon: 'Building2',
    services: [
      'Elevator',
      'Ground floor',
      'Wheelchair accessible',
      'Doorman / concierge',
      'Shabbat elevator',
      'EV charging',
      'On-site parking',
    ],
  },
  {
    slug: 'outdoor',
    label: 'Outdoors & wellness',
    icon: 'Waves',
    services: [
      'Private pool',
      'Shared pool',
      'Hot tub / spa',
      'Gym / fitness room',
      'Sukkah balcony',
      'Private garden',
      'BBQ / grill',
      'Rooftop access',
    ],
  },
  {
    slug: 'location',
    label: 'Location perks',
    icon: 'MapPin',
    services: [
      'Old City view',
      'Sea view',
      'Beach access',
      'Kosher restaurants nearby',
      'Synagogue nearby',
      'Mikveh nearby',
    ],
  },
];

// Fast reverse lookup used by the selector (chip badge) and PropertyDetail
// renderer (star icon for custom services).
export const CATEGORY_BY_SERVICE = SERVICE_CATEGORIES.reduce((acc, c) => {
  c.services.forEach((s) => { acc[s] = c; });
  return acc;
}, {});

export const ALL_PREDEFINED = new Set(Object.keys(CATEGORY_BY_SERVICE));

export const isCustomService = (name) => !ALL_PREDEFINED.has(name);

// Smart defaults auto-selected the first time a host opens the selector on a
// new listing. Existing edits (when a host is editing an already-saved
// property) never trigger this — we detect that via a `firstEdit` flag on
// the parent form.
export const SMART_DEFAULTS = {
  vacation: ['WiFi included', 'Central AC / Heating', 'Fresh linens & towels', 'Cleaning included', 'Coffee maker'],
  'short-term': ['WiFi included', 'Central AC / Heating', 'Full kitchen', 'Fresh linens & towels'],
  'long-term': ['WiFi included', 'Central AC / Heating', 'Full kitchen', 'Elevator'],
};

// Holiday-window auto-additions. Merged on top of the rental-type default
// when the property is tagged with the corresponding holiday_context.
export const HOLIDAY_DEFAULTS = {
  sukkot: ['Sukkah balcony'],
  pesach: ['Kosher-certified kitchen'],
};

export const defaultServicesFor = (rentalType, holidayContext) => {
  const base = SMART_DEFAULTS[rentalType] || SMART_DEFAULTS['short-term'];
  const holiday = HOLIDAY_DEFAULTS[holidayContext] || [];
  return Array.from(new Set([...base, ...holiday]));
};
