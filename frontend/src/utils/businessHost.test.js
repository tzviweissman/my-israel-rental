import {
  RESERVED_SLUGS,
  apexUrl,
  businessCanonicalUrl,
  businessPublicUrl,
  slugFromHost,
} from './businessHost';

const APEX = 'myisraelrental.com';

describe('slugFromHost', () => {
  test.each([
    ['myisraelrental.com', null],
    ['www.myisraelrental.com', null],
    ['blazinboards.myisraelrental.com', 'blazinboards'],
    // Hostnames are case-insensitive; an owner prints it however they like.
    ['BlazinBoards.MyIsraelRental.com', 'blazinboards'],
    ['blazinboards.myisraelrental.com:443', 'blazinboards'],
    ['blazinboards.myisraelrental.com.', 'blazinboards'],
    ['api.myisraelrental.com', null],
    ['a.b.myisraelrental.com', null],
    ['-bad.myisraelrental.com', null],
    ['bad-.myisraelrental.com', null],
    ['under_score.myisraelrental.com', null],
    // Client-supplied, so a lookalike must not match.
    ['myisraelrental.com.evil.com', null],
    ['blazinboards.otherdomain.com', null],
    ['localhost:3000', null],
    ['', null],
    [undefined, null],
  ])('%s -> %s', (host, expected) => {
    expect(slugFromHost(host, APEX)).toBe(expected);
  });

  test('a 61-character label is not an address', () => {
    expect(slugFromHost(`${'a'.repeat(61)}.${APEX}`, APEX)).toBeNull();
    expect(slugFromHost(`${'a'.repeat(60)}.${APEX}`, APEX)).toBe('a'.repeat(60));
  });

  test('every reserved word is refused as a host', () => {
    RESERVED_SLUGS.forEach((w) => expect(slugFromHost(`${w}.${APEX}`, APEX)).toBeNull());
  });
});

describe('addresses and canonical URLs', () => {
  test('share link is the subdomain only when switched on', () => {
    expect(businessPublicUrl('cohen-movers', 'id1', { subdomains: true, apex: APEX })).toBe('https://cohen-movers.myisraelrental.com');
    expect(businessPublicUrl('cohen-movers', 'id1', { subdomains: false, apex: APEX, origin: 'https://myisraelrental.com' }))
      .toBe('https://myisraelrental.com/business/cohen-movers');
  });

  test('a business with no usable slug falls back to the path by id', () => {
    expect(businessPublicUrl(null, 'id1', { subdomains: true, apex: APEX, origin: 'https://myisraelrental.com' }))
      .toBe('https://myisraelrental.com/business/id1');
  });

  test('canonical follows the flag, path by default', () => {
    expect(businessCanonicalUrl('cohen-movers', 'id1', { mode: 'path', apex: APEX })).toBe('https://myisraelrental.com/business/cohen-movers');
    expect(businessCanonicalUrl('cohen-movers', 'id1', { mode: 'subdomain', apex: APEX })).toBe('https://cohen-movers.myisraelrental.com/');
  });

  test('apexUrl keeps the path and query', () => {
    expect(apexUrl('/businesses/123?src=x', APEX)).toBe('https://myisraelrental.com/businesses/123?src=x');
  });
});
