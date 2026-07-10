/**
 * recentChangelog — most recent user-visible product updates.
 *
 * Manually maintained (top of file = newest). The stale-build detector
 * pulls the top 2 entries and surfaces them alongside the "Please
 * refresh" toast so users understand *why* they should refresh — not
 * just be told to do it.
 *
 * Keep each entry:
 *   • Title: <= 60 chars, one sentence, past-tense verb.
 *   • Description: <= 120 chars, plain English, no jargon.
 *
 * Newest 2 render in the toast; the rest are kept for the "Full history"
 * link (future work).
 */
const recentChangelog = [
  {
    date: '2026-07-10',
    title: 'Per-tier photo galleries on service listings',
    desc: 'Every service or tour can now have its own photos — customers see the right visuals for each option.',
  },
  {
    date: '2026-07-10',
    title: 'Live "Available now" filter on Services',
    desc: 'Find barbers, masseuses, and personal trainers open right now with a single tap.',
  },
  {
    date: '2026-07-09',
    title: 'Three listing types on the marketplace',
    desc: 'Choose between Store (products), Deliverable service (with turnaround), or Appointment (time-slot booking).',
  },
  {
    date: '2026-07-08',
    title: 'Automatic Hebrew translations',
    desc: 'Every new gig is instantly translated to Hebrew so Hebrew-speaking renters can find and read it.',
  },
];

export default recentChangelog;
