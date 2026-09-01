/**
 * Turn any axios error into a string that is safe to render.
 *
 * Why this exists
 * ---------------
 * The pattern `toast.error(error.response?.data?.detail || 'Something failed')`
 * appears ~115 times in this app. It is correct for every status FastAPI
 * raises by hand, where `detail` is the string we wrote — and it is a crash
 * for the one status FastAPI generates itself.
 *
 * On a 422 (request validation), the body is:
 *
 *     { "detail": [ { "type": "missing",
 *                     "loc": ["body", "denial_reason"],
 *                     "msg": "Field required",
 *                     "input": { ... } } ] }
 *
 * `detail` is an ARRAY OF OBJECTS. It is truthy, so `||` never reaches the
 * fallback, and the array goes to `toast.error()`, which renders it as a
 * React child. React throws "Objects are not valid as a React child", and
 * because sonner's <Toaster/> is mounted at the root, the crash unmounts the
 * WHOLE app — a blank white page, no message, nothing to click.
 *
 * That is what happened when a lister tried to deny a cancellation request:
 * the frontend posted `reason` where the endpoint wanted `denial_reason`, so
 * every denial 422'd, and the 422 blanked the page instead of saying what was
 * wrong. Two bugs, and the second one hid the first.
 *
 * The rule: nothing that came off the wire is a string until it is proven to
 * be one. `String(x)` is not enough either — it renders "[object Object]",
 * which is not a crash but is not a message either.
 *
 * THE NETWORK BRANCH HAS TO BE TRANSLATED, and it was not. On 1 Sep 2026
 * someone tried to create a business account thirteen times in three
 * minutes; the Railway logs show thirteen successful CORS preflights to
 * `/api/auth/register` and NOT ONE POST. Her requests never reached the
 * server, so there was no `detail` to show and no way for the screen to
 * say so — the signup page was not using this helper at all, and the
 * message it did show read, in Hebrew, "verification failed". She spent
 * three minutes correcting an email address that was never the problem.
 * `t` is optional so the four existing call sites keep working unchanged.
 *
 * @param {unknown}  error     The caught error (axios or otherwise).
 * @param {string}   fallback  Message to show when nothing usable is found.
 * @param {function} [t]       i18next translator, for the network line.
 * @returns {string}           Always a string, always safe to render.
 */
export function apiErrorMessage(error, fallback = 'Something went wrong. Please try again.', t) {
  const detail = error?.response?.data?.detail;

  // The normal case: we raised HTTPException(detail="a sentence we wrote").
  if (typeof detail === 'string' && detail.trim()) return detail;

  // FastAPI request-validation errors: an array of {loc, msg, type} objects.
  // Surface the human-readable part and name the field, so "Field required"
  // becomes something the reader can act on rather than a generic failure.
  if (Array.isArray(detail)) {
    const parts = detail
      .map((d) => {
        if (typeof d === 'string') return d;
        const msg = typeof d?.msg === 'string' ? d.msg : null;
        if (!msg) return null;
        // `loc` is like ["body", "denial_reason"] — the last entry is the
        // field. Skip it when it's just ["body"], which names nothing useful.
        const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : null;
        return field && field !== 'body' ? `${field}: ${msg}` : msg;
      })
      .filter(Boolean);
    if (parts.length) return parts.join('; ');
  }

  // Some endpoints return a structured detail object (e.g. the duplicate
  // listing 409, which carries {code, message, existing_property_id}).
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    return detail.message;
  }

  // Network failure — no response at all. Distinguish it, because "check your
  // connection" and "the server said no" call for different reactions.
  //
  // `!error.response` alone, not `error.request && !error.response`: a
  // request blocked before it is dispatched has no `request` either, and
  // that case is the one that sent a real user round in circles.
  if (error && !error.response) {
    const tr = typeof t === 'function' ? t : null;
    const fallbackLine = 'Could not reach the server. Check your connection and try again — nothing you typed was lost.';
    return tr ? tr('common.networkError', fallbackLine) : fallbackLine;
  }

  return fallback;
}

export default apiErrorMessage;
