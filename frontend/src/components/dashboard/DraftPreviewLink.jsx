/**
 * Design your page → see the draft on a phone (backend businesses.py
 * public_business ?draft=). Shown once a draft is saved: a QR code to scan
 * from the computer, the link to copy or send, and a button to open it.
 * The link stops working when the draft is published or thrown away.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { Smartphone, Copy, ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';

export default function DraftPreviewLink({ slug, token }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  if (!token || !slug) return null;
  const url = `${window.location.origin}/business/${slug}?draft=${encodeURIComponent(token)}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); toast.success(t('referrals.copied', 'Link copied')); } catch { /* blocked */ }
  };
  return (
    <section className="rounded-xl border" style={{ borderColor: 'var(--brand-border)' }} data-testid="draft-preview-link">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="w-full flex items-center justify-between gap-2 px-3 min-h-[44px] text-start">
        <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
          <Smartphone size={15} aria-hidden="true" /> {t('pageDesign.previewTitle2', 'See your draft on your phone')}
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>
      {open && (
        <div className="px-3 pb-3 flex gap-3 items-start">
          <div className="p-2 bg-white rounded-lg border shrink-0" style={{ borderColor: 'var(--brand-border)' }}>
            <QRCodeSVG value={url} size={104} level="M" />
          </div>
          <div className="min-w-0 space-y-2">
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
              {t('pageDesign.previewHint', 'Scan with your phone, or send the link to someone to look at. Customers still see the live page. The link stops working once you publish.')}
            </p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-full border text-xs font-semibold"
                      style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="draft-preview-copy">
                <Copy size={13} /> {t('referrals.copy', 'Copy link')}
              </button>
              <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-full border text-xs font-semibold"
                 style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="draft-preview-open">
                <ExternalLink size={13} /> {t('pageDesign.previewOpen', 'Open')}
              </a>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
