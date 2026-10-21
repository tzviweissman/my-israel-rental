/**
 * "Message them on WhatsApp about this order" — shown on the order and
 * booking confirmation pages, AFTER the thing has been placed on the site.
 *
 * The shape Tzvi chose on 21 Oct 2026, after production showed 68 WhatsApp
 * taps against 2 on-site orders: order here, then talk on WhatsApp. The
 * conversation still happens where Israelis expect it, but the order, the
 * customer and the follow-ups (tracking, review, order again) stay with
 * the site, and the message arrives with the order already written in it.
 *
 * Goes through /marketplace/gigs/{id}/contact, which counts the tap and
 * holds the number (the page never sees it). `after` marks the tap as
 * following an order, so it is not counted as a customer leaving.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { API } from '../../lib/apiBase';

const WA_GREEN = '#25D366';

export default function WhatsAppAboutThis({ gigId, after, text, label, testid = 'wa-about-this' }) {
  const { t } = useTranslation();
  if (!gigId) return null;
  const href = `${API}/marketplace/gigs/${encodeURIComponent(gigId)}/contact`
    + `?after=${after}&text=${encodeURIComponent(text || '')}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
       className="mt-3 flex items-center justify-center gap-2 w-full min-h-[48px] rounded-full border bg-white text-sm font-semibold"
       style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
       data-testid={testid}>
      <MessageCircle size={16} style={{ color: WA_GREEN }} aria-hidden="true" />
      {label || t('afterOrder.whatsapp', 'Message them on WhatsApp about this')}
    </a>
  );
}
