/**
 * "Message them on WhatsApp about this order" — order here, then talk on
 * WhatsApp (Tzvi, 21 Oct 2026, after production showed 68 WhatsApp taps
 * against 2 on-site orders).
 *
 * Two ways in:
 *   * handOffToWhatsApp: the AUTOMATIC one. Pressing Order (or Send booking
 *     request) saves it on the site and opens WhatsApp straight away with
 *     the order written into the message (Tzvi, 22 Oct: "directs them to
 *     whatsapp with an exact message for everything in their order").
 *   * <WhatsAppAboutThis>: the button on the confirmation and tracking
 *     pages, for when the automatic one was blocked or they closed it.
 *
 * Both go through /marketplace/gigs/{id}/contact, which counts the tap and
 * holds the number (the page never sees it). `after` marks the tap as
 * following an order, so it is not counted as a customer leaving.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import { API } from '../../lib/apiBase';

const WA_GREEN = '#25D366';

export const whatsAppHref = (gigId, after, text) => `${API}/marketplace/gigs/${encodeURIComponent(gigId)}/contact`
  + `?after=${after}&text=${encodeURIComponent(text || '')}`;

/** The order, as the customer sends it. `link` is their tracking page. */
export const orderMessage = (t, items, link) => t('afterOrder.orderText', {
  defaultValue: 'Hi, I just ordered from you on MyIsraelRental:\n{{items}}\nMy order: {{link}}',
  items: items || '', link, interpolation: { escapeValue: false },
});

export const bookingMessage = (t, what, when, link) => t('afterOrder.bookingText', {
  defaultValue: 'Hi, I just booked with you on MyIsraelRental: {{what}}{{when}}\nMy booking: {{link}}',
  what, when: when ? ` (${when})` : '', link, interpolation: { escapeValue: false },
});

/**
 * Open a tab NOW, inside the tap, and point it at WhatsApp once the order
 * is saved.
 *
 * Why the two steps: a browser blocks a window opened after an await (the
 * save), but allows one opened in the same moment as the tap. So the tab
 * is opened empty first and given its address when the order exists. If
 * it was blocked anyway, `go` returns false and the confirmation page's
 * button is the way through. Call only when the business HAS WhatsApp, or
 * an empty tab flashes open and shut.
 */
export function reserveWhatsAppTab() {
  let w = null;
  try { w = window.open('', '_blank'); } catch { w = null; }
  if (w) { try { w.opener = null; } catch { /* cross-origin later; fine */ } }
  return {
    go(url) {
      if (!w || w.closed) return false;
      w.location.href = url;
      return true;
    },
    close() { try { if (w && !w.closed) w.close(); } catch { /* already gone */ } },
  };
}

export default function WhatsAppAboutThis({ gigId, after, text, label, testid = 'wa-about-this' }) {
  const { t } = useTranslation();
  if (!gigId) return null;
  return (
    <a href={whatsAppHref(gigId, after, text)} target="_blank" rel="noopener noreferrer"
       className="mt-3 flex items-center justify-center gap-2 w-full min-h-[48px] rounded-full border bg-white text-sm font-semibold"
       style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }}
       data-testid={testid}>
      <MessageCircle size={16} style={{ color: WA_GREEN }} aria-hidden="true" />
      {label || t('afterOrder.whatsapp', 'Message them on WhatsApp about this')}
    </a>
  );
}
