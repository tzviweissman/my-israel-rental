/**
 * Where Google sign-in sends people.
 *
 * THE BUG (dead-ends audits, 10 and 12 Sep 2026): every gated route sends a
 * visitor to sign in with ?redirect= back to what they were doing — message an
 * owner, apply for a job, finish an order. The email form honoured it. The
 * Google button routed by role alone, so anyone who chose Google landed on
 * their dashboard and lost the page they came from, with no error.
 *
 * These pin the routing to the same rules as the email path in pages/Auth.js.
 * The GIS popup itself cannot run under Jest; useGoogleSignIn's only job here
 * is to read `redirect` off the URL and hand it in, which is what
 * `redirectTo` stands for below.
 */
jest.mock('axios', () => ({ post: jest.fn(), put: jest.fn() }));
jest.mock('../../App', () => ({ API: '/api' }));
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock('i18next', () => ({ t: (key, opts) => (opts && opts.defaultValue) || key }));

import axios from 'axios';
import completeGoogleSignIn, { SIGNUP_INTENT_ROLE_KEY } from './completeGoogleSignIn';

const signIn = async ({ role, redirectTo, intent }) => {
  axios.post.mockResolvedValue({ data: { token: 't1', user: { name: 'Dani', email: 'd@x.test', role } } });
  if (intent) {
    sessionStorage.setItem(SIGNUP_INTENT_ROLE_KEY, intent);
    axios.put.mockResolvedValue({ data: { token: 't2', user: { name: 'Dani', email: 'd@x.test', role: intent } } });
  }
  const login = jest.fn();
  const navigate = jest.fn();
  await completeGoogleSignIn('google-access-token', login, navigate, redirectTo);
  return { login, navigate };
};

beforeEach(() => {
  jest.clearAllMocks();
  sessionStorage.clear();
  localStorage.clear();
});

describe('Google sign-in honours ?redirect=', () => {
  test('a renter goes back to the page they came from', async () => {
    const { navigate } = await signIn({ role: 'renter', redirectTo: '/property/42' });
    expect(navigate).toHaveBeenCalledWith('/property/42', { replace: true });
  });

  test('the query string survives, so a filtered board is not reset', async () => {
    const { navigate } = await signIn({ role: 'renter', redirectTo: '/jobs?category=cleaning&page=2' });
    expect(navigate).toHaveBeenCalledWith('/jobs?category=cleaning&page=2', { replace: true });
  });

  test('an owner and an admin are sent back too, not to their dashboards', async () => {
    const owner = await signIn({ role: 'owner', redirectTo: '/order/g1' });
    expect(owner.navigate).toHaveBeenCalledWith('/order/g1', { replace: true });
    const admin = await signIn({ role: 'admin', redirectTo: '/businesses/abc' });
    expect(admin.navigate).toHaveBeenCalledWith('/businesses/abc', { replace: true });
  });

  test('an off-site redirect is ignored and the visitor lands on the dashboard', async () => {
    const { navigate } = await signIn({ role: 'renter', redirectTo: '//evil.example/pay' });
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
    expect(navigate).not.toHaveBeenCalledWith(expect.stringContaining('evil'), expect.anything());
  });

  test('a redirect back to the login form is ignored rather than looping', async () => {
    const { navigate } = await signIn({ role: 'renter', redirectTo: '/auth/login' });
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  test('a brand-new business still goes to onboarding, as it does by email', async () => {
    const { navigate } = await signIn({ role: 'renter', intent: 'provider', redirectTo: '/property/42' });
    expect(navigate).toHaveBeenCalledWith('/businesses/add?welcome=1', { replace: true });
  });
});

describe('with no redirect, routing is unchanged except admins', () => {
  test('a renter lands on the dashboard', async () => {
    const { navigate } = await signIn({ role: 'renter' });
    expect(navigate).toHaveBeenCalledWith('/dashboard', { replace: true });
  });

  test('an owner lands on the welcome dashboard', async () => {
    const { navigate } = await signIn({ role: 'owner' });
    expect(navigate).toHaveBeenCalledWith('/dashboard?welcome=1', { replace: true });
  });

  test('a provider lands on the business wizard', async () => {
    const { navigate } = await signIn({ role: 'provider' });
    expect(navigate).toHaveBeenCalledWith('/businesses/add?welcome=1', { replace: true });
  });

  test('an admin lands on /admin, matching the email path', async () => {
    const { navigate } = await signIn({ role: 'admin' });
    expect(navigate).toHaveBeenCalledWith('/admin', { replace: true });
  });
});

test('signs the visitor in before navigating', async () => {
  const { login, navigate } = await signIn({ role: 'renter', redirectTo: '/property/42' });
  expect(login).toHaveBeenCalledWith('t1', expect.objectContaining({ role: 'renter' }));
  expect(login.mock.invocationCallOrder[0]).toBeLessThan(navigate.mock.invocationCallOrder[0]);
});
