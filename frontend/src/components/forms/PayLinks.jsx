/**
 * The business's own payment links (Bit, PayBox, …; backend
 * utils/payment_links, re-checked on the way out) as quiet outline
 * buttons, for a gift card or a deposit paid to the business directly.
 */
import React from 'react';
import { CreditCard } from 'lucide-react';

export default function PayLinks({ links, testid = 'pay-links' }) {
  if (!Array.isArray(links) || !links.length) return null;
  return (
    <div className="flex flex-wrap gap-2" data-testid={testid}>
      {links.map((p) => (
        // noopener: the destination is owner-supplied.
        <a key={p.url} href={p.url} target="_blank" rel="noopener noreferrer nofollow"
           className="inline-flex items-center gap-1.5 px-3.5 min-h-[40px] rounded-full text-sm font-semibold border bg-white"
           style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}>
          <CreditCard size={14} aria-hidden="true" /> {p.label}
        </a>
      ))}
    </div>
  );
}
