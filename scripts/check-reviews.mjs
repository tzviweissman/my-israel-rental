// Verified reviews, end to end in a browser (backend routes/reviews.py).
//
// Needs: local API on :8001 started with the review flags ON (the
// "backend-reviews-on" entry in .claude/launch.json), the dev server on
// :3210, and backend/tests/.env.test for the admin account.
//   Run: node scripts/check-reviews.mjs
//
// 1. a guest writes a review from the emailed link on a phone, and the
//    link then refuses a second use;
// 2. a signed-in visitor reports it: it stays on the page, under review;
// 3. the server refuses to remove it as "negative";
// 4. an admin removes it for a listed reason from the queue, and it is
//    gone from the page.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const API = 'http://localhost:8001/api';
const WEB = 'http://localhost:3210';
const env = Object.fromEntries(readFileSync('backend/tests/.env.test', 'utf8').split(/\r?\n/)
  .filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]));

const seeded = execFileSync('.venv/Scripts/python.exe', ['-m', 'scripts.seed_reviews_dev'], { cwd: 'backend' }).toString();
const token = seeded.match(/form:\s+\/review\/(\S+)/)[1];
const PROP = 'seed-reviews-prop';
const TEXT = 'Checked in late and the key box code worked first time. Clean, quiet, as shown.';

const failures = [];
const expect = (cond, msg) => { if (!cond) failures.push(msg); };
const reviews = async () => (await fetch(`${API}/listings/${PROP}/reviews`).then((r) => r.json()));
const admin = (await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.TEST_ADMIN_EMAIL, password: env.TEST_ADMIN_PASSWORD }) }).then((r) => r.json())).token;

const b = await chromium.launch();
const fresh = async (width = 375) => (await b.newContext({ viewport: { width, height: 900 } })).newPage();

// 1. The emailed link, on a phone, no sign-in.
let page = await fresh();
await page.goto(`${WEB}/review/${token}`, { waitUntil: 'networkidle' });
await page.click('[data-testid=write-review-star-4]');
await page.fill('[data-testid=write-review-text]', TEXT);
await page.click('[data-testid=write-review-submit]');
await page.waitForSelector('[data-testid=write-review-done]', { timeout: 10000 }).catch(() => {});
expect(await page.$('[data-testid=write-review-done]'), 'form: the review did not post');
let data = await reviews();
const mine = data.reviews.find((r) => r.text === TEXT);
expect(mine && mine.verified && mine.rating === 4 && mine.author_display_name === 'Noa P.', 'form: posted review missing or wrong');
expect(data.summary.native.count === 4, `summary: expected 4 verified stays, got ${data.summary.native?.count}`);
await page.goto(`${WEB}/review/${token}`, { waitUntil: 'networkidle' });
expect(await page.$('[data-testid=write-review-closed]'), 'link: a used link still showed the form');

// 2. A signed-in visitor reports it; it stays up, under review.
page = await fresh();
await page.goto(`${WEB}/property/${PROP}?as=renter`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const card = page.locator('[data-testid=review-card]', { hasText: 'key box' });
await card.locator('[data-testid=review-report]').click();
await card.locator('[data-testid=review-report-reason]').selectOption('spam');
await card.locator('[data-testid=review-report-send]').click();
await page.waitForTimeout(1200);
data = await reviews();
expect(data.reviews.find((r) => r.id === mine.id)?.status === 'under_review', 'report: review not under review, or no longer shown');

// 3. "Negative" is never a reason.
const neg = await fetch(`${API}/admin/reviews/${mine.id}/remove`, { method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin}` }, body: JSON.stringify({ reason: 'negative' }) });
expect(neg.status === 422, `moderation: removing as "negative" answered ${neg.status}, expected 422`);

// 4. The admin queue removes it for a listed reason.
page = await fresh(1280);
await page.goto(`${WEB}/admin?as=admin`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.click('[data-testid=admin-tab-reviews]');
const item = page.locator('[data-testid=admin-review-item]', { hasText: 'key box' });
await item.waitFor({ timeout: 10000 }).catch(() => {});
expect(await item.count(), 'queue: the reported review is not in the admin queue');
if (await item.count()) {
  expect(await item.locator('[data-testid=admin-review-remove]').isDisabled(), 'queue: Remove was allowed without a reason');
  await item.locator('[data-testid=admin-review-reason]').selectOption('spam');
  await item.locator('[data-testid=admin-review-remove]').click();
  await page.waitForTimeout(1200);
}
data = await reviews();
expect(!data.reviews.some((r) => r.id === mine.id) && data.summary.native.count === 3, 'queue: removed review still on the page');

await b.close();
execFileSync('.venv/Scripts/python.exe', ['-m', 'scripts.seed_reviews_dev', '--clean'], { cwd: 'backend' });
if (failures.length) { console.error('FAIL\n  ' + failures.join('\n  ')); process.exit(1); }
console.log('PASS  link review posted once; report keeps it up under review; "negative" refused; admin removal for a listed reason');
