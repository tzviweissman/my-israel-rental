/**
 * Person-to-person items work end to end, and the safety ships with them.
 *
 * The unit tests (backend/tests/test_items_and_moderation.py) pin the
 * models, the filters and the wiring. This drives the actual API and the
 * actual pages, because those tests deliberately avoid a database and so
 * cannot answer the question that matters: can somebody post a sofa,
 * have it appear, mark it sold, and have it leave the board.
 *
 * The N6 half is checked here too, because "we built the protections"
 * and "the protections are reachable" are different claims:
 *
 *   * the safety line appears on the post AND on the form — the moment to
 *     read it is before you arrange to meet a stranger
 *   * nothing anywhere offers escrow, buyer protection, or says we handle
 *     the money. We could not honour any of it
 *   * the daily posting cap actually refuses
 *   * a sold item stays reachable by link. A buyer who arrives late is
 *     better served by "sold" than by a 404
 *
 * Usage: node scripts/check-items-end-to-end.mjs
 *   APP_ORIGIN / API_ORIGIN override the defaults.
 */
import { chromium } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const API = process.env.API_ORIGIN || 'http://localhost:8001/api';
const HEBREW = /[֐-׿]/;

const failures = [];
const note = (m) => console.log('  ' + m);

const rnd = () => Math.random().toString(36).slice(2, 10);

const api = async (path, { method = 'GET', body, token } = {}) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  return { status: res.status, data };
};

const newItem = (over = {}) => ({
  request_type: 'item',
  post_kind: 'have',
  title: `Sofa for sale ${rnd()}`,
  description: 'Three seats, grey fabric, four years old. Collection from Katamon.',
  area: 'Jerusalem',
  condition: 'good',
  budget_type: 'fixed',
  budget_amount: 400,
  budget_currency: 'ILS',
  pickup_area: 'Katamon, near the shuk',
  ...over,
});

// ---- a signed-in poster ---------------------------------------------
const reg = await api('/auth/register', {
  method: 'POST',
  body: {
    email: `items-${rnd()}@example.com`,
    password: `It!${rnd()}`,
    name: 'Item Check',
    role: 'renter',
  },
});
if (reg.status !== 200) {
  console.error('could not register a test user:', reg.status, reg.data);
  process.exit(1);
}
const token = reg.data.token || reg.data.access_token;

// A SECOND account. The seller sees owner controls; the report button and
// the contact flow only exist for somebody else, so checking them while
// signed in as the poster proves nothing.
const reg2 = await api('/auth/register', {
  method: 'POST',
  body: {
    email: `buyer-${rnd()}@example.com`,
    password: `Bu!${rnd()}`,
    name: 'Buyer Check',
    role: 'renter',
  },
});
const buyerToken = reg2.data?.token || reg2.data?.access_token;
if (!buyerToken) failures.push('could not register a second user to view the item as a buyer');

// ---- 1. post one -----------------------------------------------------
const created = await api('/marketplace/requests', { method: 'POST', body: newItem(), token });
note(`post an item -> ${created.status}`);
if (created.status !== 200) {
  failures.push(`could not post an item: ${created.status} ${JSON.stringify(created.data).slice(0, 200)}`);
}
const itemId = created.data?.id;

