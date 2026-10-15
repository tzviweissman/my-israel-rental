/** Words for memberships, shared by the dashboard tab and the public pages. */
import { money } from '../../utils/currency';

export const planPrice = (t, p) => {
  const price = money(p.price, p.currency || 'ILS');
  if (p.period === 'month') return t('members.perMonth', '{{price}} a month', { price });
  if (p.period === 'year') return t('members.perYear', '{{price}} a year', { price });
  if (p.period === 'card' && !Number(p.price)) return t('members.free', 'Free');
  return price;
};

export const planVisits = (t, p) => {
  if (p.period === 'card') return t('members.cardRule', 'Every {{n}} visits: {{reward}}', { n: p.visits, reward: p.reward });
  if (p.period === 'pack') {
    const base = t('members.packVisits', '{{n}} visits', { n: p.visits });
    return p.valid_months ? `${base}, ${t('members.packValid', 'valid {{n}} months', { n: p.valid_months })}` : base;
  }
  if (!p.visits) return t('members.unlimited', 'Unlimited visits');
  return p.period === 'month'
    ? t('members.visitsMonth', '{{n}} visits a month', { n: p.visits })
    : t('members.visitsYear', '{{n}} visits a year', { n: p.visits });
};

/** Why a member cannot come in. */
export const stateLabel = (t, reason) => ({
  pending: t('members.state.pending', 'Waiting for payment'),
  paused: t('members.state.paused', 'Paused'),
  cancelled: t('members.state.cancelled', 'Cancelled'),
  expired: t('members.state.expired', 'Expired'),
  not_started: t('members.state.notStarted', 'Not started yet'),
  due: t('members.state.due', 'Renewal due'),
  no_visits: t('members.state.noVisits', 'No visits left'),
  not_found: t('members.state.notFound', 'Not a member here'),
}[reason] || reason);
