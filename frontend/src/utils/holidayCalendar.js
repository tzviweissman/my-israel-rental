/**
 * Sukkot / Pesach start-end date lookup so owners can auto-fill the
 * property's holiday booking window with one click instead of consulting
 * a Hebrew calendar. Dates cover the whole popular booking window:
 * eve of Yom Tov → last day of Chol HaMoed inclusive.
 *
 * Curated by hand for the next three secular years — cheap, deterministic
 * and offline. Refresh the table each summer before the new booking cycle
 * (a 30-second annual chore, no library dependency to keep the bundle small).
 */
// Verified against the Hebcal API (Israel schedule, i=on) on 2026-08-02,
// covering Erev Yom Tov through the last day of the chag inclusive.
//
// Every Sukkot row here was previously WRONG — 2026 by 11 days, 2027 by three
// weeks, 2028 by 10 days — and Pesach 2026 ended a day late. This table is
// what fills a lister's holiday booking window when they tick "Sukkot", so
// those listings advertised a Sukkot rate over dates that aren't Sukkot: the
// holiday premium applied to the wrong week, and renters searching the real
// dates didn't match. Hand-curated tables drift silently; do not edit these
// from memory. Re-derive them:
//
//   https://www.hebcal.com/hebcal?v=1&cfg=json&maj=on&i=on&year=<YYYY>
//
// `backend/tests/test_holiday_tables_agree.py` pins these values and checks
// this table against constants/holidayWindows.js, so a wrong edit fails the
// suite rather than quietly mispricing a chag.
export const HOLIDAY_WINDOWS = {
  sukkot: {
    2026: { start: '2026-09-25', end: '2026-10-03' },   // Erev Sukkot–Simchat Torah 5787
    2027: { start: '2027-10-15', end: '2027-10-23' },   // Erev Sukkot–Simchat Torah 5788
    2028: { start: '2028-10-04', end: '2028-10-12' },   // Erev Sukkot–Simchat Torah 5789
  },
  pesach: {
    2026: { start: '2026-04-01', end: '2026-04-08' },   // Erev Pesach–Pesach VII 5786
    2027: { start: '2027-04-21', end: '2027-04-28' },   // Erev Pesach–Pesach VII 5787
    2028: { start: '2028-04-10', end: '2028-04-17' },   // Erev Pesach–Pesach VII 5788
  },
};

/**
 * Given one or more selected holiday tags (`['sukkot']`, `['pesach']`, or
 * both), return the earliest start + latest end for the *next occurrence*
 * relative to today. When multiple tags are selected we merge into a
 * single umbrella window that spans both — same shape a renter would use.
 */
export const nextHolidayWindow = (tags = []) => {
  if (!tags?.length) return null;
  const today = new Date().toISOString().slice(0, 10);
  const windows = [];
  for (const tag of tags) {
    const perYear = HOLIDAY_WINDOWS[tag];
    if (!perYear) continue;
    const upcoming = Object.values(perYear)
      .filter((w) => w.end >= today)
      .sort((a, b) => a.start.localeCompare(b.start));
    if (upcoming.length) windows.push(upcoming[0]);
  }
  if (!windows.length) return null;
  return {
    start: windows.map((w) => w.start).sort()[0],
    end: windows.map((w) => w.end).sort().slice(-1)[0],
  };
};
