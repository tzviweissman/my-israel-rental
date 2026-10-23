// Upcoming Jewish holiday windows used by the Sukkot/Pesach pages to
// pre-populate the date filter. Update once a year with the next year's
// Hebrew calendar dates (or the current upcoming window if today >= end).
//
// Tip: pull the dates from https://www.hebcal.com/holidays/<year>.

export const HOLIDAY_WINDOWS = {
  sukkot: {
    // Sukkot 5788, Erev Sukkot through Simchat Torah, the same dates as
    // utils/holidayCalendar.js. Rolled on 23 Oct 2026 (audit): 5787 had
    // passed, so a renter who hit this fallback saw a window in the past.
    label: 'Sukkot',
    start: '2027-10-15',
    end: '2027-10-23',
    year: 2027,
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
