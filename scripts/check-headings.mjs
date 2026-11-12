#!/usr/bin/env node
/*
 * Headings say the benefit (rule 3ab.1; Tzvi, 12 Nov 2026, from "I Studied 1000 Landing Pages", notes in
 * docs/inspo/videos-2026-11-12-landing-pages). A visitor scans the headings only, so a heading that is just a
 * section label ("How it works", "Our services", "Why choose us") tells them nothing.
 *
 *   node scripts/check-headings.mjs <url> [more urls]
 *
 * Reads every h1-h3 on the page outside the footer and the menu bar. Fails (exit 1):
 *   GENERIC  a heading is only a section label, in English or Hebrew
 * Questions ("FAQ") and contact headings are allowed: people look for them by that name (Jakob's law, 3t).
 */
import { chromium } from 'playwright';

// Whole-heading matches only, after dropping punctuation and case: "How it works" fails, "How your platter
// reaches you in 3 hours" passes.
export const GENERIC = [
  'how it works', 'how does it work', 'our services', 'services', 'what we do', 'what we offer', 'our offer',
  'about', 'about us', 'who we are', 'our story', 'what makes us unique', 'what makes us different',
  'why choose us', 'why us', 'why choose', 'our products', 'products', 'our work', 'gallery', 'features',
  'testimonials', 'reviews', 'what our customers say', 'what people say', 'our menu', 'menu', 'welcome',
  'איך זה עובד', 'השירותים שלנו', 'שירותים', 'מה אנחנו עושים', 'אודות', 'אודותינו', 'עלינו', 'מי אנחנו',
  'הסיפור שלנו', 'מה מייחד אותנו', 'למה אנחנו', 'למה לבחור בנו', 'המוצרים שלנו', 'מוצרים', 'גלריה',
  'המלצות', 'ביקורות', 'מה הלקוחות אומרים', 'התפריט שלנו', 'תפריט', 'ברוכים הבאים',
];
export const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, ' ').replace(/\s+/g, ' ').trim();
const generic = new Set(GENERIC.map(norm));

const urls = process.argv.slice(2);
if (process.argv[1]?.endsWith('check-headings.mjs')) {
  if (urls[0] === '--self-test') {
    for (const [h, bad] of [['How it works', true], ['How It Works?', true], ['למה לבחור בנו?', true],
      ['How your platter reaches you in 3 hours', false], ['Questions', false], ['Fresh bread by 7am', false]])
      if (generic.has(norm(h)) !== bad) { console.error(`self-test: "${h}" judged wrong`); process.exit(1); }
    console.log('check-headings self-test: ok'); process.exit(0);
  }
  if (!urls.length) { console.error('usage: node scripts/check-headings.mjs <url> [more urls]'); process.exit(2); }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const problems = [];
  for (const url of urls) {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(500);
    const heads = await page.$$eval('h1, h2, h3, [role=heading]', (els) => els
      .filter((e) => !e.closest('footer, nav, header, [aria-hidden=true]'))
      .map((e) => e.textContent.replace(/\s+/g, ' ').trim()).filter(Boolean));
    for (const h of heads) if (generic.has(norm(h))) problems.push(`GENERIC  ${url}: "${h}" is a section label; say what the visitor gets`);
  }
  await browser.close();
  if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
  console.log(`headings: every heading says something on ${urls.length} page(s)`);
}
