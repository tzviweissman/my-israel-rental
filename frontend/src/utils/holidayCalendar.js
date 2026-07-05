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
export const HOLIDAY_WINDOWS = {
  sukkot: {
    2026: { start: '2026-10-06', end: '2026-10-13' },   // 15–22 Tishrei 5787
    2027: { start: '2027-09-25', end: '2027-10-02' },   // 15–22 Tishrei 5788
    2028: { start: '2028-10-14', end: '2028-10-21' },   // 15–22 Tishrei 5789
  },
  pesach: {
    2026: { start: '2026-04-01', end: '2026-04-09' },   // 15–22 Nisan 5786
    2027: { start: '2027-04-21', end: '2027-04-28' },   // 15–22 Nisan 5787
    2028: { start: '2028-04-10', end: '2028-04-17' },   // 15–22 Nisan 5788
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
