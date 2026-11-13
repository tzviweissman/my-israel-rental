/**
 * The little journey at the top of the customer's tracking page (Tzvi, 6 Nov
 * 2026: "like an airline might show a small plane flying"). A bike, or a bag
 * for a pickup, keeps travelling from the step the order is at to the next
 * one, with one upbeat line about where things stand. It moves only with the
 * order's real status: nothing here promises a time.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Bike, ShoppingBag, UtensilsCrossed, Check } from 'lucide-react';

const CSS = `
.oj-track{position:relative;height:44px;margin:4px 14px 8px}
.oj-line,.oj-done{position:absolute;inset-block-start:21px;height:3px;border-radius:3px}
.oj-line{inset-inline:0;background:var(--brand-border)}
.oj-done{inset-inline-start:0;background:var(--status-open)}
.oj-dot{position:absolute;inset-block-start:16px;width:13px;height:13px;margin-inline-start:-6.5px;border-radius:50%;background:var(--surface-muted);border:2px solid var(--brand-border)}
.oj-dot[data-on="1"]{background:var(--status-open);border-color:var(--status-open)}
.oj-mover{position:absolute;inset-block-start:0;width:30px;height:30px;margin-inline-start:-15px;display:grid;place-content:center;border-radius:50%;background:var(--ink);color:var(--action-ink);box-shadow:0 3px 10px rgba(17,24,39,.22)}
.oj-mover[data-go="first"]{animation:oj-first 3s ease-in-out infinite}
.oj-mover[data-go="second"]{animation:oj-second 3s ease-in-out infinite}
.oj-mover[data-go="wait"]{inset-inline-start:0;animation:oj-wait 1.6s ease-in-out infinite}
.oj-mover[data-go="here"]{inset-inline-start:100%;background:var(--status-open);animation:oj-here .7s ease-out 1}
[dir="rtl"] .oj-flip{transform:scaleX(-1)}
@keyframes oj-first{0%{inset-inline-start:0;opacity:0}12%{opacity:1}85%{opacity:1}100%{inset-inline-start:50%;opacity:0}}
@keyframes oj-second{0%{inset-inline-start:50%;opacity:0}12%{opacity:1}85%{opacity:1}100%{inset-inline-start:100%;opacity:0}}
@keyframes oj-wait{50%{transform:scale(1.12)}}
@keyframes oj-here{0%{transform:scale(.6)}60%{transform:scale(1.2)}100%{transform:scale(1)}}
@media (prefers-reduced-motion:reduce){
  .oj-mover{animation:none!important;opacity:1}
  .oj-mover[data-go="first"]{inset-inline-start:25%}
  .oj-mover[data-go="second"]{inset-inline-start:75%}
}`;

export default function OrderJourney({ status, fulfilment, table }) {
  const { t } = useTranslation();
  const delivery = fulfilment === 'delivery';
  const Vehicle = table ? UtensilsCrossed : delivery ? Bike : ShoppingBag;
  const rank = { new: 0, preparing: 1, ready: 2, done: 3 }[status];
  if (rank === undefined) return null;
  const go = ['wait', 'first', 'second', 'here'][rank];
  const line = {
    new: t('orderJourney.new', 'Your order is in. Waiting for the store to say yes.'),
    preparing: t('orderJourney.preparing', 'Great news, they are working on your order.'),
    ready: table
      ? t('orderJourney.readyTable', 'Almost there, it is coming to your table.')
      : delivery
        ? t('orderJourney.readyDelivery', 'Packed and getting ready to head your way.')
        : t('orderJourney.readyPickup', 'It is ready for you. Come and get it.'),
    done: t('orderJourney.done', 'All done. Enjoy, and thank you for ordering.'),
  }[status];
  const dots = [0, 50, 100];

  return (
    <div className="mb-4" data-testid="order-journey" data-go={go}>
      <style>{CSS}</style>
      <div className="oj-track" aria-hidden="true">
        <span className="oj-line" />
        <span className="oj-done" style={{ width: `${Math.max(0, rank - 1) * 50}%` }} />
        {dots.map((d, i) => <span key={d} className="oj-dot" data-on={rank > i ? '1' : '0'} style={{ insetInlineStart: `${d}%` }} />)}
        <span className="oj-mover" data-go={go}>
          {go === 'here' ? <Check size={16} /> : <Vehicle size={16} className="oj-flip" />}
        </span>
      </div>
      <p className="text-base font-semibold text-center" role="status" style={{ color: 'var(--ink)' }} data-testid="order-journey-line">{line}</p>
    </div>
  );
}
