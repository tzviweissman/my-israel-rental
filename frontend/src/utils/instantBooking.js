/**
 * Does a booking on this property confirm instantly, or arrive as a request?
 *
 * This mirrors `_build_booking_doc` in
 * `backend/routes/bookings/shared.py` and must stay in lockstep with it.
 * The two sides answer the same question for different reasons: the backend
 * decides the booking's actual status, the frontend decides whether the
 * button says "Book now" or "Request to book". When they disagree the renter
 * is told one thing and gets the other — they press "Book now", nothing is
 * confirmed, and the dates sit pending while they believe they're booked.
 *
 * The rule, in order:
 *
 *   1. A sublease is never instant. The sublessor is personally on the hook
 *      and always accepts explicitly, whatever the property says.
 *   2. `instant_booking === true | false` — the lister chose; honour it.
 *   3. `instant_booking == null` — nobody has chosen. Fall back to the rule
 *      that was hardcoded before the setting existed: vacation rentals are
 *      instant, everything else is a request. This keeps every listing that
 *      predates the setting behaving exactly as it does today.
 *
 * Step 3 is why `null` is checked with `??` rather than treated as falsy.
 * `false` is a deliberate "review each request" and must not collapse into
 * the same branch as "never chosen" — they produce opposite answers for a
 * vacation rental.
 *
 * @param {object} property  Property document (needs `instant_booking`, `rental_type`).
 * @param {object|null} sublease  Sublease being booked, if any.
 * @returns {boolean} true when the booking will be confirmed immediately.
 */
export function isInstantBooking(property, sublease = null) {
  if (sublease) return false;
  if (!property) return false;
  const chosen = property.instant_booking;
  if (chosen === null || chosen === undefined) {
    return property.rental_type === 'vacation';
  }
  return Boolean(chosen);
}

export default isInstantBooking;
