/**
 * "Send this link in a message" — the row under the QR in the share
 * popovers.
 *
 * Three ways out, in order of how people actually send things here:
 * WhatsApp (the message channel in Israel), the device's own share sheet
 * where one exists (navigator.share — phones mostly), and plain copy.
 * The share-sheet button hides rather than disables on desktop browsers
 * that lack the API: a button that can never work is not an affordance.
 *
 * The prefilled text is just the link. It is the OWNER's message to their
 * own contact — putting marketing copy in their mouth is how a share
 * button stops being used.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Copy, Share2 } from 'lucide-react';
import { toast } from 'sonner';

// WhatsApp's own brand green, same constant used elsewhere in the app.
const WA_GREEN = '#25D366';

export default function ShareLinkButtons({ url, testidPrefix = 'qr' }) {
  const { t } = useTranslation();
  if (!url) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    toast.success(t('qr.linkCopied', 'Link copied'));
  };

  const nativeShare = () => {
    navigator.share({ url }).catch(() => {
      /* user closed the sheet — not an error */
    });
  };

  return (
    <div className="flex items-stretch gap-2">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white"
        style={{ background: WA_GREEN }}
        data-testid={`${testidPrefix}-share-whatsapp`}
      >
        {/* WhatsApp glyph, inline so no icon-font dependency. */}
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.52.149-.174.198-.298.297-.497.1-.198.05-.371-.025-.52-.074-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.172-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
        </svg>
        {t('qr.sendWhatsApp', 'WhatsApp')}
      </a>
      {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
        <button
          type="button"
          onClick={nativeShare}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold text-white"
          style={{ background: 'var(--brand-primary)' }}
          data-testid={`${testidPrefix}-share-native`}
        >
          <Share2 size={13} aria-hidden="true" />
          {t('qr.sendShare', 'Share…')}
        </button>
      )}
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border"
        style={{ borderColor: 'var(--brand-border)', color: 'var(--brand-primary)', background: '#fff' }}
        data-testid={`${testidPrefix}-share-copy`}
      >
        <Copy size={13} aria-hidden="true" />
        {t('qr.copyShort', 'Copy link')}
      </button>
    </div>
  );
}
