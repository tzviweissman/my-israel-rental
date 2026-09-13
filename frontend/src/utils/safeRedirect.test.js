import safeRedirect from './safeRedirect';

// Built from char codes rather than escape sequences, so no tool on the way
// to disk can turn them into the raw bytes they stand for.
const NUL = String.fromCharCode(0);
const TAB = String.fromCharCode(9);
const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const DEL = String.fromCharCode(127);
const BACKSLASH = String.fromCharCode(92);

describe('safeRedirect', () => {
  test.each([
    '/property/42',
    '/businesses/abc',
    '/jobs?category=cleaning&page=2',
    '/order/g1',
    '/dashboard?tab=orders',
    // Hyphens are ordinary in this app's paths; JobsBoard sends exactly this.
    '/businesses/post-job',
    '/requests/post',
    '/sublease/a1b2-c3d4',
  ])('keeps a same-site path: %s', (path) => {
    expect(safeRedirect(path)).toBe(path);
  });

  test('keeps a space inside a path', () => {
    expect(safeRedirect('/jobs?q=deep clean')).toBe('/jobs?q=deep clean');
  });

  test('trims surrounding whitespace', () => {
    expect(safeRedirect('  /property/42 ')).toBe('/property/42');
  });

  test.each([
    ['an absolute URL', 'https://evil.example/pay'],
    ['a protocol-relative URL', '//evil.example/pay'],
    ['a backslash trick', `/${BACKSLASH}evil.example`],
    ['a javascript: URL', 'javascript:alert(1)'],
    ['a relative path', 'property/42'],
    ['a CRLF injection', `/property/42${CR}${LF}Set-Cookie: x=1`],
    ['a NUL byte', `/property/42${NUL}`],
    ['a DEL character', `/property/42${DEL}`],
    ['a tab inside the path', `/property/${TAB}42`],
    ['the login form', '/auth/login'],
    ['the auth root', '/auth'],
    ['the auth root with a query', '/auth?x=1'],
    ['an empty string', ''],
  ])('rejects %s', (_label, value) => {
    expect(safeRedirect(value)).toBeNull();
  });

  test.each([null, undefined, 42, {}, []])('rejects a non-string: %p', (value) => {
    expect(safeRedirect(value)).toBeNull();
  });

  test('does not mistake a path that merely starts with "auth" for the login form', () => {
    expect(safeRedirect('/authors/7')).toBe('/authors/7');
  });
});
