/**
 * How a product is priced (Tzvi, 7 Nov 2026, custom products; backend shared.py ProductItem.price_kind):
 *   fixed  the price is the price
 *   from   the price is where it starts; the business confirms the final price on the order
 *   quote  no price; the customer asks for one
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { money } from '../../utils/currency';

export const KINDS = ['fixed', 'from', 'quote'];

export const kindOf = (p) => (p && KINDS.includes(p.price_kind) ? p.price_kind : 'fixed');

/** A product's price as words: "₪100", "from ₪180", "₪180 to ₪350", "Price on request". */
export function priceText(t, p, currency) {
  const cur = currency || p?.currency || 'ILS';
  const kind = kindOf(p);
  if (kind === 'quote') return t('priceKind.onRequest', 'Price on request');
  const low = money(Number(p.price) || 0, cur);
  if (p.price_to && Number(p.price_to) > Number(p.price)) return t('priceKind.range', '{{low}} to {{high}}', { low, high: money(Number(p.price_to), cur) });
  return kind === 'from' ? t('priceKind.fromPrice', 'from {{price}}', { price: low }) : low;
}

/** Three choices above a product's price. */
export function PriceKindPicker({ value, onChange, testid }) {
  const { t } = useTranslation();
  const v = KINDS.includes(value) ? value : 'fixed';
  const labels = {
    fixed: t('priceKind.fixed', 'Set price'),
    from: t('priceKind.from', 'From a price'),
    quote: t('priceKind.quote', 'Price on request'),
  };
  const hints = {
    fixed: t('priceKind.fixedHint', 'Customers order at this price.'),
    from: t('priceKind.fromHint', 'Customers order at the starting price, and you confirm the final price on the order.'),
    quote: t('priceKind.quoteHint', 'No price shown. Customers ask for a price and you send it.'),
  };
  return (
    <div>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t('priceKind.label', 'How is it priced?')}>
        {KINDS.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={v === k} onClick={() => onChange(k)}
                  className="px-3 min-h-[36px] rounded-full border text-xs font-semibold"
                  style={v === k ? { background: 'var(--ink)', color: '#fff', borderColor: 'var(--ink)' } : { borderColor: 'var(--brand-border)', color: 'var(--ink)', background: '#fff' }}
                  data-testid={testid ? `${testid}-${k}` : undefined}>
            {labels[k]}
          </button>
        ))}
      </div>
      <p className="text-[11px] mt-1" style={{ color: 'var(--brand-muted)' }}>{hints[v]}</p>
    </div>
  );
}
