/** Pure twin of the server's `past_cutoff`: the cutoff an order for
 * `date` has already missed, or null. Weekdays are JS-style. Lives here,
 * not in the owner's Orders tab, because the public order page needs it
 * and must not pull that 1,500-line tab into its bundle to get it. */
export const pastCutoff = (date, cutoffs, now = new Date()) => {
  if (!date) return null;
  const day = new Date(`${date}T00:00`);
  const wd = day.getDay();
  for (const c of cutoffs || []) {
    if (c.for_day !== wd) continue;
    const back = (wd - c.closes_day + 7) % 7;
    const closes = new Date(day);
    closes.setDate(closes.getDate() - back);
    const [h, m] = String(c.closes_time || '00:00').split(':').map(Number);
    closes.setHours(h, m, 0, 0);
    if (now > closes) return { ...c, closes };
  }
  return null;
};
