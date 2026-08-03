// Upcoming Jewish holiday windows used by the Sukkot/Pesach pages to
// pre-populate the date filter. Update once a year with the next year's
// Hebrew calendar dates (or the current upcoming window if today >= end).
//
// Tip: pull the dates from https://www.hebcal.com/holidays/<year>.

export const HOLIDAY_WINDOWS = {
  sukkot: {
    // Sukkot 5787 — Erev Sukkot through Simchat Torah, Hebcal Israel
    // schedule, verified 2026-08-02. The end was 2026-10-04, a day past the
    // chag; aligned so this file and utils/holidayCalendar.js agree.
    label: 'Sukkot',
    start: '2026-09-25',
    end: '2026-10-03',
    year: 2026,
  },
  pesach: {
    // Pesach 5787 — verified against the Hebcal API (i=on, Israel schedule)
    // on 2026-08-02. Was 2026-04-01→04-09, which had already PASSED, so any
    // renter who hit the fallback got a holiday window entirely in the past:
    // the "Book Pesach" CTA pre-filled dates the calendar then greys out,
    // and Pesach became unbookable. The live Hebcal loader normally rolls
    // this forward on its own, so the stale value only bit when the API was
    // unreachable — which is exactly when nobody notices.
    label: 'Pesach',
    start: '2027-04-21',
    end: '2027-04-28',
    year: 2027,
  },
};
