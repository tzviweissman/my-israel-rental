/**
 * The steps an order goes through, shown the same way on the customer's
 * tracking link and the business's own link: Preparing, then Ready, then
 * Collected or Delivered. `courierNote` adds the customer's "waiting for
 * the courier" line under a delivery that is packed.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';

const RANK = { new: 0, preparing: 1, ready: 2, done: 3 };

export default function OrderSteps({ status, fulfilment, table, courierNote = false }) {
  const { t } = useTranslation();
  const delivery = fulfilment === 'delivery';
  // A table order (backend tables.py) is cooked and brought to the table.
  const steps = table
    ? [['preparing', t('orders.track.preparing', 'Preparing')], ['ready', t('tableOrder.onItsWay', 'On its way to your table')], ['done', t('tableOrder.served', 'Served')]]
    : delivery
    ? [['preparing', t('orders.track.preparing', 'Preparing')], ['ready', t('orders.track.outForDelivery', 'Out for delivery')], ['done', t('orders.track.delivered', 'Delivered')]]
    : [['preparing', t('orders.track.preparing', 'Preparing')], ['ready', t('orders.track.readyToCollect', 'Ready to collect')], ['done', t('orders.track.collected', 'Collected')]];
  const current = RANK[status] ?? -1;

  return (
    <ol className="space-y-3" data-testid="track-steps">
      {steps.map(([key, label], i) => {
        const idx = i + 1;
        const done = current > idx;
        const now = current === idx;
        return (
          <li key={key} className="flex items-center gap-3" data-step={key} data-state={done ? 'done' : now ? 'now' : 'todo'} aria-current={now ? 'step' : undefined}>
            <span
              className="grid place-content-center w-8 h-8 rounded-full shrink-0 text-sm font-bold"
              style={done
                ? { background: 'var(--status-open-bg)', color: 'var(--status-open)' }
                : now
                  ? { background: 'var(--ink)', color: 'var(--action-ink)' }
                  : { background: 'var(--surface-muted)', color: 'var(--brand-muted)' }}
              aria-hidden="true"
            >
              {done ? <Check size={16} /> : idx}
            </span>
            <span className={`text-base ${now || done ? 'font-semibold' : ''}`} style={{ color: now || done ? 'var(--ink)' : 'var(--brand-muted)' }}>
              <span className="sr-only">
                {done ? t('orders.track.a11yDone', 'Done. ') : now ? t('orders.track.a11yNow', 'Current step. ') : t('orders.track.a11yTodo', 'Not yet. ')}
              </span>
              {label}
              {now && key === 'ready' && courierNote && (
                <span className="block text-xs font-normal" style={{ color: 'var(--brand-muted)' }}>{t('orders.track.readyWaitingCourier', 'Packed and waiting for the courier')}</span>
              )}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