if (itemId) {
  // The moderation flag must not travel to the client.
  for (const leaked of ['needs_review', 'report_count', 'reported_by', 'hidden_by_admin', 'whatsapp']) {
    if (leaked in (created.data || {})) failures.push(`the API returned "${leaked}" on a public item`);
  }
  if (created.data.item_status !== 'available') {
    failures.push(`a new item is "${created.data.item_status}", not "available"`);
  }

  // ---- 2. it appears on the board ------------------------------------
  const board = await api('/marketplace/requests?request_type=item&limit=200');
  const onBoard = (board.data || []).some((r) => r.id === itemId);
  note(`on the board: ${onBoard}`);
  if (!onBoard) failures.push('a posted item does not appear on the items board');

  // ---- 3. filters ----------------------------------------------------
  const byCondition = await api('/marketplace/requests?request_type=item&condition=good&limit=200');
  if (!(byCondition.data || []).some((r) => r.id === itemId)) {
    failures.push('condition=good did not return an item whose condition is good');
  }
  const tooCheap = await api('/marketplace/requests?request_type=item&max_price=100&limit=200');
  if ((tooCheap.data || []).some((r) => r.id === itemId)) {
    failures.push('a ₪400 item came back under a ₪100 ceiling');
  }
  note(`filters: condition ok, price ceiling ok`);

  // ---- 4. sold -------------------------------------------------------
  const sold = await api(`/marketplace/requests/${itemId}/sold`, {
    method: 'POST', body: { sold: true }, token,
  });
  note(`mark sold -> ${sold.status} (item_status=${sold.data?.item_status}, status=${sold.data?.status})`);
  if (sold.status !== 200) failures.push(`could not mark sold: ${sold.status}`);
  if (sold.data?.status !== 'open') {
    failures.push(`marking sold changed the POST's status to "${sold.data?.status}" — sold must not close the post`);
  }

  const afterSold = await api('/marketplace/requests?request_type=item&limit=200');
  if ((afterSold.data || []).some((r) => r.id === itemId)) {
    failures.push('a sold item is still in the default board view');
  }
  const withSold = await api('/marketplace/requests?request_type=item&include_sold=true&limit=200');
  if (!(withSold.data || []).some((r) => r.id === itemId)) {
    failures.push('include_sold=true does not return sold items');
  }
  // The link still resolves — this is the whole reason sold is not a delete.
  const direct = await api(`/marketplace/requests/${itemId}`);
  note(`sold item still resolves by link: ${direct.status === 200}`);
  if (direct.status !== 200) {
    failures.push(`a sold item 404s by direct link (${direct.status}) — a late buyer should read "sold"`);
  }

  // ---- 5. and back on sale -------------------------------------------
  const unsold = await api(`/marketplace/requests/${itemId}/sold`, {
    method: 'POST', body: { sold: false }, token,
  });
  if (unsold.data?.item_status !== 'available') {
    failures.push('sold is not reversible — a sale that falls through cannot be undone');
  }
}

// ---- 6. the daily cap actually refuses -------------------------------
//
// A brand-new account, so the low tier applies. This has to WAIT between
// posts: there is also a 20-second per-user cooldown, and a tight loop
// only ever measures that one — which is how a first run of this check
// reported the daily cap as working when it had never been reached.
const COOLDOWN_MS = 21_000;
let refusedAt = null;
let posted = 1;                       // the item above
for (let i = 0; i < 6; i += 1) {
  await new Promise((r) => setTimeout(r, COOLDOWN_MS));
  const r = await api('/marketplace/requests', { method: 'POST', body: newItem(), token });
  if (r.status === 200) { posted += 1; continue; }
  if (/items in a day/i.test(JSON.stringify(r.data))) { refusedAt = posted; break; }
  failures.push(`unexpected refusal while testing the cap: ${r.status} ${JSON.stringify(r.data).slice(0, 160)}`);
  break;
}
note(`daily cap refused after ${refusedAt ?? 'never'} item(s) (new-account tier)`);
if (!refusedAt) {
  failures.push('the daily item cap never refused — a throwaway account can post without limit');
}

