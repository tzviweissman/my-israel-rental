import { kindOf, hoursLine } from './FillForMe';

jest.mock('react-router-dom', () => ({ useNavigate: () => () => {} }));
jest.mock('../../App', () => ({ API: '', AuthContext: require('react').createContext({}) }));

test('what was typed picks the right reader', () => {
  expect(kindOf('@noa.leather')).toBe('instagram');
  expect(kindOf('https://www.instagram.com/noa/')).toBe('instagram');
  expect(kindOf('facebook.com/noa')).toBe('facebook');
  expect(kindOf('tiktok.com/@noa')).toBe('tiktok');
  expect(kindOf('noaleather.co.il')).toBe('website');
  expect(kindOf('Noa Leather Jerusalem')).toBe('name');
  expect(kindOf('  ')).toBe(null);
});

test('Google hours become one line, Sunday first', () => {
  const line = hoursLine({ mon: [{ start: '09:00', end: '17:00' }], sun: [{ start: '10:00', end: '14:00' }], sat: [] }, (d) => d);
  expect(line).toBe('sun 10:00-14:00 · mon 09:00-17:00');
  expect(hoursLine(null, (d) => d)).toBe('');
});
