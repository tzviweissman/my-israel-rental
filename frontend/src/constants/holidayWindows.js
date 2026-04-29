// Upcoming Jewish holiday windows used by the Sukkot/Pesach pages to
// pre-populate the date filter. Update once a year with the next year's
// Hebrew calendar dates (or the current upcoming window if today >= end).
//
// Tip: pull the dates from https://www.hebcal.com/holidays/<year>.

export const HOLIDAY_WINDOWS = {
  sukkot: {
    label: 'Sukkot',
    // Sukkot 5787 — 1st night sunset Sep 25, ends Simchat Torah evening Oct 4
    start: '2026-09-25',
    end: '2026-10-04',
    year: 2026,
  },
  pesach: {
    label: 'Pesach',
    // Pesach 5786 — 1st Seder April 1, ends April 9 evening
    start: '2026-04-01',
    end: '2026-04-09',
    year: 2026,
  },
};
