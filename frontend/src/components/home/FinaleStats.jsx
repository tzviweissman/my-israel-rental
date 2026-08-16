/**
 * The stat strip at the end of the home page.
 *
 * This exists because the strip previously shipped the preview file's
 * placeholder figures — "1,200+ active rentals", "19 cities", "450+
 * verified pros" — as if they were claims. They were never true: the real
 * numbers are 196 listings, every one of them in Jerusalem, and three
 * service providers. The redesign branch had not deployed yet, so they
 * were caught before anyone read them, but only just.
 *
 * Rules, same as the Stays trust line (see components/stays/TrustLine.jsx):
 *   • every number comes from the database at runtime, never from source;
 *   • a clause whose number isn't available is absent, not estimated;
 *   • below a floor the count hides, because a proof strip reading
 *     "3 active rentals" argues against the site.
 *
 * ₪0 service fees is the exception and always shows: it is not a count,
 * it is a standing fact about how the product is priced.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

const MIN_LISTINGS = 25;
const MIN_NEIGHBORHOODS = 5;

export default function FinaleStats({ t }) {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    axios
      .get(`${API}/api/properties/stats/trust`)
      .then((r) => { if (alive) setStats(r.data); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const items = [];
  if (stats?.listings >= MIN_LISTINGS) {
    items.push([stats.listings, t('home.finale.statRentals', 'active rentals')]);
  }
  if (stats?.neighborhoods >= MIN_NEIGHBORHOODS) {
    items.push([
      stats.neighborhoods,
      t('home.finale.statAreas', 'Jerusalem neighbourhoods'),
    ]);
  }
  items.push(['₪0', t('home.finale.statFees', 'service fees')]);

  return (
    <div className="strip" data-testid="finale-stats">
      {items.map(([value, label]) => (
        <span key={label}>
          <b>{value}</b> {label}
        </span>
      ))}
    </div>
  );
}
