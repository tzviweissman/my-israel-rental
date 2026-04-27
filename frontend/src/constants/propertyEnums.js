// Canonical property enum values shared between the regular Add/Edit form
// and the Bulk Upload modal. These are the literal string values stored in
// the DB and rendered in PropertyDetail / Properties filters, so the two
// upload paths MUST produce identical values for the same option.

export const RENTAL_TYPES = [
  { v: 'long-term', label: 'Long-term rental' },
  { v: 'short-term', label: 'Short-term rental' },
  { v: 'vacation', label: 'Vacation / Airbnb' },
  { v: 'storage', label: 'Storage' },
];

export const PROPERTY_TYPES = [
  { v: 'apartment', label: 'Apartment' },
  { v: 'house', label: 'House' },
  { v: 'villa', label: 'Villa' },
];

export const CONDITIONS = [
  { v: 'renovated', label: 'Renovated' },
  { v: 'partially_renovated', label: 'Partially renovated' },
  { v: 'good', label: 'Good condition' },
];

export const FURNITURE_OPTIONS = [
  { v: 'no_furniture', label: 'No furniture' },
  { v: 'furniture_package', label: 'Furniture package available' },
  { v: 'furniture_free', label: 'Furniture included' },
];

export const CANCELLATION_POLICIES = [
  { v: 'flexible', label: 'Flexible — full refund 7+ days before check-in' },
  { v: 'moderate', label: 'Moderate — 50% refund 14+ days before check-in' },
  { v: 'strict', label: 'Strict — no refunds after booking' },
  { v: 'custom', label: 'Custom — write your own policy' },
];

// Same 13 amenities as the regular Add/Edit form's checkbox grid.
export const AMENITY_OPTIONS = [
  'Central AC / Heating',
  'In-unit washer and dryer',
  'Dishwasher',
  'Walk in Closets',
  'High Ceilings',
  'Ensuite Bathroom',
  'Storage Space',
  'Heated Floors',
  'Gym / Fitness center',
  'Swimming pool (indoor or outdoor)',
  'Hot tub / Spa',
  'On-site parking (garage or lot)',
  'Wi-Fi included',
];
