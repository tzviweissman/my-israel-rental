/**
 * Frontend helper: is this user currently allowed to publish gigs?
 *
 * True when either their primary role is `provider`, an admin, or when
 * they accepted the "Take Your Services to the Next Level" upsell and
 * their $0 30-day trial is still active (users.provider_trial.ends_at
 * in the future).
 *
 * Kept in a shared util so DashboardTabs and Dashboard.js can't drift.
 */
export const canPublishGigs = (user) => {
  if (!user) return false;
  if (user.role === 'provider' || user.role === 'admin') return true;
  const endsAt = user.provider_trial?.ends_at;
  if (!endsAt) return false;
  const t = Date.parse(endsAt);
  return Number.isFinite(t) && t > Date.now();
};
