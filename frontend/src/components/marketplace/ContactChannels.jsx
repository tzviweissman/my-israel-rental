/**
 * The three ways to reach a provider: WhatsApp, email, and messaging on
 * the site.
 *
 * Why this exists: contact used to be an either/or — a gig was "WhatsApp"
 * OR "on-site" — and the WhatsApp side only checked that the number was
 * the right SHAPE. A landline, or a mobile with no WhatsApp account,
 * passes that check perfectly and then dead-ends on wa.me with "this
 * number is not on WhatsApp". Providers had been publishing exactly those,
 * and neither they nor the buyer found out; the enquiry simply never
 * arrived.
 *
 * So the channels are opt-in and additive now. The server decides which
 * are available (see contact_channels in backend/routes/marketplace/
 * shared.py) and this renders what it is told, in a fixed order.
 *
 * On-site messaging is always last in the list and always present: it
 * needs no external account, cannot be mistyped, and reaches someone who
 * is already signed in. It is the one channel that cannot silently fail,
 * which is exactly why it is never removed.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail, MessageCircle, Send } from 'lucide-react';

const WA_GREEN = '#25D366';

export default function ContactChannels({
  channels = [],
  onWhatsApp,
  email,
  onMessage,
  busy = false,
  testidPrefix = 'contact',
}) {
  const { t } = useTranslation();
  const has = (c) => channels.includes(c);

  // Nothing renders for an empty list rather than a lone dead button —
  // but the server always includes in_platform, so this is defensive.
  if (!channels.length) return null;

  return (
    <div className="space-y-2" data-testid={`${testidPrefix}-channels`}>
      {has('whatsapp') && (
        <button
          type="button"
          onClick={onWhatsApp}
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: WA_GREEN }}
          data-testid={`${testidPrefix}-whatsapp`}
        >
          <MessageCircle size={15} aria-hidden="true" />
          {t('contact.whatsapp', 'WhatsApp')}
        </button>
      )}

      {has('email') && email && (
        <a
          href={`mailto:${email}`}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold border"
          style={{
            borderColor: 'var(--brand-border)',
            color: 'var(--brand-primary)',
            background: '#fff',
          }}
          data-testid={`${testidPrefix}-email`}
        >
          <Mail size={15} aria-hidden="true" />
          {t('contact.email', 'Email')}
        </a>
      )}

      <button
        type="button"
        onClick={onMessage}
        disabled={busy}
        className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: 'var(--brand-primary)' }}
        data-testid={`${testidPrefix}-in-platform`}
      >
        <Send size={15} aria-hidden="true" />
        {t('contact.onSite', 'Message on MyIsraelRental')}
      </button>

      <p className="text-[11px] text-center" style={{ color: 'var(--brand-muted)' }}>
        {t('contact.note', 'Messages on the site always reach them — no phone number needed.')}
      </p>
    </div>
  );
}
