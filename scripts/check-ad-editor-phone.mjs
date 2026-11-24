/**
 * The ad editor on a phone: every field you tap ends up where you can see it, never under the pinned preview.
 *
 * THE BUG (18 Nov 2026). The ad preview stays pinned over ~40% of a phone screen. A field scrolled into view
 * landed under it, the tap hit the ad, and the typing went nowhere. Nothing caught it: the editor looked fine
 * in every screenshot because the fields were only hidden once scrolled to.
 *
 * For each text field in the editor: scroll it into view the way a tap or the keyboard does, focus it, and
 * check its top is below the bottom of the preview. Also checks the page never scrolls sideways.
 *
 * Usage: node scripts/check-ad-editor-phone.mjs   (needs the local frontend and API with DEV_AUTOLOGIN=1)
 *   APP_ORIGIN overrides http://localhost:3210.
 */
import { chromium, devices } from 'playwright';

const APP = process.env.APP_ORIGIN || 'http://localhost:3210';
const browser = await chromium.launch();
const failures = [];
try {
  const page = await browser.newPage({ ...devices['iPhone 13'], userAgent: `${devices['iPhone 13'].userAgent} mir-check` });
  await page.goto(`${APP}/dashboard?tab=advertising&as=owner&lng=en`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('[data-testid=ad-tabs]', { timeout: 90000 });
  await page.waitForSelector('[data-testid=ad-add-line], [data-testid=ad-extra]', { timeout: 90000 });
  // The options sit in four tabs since 23 Nov 2026: open each in turn, and the own-line box behind its button.
  let n = 0;
  for (const tab of ['words', 'look', 'extras', 'share']) {
  await page.click(`[data-testid=ad-tab-${tab}]`);
  if (tab === 'words' && await page.locator('[data-testid=ad-add-line]').count()) { await page.click('[data-testid=ad-add-line]'); await page.locator('[data-testid=ad-extra]').evaluate((el) => el.blur()); }
  await page.waitForTimeout(500);
  const fields = page.locator('[data-testid=ad-maker] input:not([type=checkbox]):not([type=radio]):not([type=color]):not([type=date]), [data-testid=ad-maker] textarea');
  const count = await fields.count();
  n += count;
  for (let i = 0; i < count; i += 1) {
    const f = fields.nth(i);
    if (!(await f.isVisible())) continue;
    const r = await f.evaluate((el) => {
      // Above the pinned preview's own column, i.e. the editor's options, not the gallery over it.
      const col = document.querySelector('[data-testid=ad-preview-column]');
      if (!(col.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING)) return null;
      el.scrollIntoView({ block: 'start' });
      el.focus();
      return { top: el.getBoundingClientRect().top, under: col.getBoundingClientRect().bottom, name: el.getAttribute('aria-label') || el.placeholder || el.dataset.testid || el.tagName };
    });
    await page.waitForTimeout(250);
    if (!r) continue;
    const now = await f.evaluate((el) => ({ top: el.getBoundingClientRect().top, under: document.querySelector('[data-testid=ad-preview-column]').getBoundingClientRect().bottom }));
    if (now.top < now.under - 1) failures.push(`"${r.name}" sits under the preview (top ${Math.round(now.top)}px, preview ends ${Math.round(now.under)}px)`);
    await f.evaluate((el) => el.blur());
    await page.waitForTimeout(450);
  }
  }
  // Second check (23 Nov 2026): with a text field focused (keyboard open) the pinned preview shrinks and grows back 400ms
  // after blur. A tap on a tab or menu button once made it grow mid-tap and land on another control. Each tap here is a
  // real touch at the control's own position, after refocusing the field; the tap must take effect on THAT control.
  const field = '[data-testid=ad-headline]';
  const reopenKeyboard = async (target) => {
    await page.click('[data-testid=ad-tab-words]');
    await page.locator(field).focus();
    if (target) await page.locator(target).first().scrollIntoViewIfNeeded();
    await page.locator(field).focus({ timeout: 5000 });
    await page.waitForTimeout(700); // the preview has shrunk and settled
  };
  const tapOn = async (sel) => {
    const box = await page.locator(sel).first().boundingBox();
    if (!box) return false;
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(900); // long enough for the preview to grow back and any wrong control to react
    return true;
  };
  let taps = 0;
  for (const tab of ['words', 'look', 'extras', 'share']) {
    const sel = `[data-testid=ad-tab-${tab}]`;
    await page.click('[data-testid=ad-tab-words]');
    await page.locator(field).focus();
    await page.waitForTimeout(700);
    if (!(await tapOn(sel))) { failures.push(`tab "${tab}" has no box to tap`); continue; }
    taps += 1;
    if ((await page.locator(sel).getAttribute('aria-selected')) !== 'true') failures.push(`keyboard open: tapping the "${tab}" tab landed elsewhere`);
  }
  // Buttons that open something harmless: Words "add a line", Look "background", the Share menus. Never a download, save, share or print.
  const buttons = [['words', '[data-testid=ad-add-line]', 'aria-expanded'], ['look', '[data-testid=ad-bg-open]', 'aria-expanded'],
    ['share', '[data-testid=ad-menu-download]', 'aria-expanded'], ['share', '[data-testid=ad-menu-save]', 'aria-expanded'], ['share', '[data-testid=ad-menu-print]', 'aria-expanded']];
  for (const [tab, sel, attr] of buttons) {
    await page.click(`[data-testid=ad-tab-${tab}]`);
    await page.waitForTimeout(300);
    if (!(await page.locator(sel).count()) || !(await page.locator(sel).first().isVisible())) continue;
    const before = attr ? await page.locator(sel).first().getAttribute(attr) : null;
    await page.locator(sel).first().scrollIntoViewIfNeeded();
    await page.locator(field).focus({ timeout: 5000 }).catch(() => {}); // the Words field is hidden on other tabs: focus it by script
    await page.evaluate((f) => document.querySelector(f)?.focus({ preventScroll: true }), field);
    await page.waitForTimeout(700);
    if (!(await tapOn(sel))) continue;
    taps += 1;
    const name = sel.replace('[data-testid=', '').replace(']', '');
    if (attr) {
      if ((await page.locator(sel).first().getAttribute(attr)) !== 'true' || before === 'true') failures.push(`keyboard open: tapping "${name}" did not open it (landed elsewhere)`);
      await page.keyboard.press('Escape');
    } else if (!(await page.locator('[data-testid=ad-extra]').count())) failures.push(`keyboard open: tapping "${name}" opened nothing (landed elsewhere)`);
  }
  console.log(`tapped ${taps} controls with the keyboard open`);
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (wide > 0) failures.push(`the page scrolls sideways by ${wide}px`);
  console.log(`checked ${n} fields`);
} finally {
  await browser.close();
}
if (failures.length) {
  console.log(`FAIL\n- ${failures.join('\n- ')}`);
  process.exit(1);
}
console.log('PASS: every ad editor field is clear of the preview on a phone');
