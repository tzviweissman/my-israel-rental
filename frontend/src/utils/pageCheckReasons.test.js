import { plainReasons } from './pageCheckReasons';

const t = (key, fallback) => fallback;

test('the check\'s own terms become the owner\'s, once each', () => {
  const out = plainReasons([
    'he-390: hero text too faint on what is behind it: "Dev Owner Bakery" 2.4:1',
    'en-360: hero text fainter than without effects: "x" 2.1:1',
    'en-360: sideways scroll 14px',
  ], t);
  expect(out).toEqual([
    'Some text is hard to read over the picture',
    'Part of the page spills off the side of a phone screen',
  ]);
  expect(out.join(' ')).not.toMatch(/:1|px|en-|he-/);
});

test('an expired link and an unknown finding still say something plain', () => {
  expect(plainReasons(['The preview link did not open this version (expired, or the page is switched off)'], t))
    .toEqual(['The check could not open this version. Check it again.']);
  expect(plainReasons(['something new the check learned to look for'], t))
    .toEqual(['Something did not look right on one screen size']);
  expect(plainReasons(undefined, t)).toEqual([]);
});

test('a page that became too close says so plainly', () => {
  expect(plainReasons(['This version is too much like another page that went live since it was made (too close to a recent live page)'], t))
    .toEqual(['A page that went live since this was made looks too much like it. Make new versions.']);
});
