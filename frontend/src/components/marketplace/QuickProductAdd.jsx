/**
 * "Have a lot to add?" - the quick ways to add many products at once:
 * a photo per product, a pasted price list, or a photo of the menu.
 *
 * Shared by the listing wizard (CreateGig) and the edit window
 * (EditListingModal). It was wizard-only at first, which left a shop
 * that already existed adding its 28th product one row at a time (The
 * Gift Boutique, 22 Oct 2026). The parent owns the products: this only
 * hands back the chosen photo files (`onPhotos`) and asks the parent to
 * read a list (`onExtract({ text } | { files })`, resolving true when rows
 * came back). Up to 15 pages of a catalog at once (WhatsApp catalog screenshots, 23 Nov 2026); each item's picture is cut
 * out of the page when it is big enough (10 Nov 2026). `onPhotos` is
 * optional: a service's list has no "one photo each" button.
 *
 * A catalog for one time of year (Tzvi, 15 Nov 2026: "a Chanukah catalog"): with `seasonal` (a store), a tick
 * opens a name and two dates; everything read or added in this box then joins that kind and is on sale only
 * between those dates (backend seasonal.py hides it outside them). It is handed to the parent as the second
 * argument, `onPhotos(files, season)` / `onExtract({ ... }, season)`; null when not ticked.
 */
import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Camera, FileText, ImagePlus, Loader2 } from 'lucide-react';

export default function QuickProductAdd({ onPhotos, onExtract, bulkPhotos, extracting, seasonal = false, testid = 'wizard-products' }) {
  const { t } = useTranslation();
  // The paste box, closed until asked for. Open by default it would read
  // as the main way in, and for a business with three products the rows
  // are quicker than any of this.
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const bulkRef = useRef(null);
  const listShotRef = useRef(null);
  const [season, setSeason] = useState({ on: false, name: '', from: '', until: '' });
  const seasonOf = () => (seasonal && season.on ? season : null);
  // dates are needed for it to mean anything; a name alone would just be a kind
  const seasonBad = seasonal && season.on && (!season.from || !season.until || season.until < season.from);
  const busy = bulkPhotos || extracting || seasonBad;
  const btn = 'inline-flex items-center gap-1.5 px-3 min-h-[40px] rounded-lg border border-gray-300 bg-white text-sm font-semibold disabled:opacity-50';

  return (
    <div className="rounded-xl border border-gray-200 p-3 space-y-2" data-testid={`${testid}-quick`}>
      <p className="text-[11px] font-semibold text-gray-600">
        {t('wizard.quickTitle', 'Have a lot to add?')}
      </p>
      {seasonal && (
        <div className="space-y-2" data-testid={`${testid}-season`}>
          <label className="flex items-center gap-2 min-h-[40px] text-sm cursor-pointer">
            <input type="checkbox" className="w-5 h-5" checked={season.on} onChange={(e) => setSeason({ ...season, on: e.target.checked })}
              data-testid={`${testid}-season-on`} />
            {t('wizard.seasonOn', 'This is a catalog for one time of year, like Chanukah')}
          </label>
          {season.on && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <label className="text-xs text-gray-600">{t('wizard.seasonName', 'Name')}
                <input type="text" dir="auto" value={season.name} maxLength={40} onChange={(e) => setSeason({ ...season, name: e.target.value })}
                  placeholder={t('wizard.seasonNamePh', 'Chanukah')} className="mt-1 w-full px-3 min-h-[40px] rounded-lg border border-gray-300 text-base"
                  data-testid={`${testid}-season-name`} />
              </label>
              <label className="text-xs text-gray-600">{t('editListing.seasonFrom', 'On sale from')}
                <input type="date" value={season.from} onChange={(e) => setSeason({ ...season, from: e.target.value })}
                  className="mt-1 w-full px-3 min-h-[40px] rounded-lg border border-gray-300 text-base" data-testid={`${testid}-season-from`} />
              </label>
              <label className="text-xs text-gray-600">{t('wizard.seasonUntil', 'Last day to order')}
                <input type="date" value={season.until} min={season.from || undefined} onChange={(e) => setSeason({ ...season, until: e.target.value })}
                  className="mt-1 w-full px-3 min-h-[40px] rounded-lg border border-gray-300 text-base" data-testid={`${testid}-season-until`} />
              </label>
            </div>
          )}
          {season.on && (
            <p className="text-[11px] text-gray-500">
              {seasonBad
                ? t('wizard.seasonNeedDates', 'Choose both dates first.')
                : t('wizard.seasonNote', 'Everything you add below joins this catalog. Customers see it only between these dates; you always see it here, ready for next year.')}
            </p>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {onPhotos && (
          <>
            <button type="button" disabled={busy} onClick={() => bulkRef.current?.click()}
              className={btn} data-testid={`${testid}-from-photos`}>
              {bulkPhotos ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
              {t('wizard.photosAsProducts', 'Add photos, one product each')}
            </button>
            <input ref={bulkRef} type="file" accept="image/*" multiple className="hidden"
              onChange={(e) => { onPhotos(e.target.files, seasonOf()); e.target.value = ''; }}
              data-testid={`${testid}-photos-input`} />
          </>
        )}

        <button type="button" disabled={busy} onClick={() => setPasteOpen(!pasteOpen)}
          className={btn} aria-expanded={pasteOpen} data-testid={`${testid}-paste-toggle`}>
          <FileText size={14} />
          {t('wizard.pasteList', 'Paste your price list')}
        </button>

        <button type="button" disabled={busy} onClick={() => listShotRef.current?.click()}
          className={btn} data-testid={`${testid}-from-shot`}>
          {extracting ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          {t('wizard.shotOfCatalog', 'Screenshots of your WhatsApp catalog, or photos of your menu')}
        </button>
        <input ref={listShotRef} type="file" accept="image/*" multiple className="hidden"
          onChange={(e) => { const f = Array.from(e.target.files || []).slice(0, 15); e.target.value = ''; if (f.length) onExtract({ files: f }, seasonOf()); }}
          data-testid={`${testid}-shot-input`} />
      </div>

      {pasteOpen && (
        <div className="pt-1 space-y-2">
          <textarea rows={4} dir="auto" value={pasted} onChange={(e) => setPasted(e.target.value)}
            placeholder={t('wizard.pastePh', 'One per line, or straight out of a WhatsApp message. Classic board 180, Family board 280, Kids board 90')}
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm"
            data-testid={`${testid}-paste`} />
          <button type="button" disabled={busy || !pasted.trim()}
            onClick={async () => { if (await onExtract({ text: pasted.trim() }, seasonOf())) { setPasted(''); setPasteOpen(false); } }}
            className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--brand-primary)' }} data-testid={`${testid}-paste-read`}>
            {extracting && <Loader2 size={14} className="animate-spin" />}
            {t('wizard.readList', 'Turn this into products')}
          </button>
        </div>
      )}

      <p className="text-[11px] text-gray-500">
        {t('wizard.quickNoteCatalog', 'Up to 15 pictures at once: scroll your WhatsApp catalog and screenshot each screen. We read the names, prices and sections, and cut out each photo. Check them, then add any photo that is missing.')}
      </p>
    </div>
  );
}
