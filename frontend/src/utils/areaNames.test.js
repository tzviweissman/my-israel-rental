import { areaLabel } from './areaNames';

// A tiny stand-in for i18next: Hebrew city names, everything else falls back.
const he = (key, fallback) => ({ 'areas.telAviv': 'תל אביב', 'areas.jerusalem': 'ירושלים' }[key] || fallback);
const en = (key, fallback) => fallback;

test('an unknown neighbourhood keeps its city in Hebrew', () => {
  expect(areaLabel('Tel Aviv - Florentin', he)).toBe('תל אביב');
  expect(areaLabel('Tel Aviv - פלורנטין', he)).toBe('תל אביב - פלורנטין');
});

test('English and unknown cities are left as stored', () => {
  expect(areaLabel('Tel Aviv - Florentin', en)).toBe('Tel Aviv - Florentin');
  expect(areaLabel('Nowhere - Somewhere', he)).toBe('Nowhere - Somewhere');
});
