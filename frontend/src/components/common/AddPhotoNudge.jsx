/**
 * "Add a photo" — the invitation from spec S4.
 *
 * Shown in the provider's own dashboard on a gig (later: a business) that
 * has no photo. One line, one action, dismissible, and no invented
 * statistic: it says a photo gets noticed first, which is a design claim
 * about the grid, not a number nobody measured.
 *
 * It UPLOADS rather than linking away, because there is nowhere to link
 * to: the dashboard can create a gig and delete a gig, but has no edit
 * screen, so "Add a photo →" would have led to a page that cannot do it.
 * A nudge that cannot be acted on is worse than no nudge.
 *
 * Per S5 this is an invitation and never a gate — nothing here hides,
 * filters or down-ranks a listing for having no photo, and nothing
 * anywhere else should either.
 */
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImagePlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { uploadFilesFast } from '../../utils/fastUpload';

// Dismissals live per item, so clearing one nudge never silences the
// others — and a listing that gains a photo simply stops qualifying.
const dismissKey = (id) => `photo_nudge_dismissed_${id}`;

export default function AddPhotoNudge({
  itemId,
  API,
  token,
  onUploaded,
  testidPrefix = 'add-photo',
}) {
  const { t } = useTranslation();
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(dismissKey(itemId)) === '1'; } catch { return false; }
  });

  if (dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(dismissKey(itemId), '1'); } catch { /* private mode */ }
  };

  const pick = async (files) => {
    const file = files && files[0];
    if (!file) return;
    setBusy(true);
    try {
      const [url] = await uploadFilesFast([file], API, token);
      if (!url) throw new Error('upload returned nothing');
      await onUploaded(url);
      toast.success(t('photoNudge.added', 'Photo added'));
    } catch {
      toast.error(t('photoNudge.failed', "That photo didn't upload — try again"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
      style={{ background: 'rgb(var(--brand-primary-rgb) / 0.06)', color: 'var(--ink)' }}
      data-testid={`${testidPrefix}-nudge`}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => pick(e.target.files)}
        data-testid={`${testidPrefix}-input`}
      />
      <span className="flex-1 leading-snug">
        {t('photoNudge.body', 'Businesses with a photo get noticed first.')}
      </span>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="inline-flex items-center gap-1 font-semibold shrink-0 disabled:opacity-60"
        style={{ color: 'var(--brand-primary)' }}
        data-testid={`${testidPrefix}-action`}
      >
        {busy ? <Loader2 size={12} className="animate-spin" /> : <ImagePlus size={12} />}
        {t('photoNudge.action', 'Add a photo')}
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('photoNudge.dismiss', 'Dismiss')}
        className="shrink-0 p-0.5 rounded hover:bg-black/5"
        style={{ color: 'var(--brand-muted)' }}
        data-testid={`${testidPrefix}-dismiss`}
      >
        <X size={12} />
      </button>
    </div>
  );
}
