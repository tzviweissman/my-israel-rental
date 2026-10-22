/**
 * "Have a lot to add?" - the quick ways to add many products at once:
 * a photo per product, a pasted price list, or a photo of the menu.
 *
 * Shared by the listing wizard (CreateGig) and the edit window
 * (EditListingModal). It was wizard-only at first, which left a shop
 * that already existed adding its 28th product one row at a time (The
 * Gift Boutique, 22 Oct 2026). The parent owns the products: this only
 * hands back the chosen photo files (`onPhotos`) and asks the parent to
 * read a list (`onExtract({ text } | { file })`, resolving true when rows
 * came back).
 */
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, FileText, ImagePlus, Loader2 } from 'lucide-react';

export default function QuickProductAdd({ onPhotos, onExtract, bulkPhotos, extracting, testid = 'wizard-products' }) {
  const { t } = useTranslation();
  // The paste box, closed until asked for. Open by default it would read
  // as the main way in, and for a business with three products the rows
  // are quicker than any of this.
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const bulkRef = useRef(null);
  const listShotRef = useRef(null);
  const busy = bulkPhotos || extracting;
  const btn = 'inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg border border-gray-300 bg-white text-sm font-semibold disabled:opacity-50';

  return (
    <div className="rounded-xl border border-gray-200 p-3 space-y-2" data-testid={`${testid}-quick`}>
      <p className="text-[11px] font-semibold text-gray-600">
        {t('wizard.quickTitle', 'Have a lot to add?')}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy} onClick={() => bulkRef.current?.click()}
          className={btn} data-testid={`${testid}-from-photos`}>
          {bulkPhotos ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
          {t('wizard.photosAsProducts', 'Add photos, one product each')}
        </button>
        <input ref={bulkRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { onPhotos(e.target.files); e.target.value = ''; }}
          data-testid={`${testid}-photos-input`} />

        <button type="button" disabled={busy} onClick={() => setPasteOpen(!pasteOpen)}
          className={btn} aria-expanded={pasteOpen} data-testid={`${testid}-paste-toggle`}>
          <FileText size={14} />
          {t('wizard.pasteList', 'Paste your price list')}
        </button>

        <button type="button" disabled={busy} onClick={() => listShotRef.current?.click()}
          className={btn} data-testid={`${testid}-from-shot`}>
          {extracting ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          {t('wizard.shotOfList', 'Photo of your menu or price list')}
        </button>
        <input ref={listShotRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onExtract({ file: f }); }}
          data-testid={`${testid}-shot-input`} />
      </div>

      {pasteOpen && (
        <div className="pt-1 space-y-2">
          <textarea rows={4} dir="auto" value={pasted} onChange={(e) => setPasted(e.target.value)}
            placeholder={t('wizard.pastePh', 'One per line, or straight out of a WhatsApp message. Classic board 180, Family board 280, Kids board 90')}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
            data-testid={`${testid}-paste`} />
          <button type="button" disabled={busy || !pasted.trim()}
            onClick={async () => { if (await onExtract({ text: pasted.trim() })) { setPasted(''); setPasteOpen(false); } }}
            className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--brand-primary)' }} data-testid={`${testid}-paste-read`}>
            {extracting && <Loader2 size={14} className="animate-spin" />}
            {t('wizard.readList', 'Turn this into products')}
          </button>
        </div>
      )}

      <p className="text-[11px] text-gray-500">
        {t('wizard.quickNote', 'Reading a list gives you the names and prices. Photos still come from you, so the quickest order is photos first, then the list.')}
      </p>
    </div>
  );
}
