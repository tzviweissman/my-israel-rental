/**
 * Proof line under the Stays search panel (research item B1).
 *
 * Thumbtack and Plum Guide both put social proof directly under the search
 * control. The brief for this one was strict: real numbers pulled from the
 * database, and any clause whose number isn't available gets dropped rather
 * than estimated. So every number here comes from
 * `/api/properties/stats/trust`, which counts the same visible set the
 * public feed serves; nothing is hardcoded, and a failed fetch renders
 * nothing at all rather than a placeholder.
 *
 * Why it says Jerusalem and not "cities across Israel": the research
 * suggested a cities-covered clause, but the live `area` values are
 * neighbourhoods — Geula, Nachlaot, Rehavia, Baka — and every listing is
 * in Jerusalem. The suggested clause would have been false. See the note
 * on the endpoint in backend/routes/properties/browse.py.
 *
 * The floors below are the one judgement call. A proof line reading
 * "3 homes across 1 neighbourhood" argues against the site, and a dev
 * database hits exactly that. Under the floor the clause is hidden. This
 * only ever hides a true number — it never rounds up, and never invents.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const MIN_LISTINGS = 25;
const MIN_NEIGHBORHOODS = 5;

export default function TrustLine({ t }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    axios
      .get(`${API}/api/properties/stats/trust`)
      .then((r) => { if (alive) setStats(r.data); })
      // Silent: this is decoration under a working search panel. An error
      // message here would be louder than the thing it replaces.
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  if (!stats) return null;

  // `n`, not `count`: i18next treats `count` as the pluralisation trigger
  // and starts looking for _one/_other sibling keys, which these are not.
  const parts = [];
  if (stats.listings >= MIN_LISTINGS) {
    parts.push(t('stays.trustListings', '{{n}} homes listed', { n: stats.listings }));
  }
  if (stats.neighborhoods >= MIN_NEIGHBORHOODS) {
    parts.push(
      t('stays.trustAreas', 'across {{n}} Jerusalem neighbourhoods', {
        n: stats.neighborhoods,
      }),
    );
  }
  // The fee clause is not a count — it is a standing fact about the
  // product, so it shows whether or not the numbers cleared their floors.
  parts.push(t('stays.trustFees', 'free to search · no booking fees'));

  return (
    <p className="trust-line" data-testid="stays-trust-line">
      {parts.join(' · ')}
    </p>
  );
}
