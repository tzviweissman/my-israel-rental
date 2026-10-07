/**
 * For an admin only (the API sends page_check to nobody else): a v3 page
 * the quality gate has not passed is shown to admins, so the gate can render
 * it, and to nobody else. This says so, and why. English, like the rest of
 * the admin console. The gate hides it before measuring (data-gate-ignore).
 */
import React from 'react';

export default function V3GateNotice({ check, slug }) {
  if (!check || check.live) return null;
  const why = check.stale ? 'The page changed after its last check.'
    : check.passed === false ? 'The last check failed:'
      : 'The page has not been checked yet.';
  return (
    <details className="pv3-gate" dir="ltr" lang="en" data-gate-ignore="" data-testid="pv3-gate-notice" open={check.passed === false}>
      <summary>Admins only: visitors see the standard page until this one passes the quality check.</summary>
      <p>{why}</p>
      {check.passed === false && !check.stale && (
        <ul>{check.failures.slice(0, 8).map((f) => <li key={f}>{f}</li>)}</ul>
      )}
      <p>Run: <code>node scripts/check-page.mjs {slug} --submit</code></p>
    </details>
  );
}
