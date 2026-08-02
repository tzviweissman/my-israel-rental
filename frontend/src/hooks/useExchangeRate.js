import { useEffect, useState } from 'react';
import axios from 'axios';
import { API } from '../App';

/**
 * Live USD→ILS rate for the rentals side.
 *
 * Why this exists
 * ---------------
 * The rentals surfaces each hardcoded 3.65. The real rate is currently
 * around 3.06, so every "≈ ₪X" figure on a card was roughly 19% too high —
 * a $2,000/month listing displayed as about ₪7,300 instead of ₪6,120.
 *
 * It wasn't only cosmetic: /stays converts prices to a single currency
 * before applying the price *filter*, so someone filtering "under ₪7,000"
 * was silently excluding listings that actually qualified.
 *
 * The backend already had the live rate (utils/fx.py, 6-hour cache, exposed
 * at GET /exchange-rate) and the property detail page already fetched it.
 * Only the list/card surfaces were still on the constant.
 *
 * Module-level cache: every card on a results page calls this, and they must
 * not each fire a request. One in-flight promise is shared, and the resolved
 * rate is reused for the lifetime of the tab — the underlying figure only
 * moves every 6 hours, so a per-session read is plenty.
 */

// Last-resort value, used only when the request fails. Matches the backend's
// own fallback in utils/fx.py so an outage degrades to one number rather than
// two different wrong ones. It is deliberately NOT the starting value —
// see `FALLBACK_IS_NOT_INITIAL` below.
export const FALLBACK_USD_TO_ILS = 3.65;

let cachedRate = null;
let inFlight = null;

const fetchRate = () => {
  if (cachedRate != null) return Promise.resolve(cachedRate);
  if (inFlight) return inFlight;
  inFlight = axios
    .get(`${API}/exchange-rate`)
    .then((res) => {
      const value = Number(res?.data?.usd_to_ils);
      // Guard against a malformed or zero rate: dividing by it later would
      // produce Infinity prices.
      cachedRate = Number.isFinite(value) && value > 0 ? value : FALLBACK_USD_TO_ILS;
      return cachedRate;
    })
    .catch(() => {
      cachedRate = FALLBACK_USD_TO_ILS;
      return cachedRate;
    })
    .finally(() => { inFlight = null; });
  return inFlight;
};

/**
 * @returns {{rate: number, ready: boolean}}
 *
 * `ready` is false until the real rate lands. Callers that render money
 * should hold off on the ≈₪ line until then rather than flashing a figure
 * computed from the fallback and then correcting it — a price that visibly
 * changes is worse than a price that appears a moment later.
 *
 * FALLBACK_IS_NOT_INITIAL: the initial value is the fallback so arithmetic
 * never sees null, but `ready` is what tells you whether to trust it.
 */
export default function useExchangeRate() {
  const [rate, setRate] = useState(cachedRate ?? FALLBACK_USD_TO_ILS);
  const [ready, setReady] = useState(cachedRate != null);

  useEffect(() => {
    if (cachedRate != null) {
      setRate(cachedRate);
      setReady(true);
      return undefined;
    }
    let alive = true;
    fetchRate().then((value) => {
      if (!alive) return;
      setRate(value);
      setReady(true);
    });
    return () => { alive = false; };
  }, []);

  return { rate, ready };
}