// ---- 7. the pages ----------------------------------------------------
const browser = await chromium.launch();
try {
  for (const lang of ['en', 'he']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    // As the BUYER, not the seller.
    await ctx.addInitScript((t) => {
      try { sessionStorage.setItem('token', t); } catch { /* private mode */ }
    }, buyerToken);
    if (lang === 'he') {
      await ctx.addInitScript(() => {
        try { localStorage.setItem('i18nextLng', 'he'); } catch { /* private mode */ }
      });
    }
    const page = await ctx.newPage();

    if (itemId) {
      await page.goto(`${APP}/requests/${itemId}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.locator('[data-testid="request-detail-page"]').waitFor({ timeout: 30000 });
      await page.waitForTimeout(1500);

      const safety = page.locator('[data-testid="request-item-safety"]');
      const shown = await safety.count();
      const text = shown ? (await safety.first().innerText()).replace(/\s+/g, ' ') : '';
      note(`${lang}: safety note on the item -> ${shown > 0} ${JSON.stringify(text.slice(0, 60))}`);
      if (!shown) failures.push(`${lang}: an item carries no safety note`);
      else if (lang === 'he' && !HEBREW.test(text)) {
        failures.push('he: the safety note renders in English — the person who needs it cannot read it');
      }

      // The item must not be BADGED as something else. The detail page
      // branched `isRental ? Rental : Service`, so an item was labelled
      // SERVICE with a wrench — a two-way branch on a three-way
      // question, and invisible to every assertion here until one
      // looked at the badge.
      const badges = await page.locator('.rc-badge').evaluateAll(
        (els) => els.map((e) => e.textContent.trim()).filter(Boolean),
      );
      note(`${lang}: badges -> ${JSON.stringify(badges)}`);
      const wrongBadge = badges.find((b) => /service|rental|שירות|השכרה/i.test(b));
      if (wrongBadge) {
        failures.push(`${lang}: an item is badged "${wrongBadge}" — it is neither a service nor a rental`);
      }
      if (!badges.some((b) => /item|פריט/i.test(b))) {
        failures.push(`${lang}: the item carries no "Item" badge`);
      }

      // The facts a buyer needs, on the page rather than only in the model.
      const facts = (await page.locator('[data-testid="request-detail-page"]').innerText()).replace(/\s+/g, ' ');
      for (const [what, needle] of [
        ['condition', lang === 'he' ? 'מצב' : 'Condition'],
        ['collection point', lang === 'he' ? 'איסוף' : 'Collection'],
      ]) {
        if (!facts.includes(needle)) {
          failures.push(`${lang}: the item page never shows its ${what}`);
        }
      }

      // Nothing may imply we hold the money.
      const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
      const promises = [
        /buyer protection/i, /escrow/i, /money.back guarantee/i,
        /we hold your (money|payment)/i, /secure(d)? payment/i,
      ].filter((re) => re.test(body));
      if (promises.length) {
        failures.push(`${lang}: the item page implies we protect the transaction (${promises.length} phrase(s))`);
      }
    }

    // The report button — the N6 surface that must exist on every item.
    if (itemId) {
      const report = await page.locator('[data-testid="request-report-btn"]').count();
      note(`${lang}: report button present: ${report > 0}`);
      if (!report) failures.push(`${lang}: no report button on an item`);
    }
    await ctx.close();
  }

  // ---- 8. the board tab, and the form's safety line -------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await ctx.addInitScript((t) => {
      try { sessionStorage.setItem('token', t); } catch { /* private mode */ }
    }, token);
    const page = await ctx.newPage();
    await page.goto(`${APP}/requests`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    const tab = await page.locator('button:has-text("Items"), [data-testid*="type-item"]').count();
    note(`board has an Items tab: ${tab > 0}`);
    if (!tab) failures.push('the requests board has no Items tab');

    await page.goto(`${APP}/requests/post`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    const itemChoice = page.locator('[data-testid="post-request-type-item"]');
    if (await itemChoice.count() === 0) {
      failures.push('the post form offers no item option');
    } else {
      await itemChoice.click();
      await page.waitForTimeout(400);
      await page.locator('[data-testid="post-request-next"]').click();
      await page.waitForTimeout(900);
      await page.locator('[data-testid="post-request-title"]').fill('Sofa, three seats');
      await page.locator('[data-testid="post-request-description"]')
        .fill('Grey fabric, four years old, collection from Katamon.');
      await page.locator('[data-testid="post-request-next"]').click();
      await page.waitForTimeout(900);
      await page.locator('[data-testid="post-request-area"]').fill('Jerusalem');
      await page.keyboard.press('Enter');
      await page.locator('[data-testid="post-request-next"]').click();
      await page.waitForTimeout(1200);

      const cond = await page.locator('[data-testid="post-request-condition"]').count();
      const formSafety = await page.locator('[data-testid="post-request-item-safety"]').count();
      note(`form: condition picker=${cond > 0}, safety line=${formSafety > 0}`);
      if (!cond) failures.push('the item form has no condition picker');
      if (!formSafety) failures.push('the item form shows no safety line — the moment to read it is before you meet someone');
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

if (failures.length) {
  console.error('\nFAILED:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}
console.log('\nall checks passed');
