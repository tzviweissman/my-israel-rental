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

// ---------------------------------------------------------------------------
// Display labels (i18n)
//
// Everything above is the CANONICAL STORED VALUE. Those exact English strings
// are written into `property.amenities: string[]` by the host selector,
// compared with `===` / `includes()` by the Stays filter, and used as the
// membership test for ALL_PREDEFINED (anything outside it is a host's own
// free-text service and renders with a ★). Translating them in place would
// break filter matching and orphan every existing listing's amenities.
//
// So translation is a *display-only* layer: each stored string maps to a key
// under the `amenities` namespace (src/locales/en.js + src/locales/he.js) and
// every render site goes through `serviceLabel(t, value)`.
//
// Note the map is keyed by the stored string, not derived from it, so several
// stored spellings can share one label key ('WiFi included' and the legacy
// 'Wi-Fi included'; 'Hot tub / spa' and the legacy 'Hot tub / Spa').
//
// Anything with no entry here — a host's custom free-text service, or a value
// added to the catalog before its key exists — falls through to the raw
// string. That fallback is deliberate: nothing may ever render blank or as a
// bare `amenities.someKey` path.
// ---------------------------------------------------------------------------
export const SERVICE_LABEL_KEYS = {
  // Essentials
  'WiFi included': 'amenities.wifiIncluded',
  'Central AC / Heating': 'amenities.centralAcHeating',
  'Fresh linens & towels': 'amenities.freshLinensTowels',
  'Cleaning included': 'amenities.cleaningIncluded',
  'Hair dryer': 'amenities.hairDryer',
  'Iron': 'amenities.iron',
  'Hot water 24/7': 'amenities.hotWater247',
  'Extra bedding on request': 'amenities.extraBeddingOnRequest',
  'Toiletries provided': 'amenities.toiletriesProvided',
  // Kitchen & dining
  'Full kitchen': 'amenities.fullKitchen',
  'Coffee maker': 'amenities.coffeeMaker',
  'Espresso machine': 'amenities.espressoMachine',
  'Dishwasher': 'amenities.dishwasher',
  'Microwave': 'amenities.microwave',
  'Oven': 'amenities.oven',
  'Electric kettle': 'amenities.electricKettle',
  'Kosher-certified kitchen': 'amenities.kosherCertifiedKitchen',
  'Wine glasses': 'amenities.wineGlasses',
  // Family-friendly
  'Crib on request': 'amenities.cribOnRequest',
  'High chair': 'amenities.highChair',
  'Baby bath': 'amenities.babyBath',
  'Toys & books': 'amenities.toysBooks',
  'Baby monitor': 'amenities.babyMonitor',
  'Stroller available': 'amenities.strollerAvailable',
  // Home comforts
  'Smart TV': 'amenities.smartTv',
  'Netflix / streaming': 'amenities.netflixStreaming',
  'Sound system': 'amenities.soundSystem',
  'Workspace / desk': 'amenities.workspaceDesk',
  'Blackout curtains': 'amenities.blackoutCurtains',
  'Balcony / terrace': 'amenities.balconyTerrace',
  'Fireplace': 'amenities.fireplace',
  // Building & access
  'Elevator': 'amenities.elevator',
  'Ground floor': 'amenities.groundFloor',
  'Wheelchair accessible': 'amenities.wheelchairAccessible',
  'Doorman / concierge': 'amenities.doormanConcierge',
  'Shabbat elevator': 'amenities.shabbatElevator',
  'EV charging': 'amenities.evCharging',
  'On-site parking': 'amenities.onSiteParking',
  // Outdoors & wellness
  'Private pool': 'amenities.privatePool',
  'Shared pool': 'amenities.sharedPool',
  'Hot tub / spa': 'amenities.hotTubSpa',
  'Gym / fitness room': 'amenities.gymFitnessRoom',
  'Sukkah balcony': 'amenities.sukkahBalcony',
  'Private garden': 'amenities.privateGarden',
  'BBQ / grill': 'amenities.bbqGrill',
  'Rooftop access': 'amenities.rooftopAccess',
  // Location perks
  'Old City view': 'amenities.oldCityView',
  'Sea view': 'amenities.seaView',
  'Beach access': 'amenities.beachAccess',
  'Kosher restaurants nearby': 'amenities.kosherRestaurantsNearby',
  'Synagogue nearby': 'amenities.synagogueNearby',
  'Mikveh nearby': 'amenities.mikvehNearby',

  // Legacy taxonomy (constants/propertyEnums.js → AMENITY_OPTIONS). Predates
  // this catalog, is still offered by the bulk upload/edit tools, and is still
  // stored on older listings — so it needs labels too or those listings keep
  // rendering English on the property page. Four of the thirteen are just
  // different spellings of catalog entries and reuse their keys.
  'Wi-Fi included': 'amenities.wifiIncluded',
  'Hot tub / Spa': 'amenities.hotTubSpa',
  'In-unit washer and dryer': 'amenities.inUnitWasherAndDryer',
  'Walk in Closets': 'amenities.walkInClosets',
  'High Ceilings': 'amenities.highCeilings',
  'Ensuite Bathroom': 'amenities.ensuiteBathroom',
  'Storage Space': 'amenities.storageSpace',
  'Heated Floors': 'amenities.heatedFloors',
  'Gym / Fitness center': 'amenities.gymFitnessCenter',
  'Swimming pool (indoor or outdoor)': 'amenities.swimmingPoolIndoorOrOutdoor',
  'On-site parking (garage or lot)': 'amenities.onSiteParkingGarageOrLot',
};

/**
 * Translate a stored amenity string for display. Falls back to the raw string
 * when there is no key for it (host custom services, un-keyed values) or when
 * no `t` was supplied.
 *
 * @param {(key: string, defaultValue?: string) => string} t i18next `t`
 * @param {string} name stored amenity string — never mutated, never compared
 */
export const serviceLabel = (t, name) => {
  const key = SERVICE_LABEL_KEYS[name];
  if (!key || typeof t !== 'function') return name;
  return t(key, name);
};

/**
 * Translate a category header. Reuses the `stays.amenityCategory.*` keys that
 * already exist in both locales rather than duplicating the same seven strings
 * under a second namespace.
 */
export const serviceCategoryLabel = (t, category) => {
  if (!category) return '';
  if (typeof t !== 'function') return category.label;
  return t(`stays.amenityCategory.${category.slug}`, category.label);
};
