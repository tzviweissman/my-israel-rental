// Auto-rolling holiday windows powered by the Hebcal JSON API.
// Returns the *next upcoming* Sukkot and Pesach windows so the marketing
// banner doesn't have to be edited every year. Caches in localStorage for
// 30 days; falls back to the static defaults in `holidayWindows.js` when
// the API is unreachable.
//
// Schedule: Israel (i=on) — fits a Tel Aviv / Jerusalem rental site.

import { HOLIDAY_WINDOWS as FALLBACK } from '../constants/holidayWindows';

const CACHE_KEY = 'mir_holiday_windows_v2';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const HEBCAL = (year) =>
  `https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&i=on&year=${year}`;

// Sukkot covers everything from Erev Sukkot through Shmini Atzeret /
// Simchat Torah. Pesach covers Erev Pesach through Pesach VIII.
// Shavuot is short (1 day in Israel) but we add an Erev. Rosh Hashana
// is 2 days; Erev Rosh Hashana is the eve.
const SUKKOT_PREFIXES = ['Erev Sukkot', 'Sukkot', 'Shmini Atzeret', 'Simchat Torah'];
const PESACH_PREFIXES = ['Erev Pesach', 'Pesach'];
const SHAVUOT_PREFIXES = ['Erev Shavuot', 'Shavuot'];
const ROSH_HASHANA_PREFIXES = ['Erev Rosh Hashana', 'Rosh Hashana'];

const fetchYear = async (year) => {
  const r = await fetch(HEBCAL(year), { mode: 'cors' });
  if (!r.ok) throw new Error(`Hebcal ${year} ${r.status}`);
  const json = await r.json();
  return (json.items || []).filter((it) => it.category === 'holiday');
};

// Group consecutive holiday days (gap ≤ 14 days = same chag). Returns the
// next run whose `end` is on/after `today`, or null if none.
const pickNextRun = (items, prefixes, today) => {
  const matched = items.filter((it) =>
    prefixes.some((p) => it.title === p || it.title.startsWith(p + ' ') || it.title.startsWith(p + ' (')),
  );
  const dates = [...new Set(matched.map((m) => m.date))].sort();
  if (!dates.length) return null;

  const runs = [];
  let cur = null;
  for (const d of dates) {
    if (!cur) {
      cur = { start: d, end: d };
    } else {
      const gap = (new Date(d) - new Date(cur.end)) / 86400000;
      if (gap <= 14) {
        cur.end = d;
      } else {
        runs.push(cur);
        cur = { start: d, end: d };
      }
    }
  }
  if (cur) runs.push(cur);

  return runs.find((r) => r.end >= today) || null;
};

const readCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.cachedAt || Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCache = (data) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ cachedAt: Date.now(), data }));
  } catch {
    /* localStorage full / disabled */
  }
};

/**
 * Returns `{ sukkot: {start,end,year,label}, pesach: {start,end,year,label} }`.
 * Cached, network-resilient. Always resolves (falls back to static defaults
 * on any error).
 */
export async function loadHolidayWindows() {
  const cached = readCache();
  if (cached) return cached;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const thisYear = new Date().getFullYear();
    // Pull this year + next year so we always find the upcoming run even if
    // the current year's chag has already passed.
    const items = [...(await fetchYear(thisYear)), ...(await fetchYear(thisYear + 1))];

    const sukkotRun = pickNextRun(items, SUKKOT_PREFIXES, today);
    const pesachRun = pickNextRun(items, PESACH_PREFIXES, today);
    const shavuotRun = pickNextRun(items, SHAVUOT_PREFIXES, today);
    const roshHashanaRun = pickNextRun(items, ROSH_HASHANA_PREFIXES, today);

    const out = {
      sukkot: sukkotRun
        ? {
            start: sukkotRun.start,
            end: sukkotRun.end,
            year: parseInt(sukkotRun.start.slice(0, 4), 10),
            label: 'Sukkot',
          }
        : FALLBACK.sukkot,
      pesach: pesachRun
        ? {
            start: pesachRun.start,
            end: pesachRun.end,
            year: parseInt(pesachRun.start.slice(0, 4), 10),
            label: 'Pesach',
          }
        : FALLBACK.pesach,
      // Newly-added holidays — fallback is null so callers can skip
      // when Hebcal is unreachable rather than render stale dates.
      shavuot: shavuotRun
        ? {
            start: shavuotRun.start,
            end: shavuotRun.end,
            year: parseInt(shavuotRun.start.slice(0, 4), 10),
            label: 'Shavuot',
          }
        : null,
      roshHashana: roshHashanaRun
        ? {
            start: roshHashanaRun.start,
            end: roshHashanaRun.end,
            year: parseInt(roshHashanaRun.start.slice(0, 4), 10),
            label: 'Rosh Hashana',
          }
        : null,
    };

    writeCache(out);
    return out;
  } catch (err) {
    console.warn('Hebcal lookup failed, using static fallback', err);
    return FALLBACK;
  }
}
