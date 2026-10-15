/**
 * Design your page → your own colour and fonts (Tzvi, 15 Oct 2026: "brand
 * colours and fonts"). Sits under the four ready-made colours. The colour
 * is checked for readability as it is picked (utils/businessAccent.js
 * brandColors): the owner sees the text colour the page will use on it.
 * Each font is shown in itself, in the language the owner is using.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { brandColors } from '../../utils/businessAccent';
import { HEADING_FONTS, BODY_FONTS, faceStack, useFontsLoaded } from '../../utils/brandFonts';

const HEX = /^#[0-9a-fA-F]{6}$/;

function FontChoices({ list, value, onChange, sample, testid, siteLabel }) {
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" data-testid={testid}>
      <button type="button" role="radio" aria-checked={!value} onClick={() => onChange(null)}
              className="text-start rounded-lg border-2 px-3 py-2 min-h-[44px]" style={{ borderColor: !value ? 'var(--ink)' : 'var(--brand-border)' }}>
        <span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>{siteLabel}</span>
        <span className="block text-base truncate" style={{ color: 'var(--ink)' }}>{sample}</span>
      </button>
      {Object.entries(list).map(([key, f]) => (
        <button key={key} type="button" role="radio" aria-checked={value === key} onClick={() => onChange(key)}
                className="text-start rounded-lg border-2 px-3 py-2 min-h-[44px]" style={{ borderColor: value === key ? 'var(--ink)' : 'var(--brand-border)' }}
                data-testid={`${testid}-${key}`}>
          <span className="block text-xs" style={{ color: 'var(--brand-muted)' }}>{f.family}</span>
          <span className="block text-base truncate" style={{ color: 'var(--ink)', fontFamily: faceStack(f) }}>{sample}</span>
        </button>
      ))}
    </div>
  );
}

export default function BrandStyleEditor({ color, onColor, fonts, onFonts, businessName }) {
  const { t } = useTranslation();
  useFontsLoaded([...Object.values(HEADING_FONTS), ...Object.values(BODY_FONTS)]);
  const brand = brandColors(color);
  const sample = businessName || t('brand.sample', 'Your business');
  const [draft, setDraft] = React.useState(color || '');
  React.useEffect(() => { setDraft(color || ''); }, [color]);

  return (
    <>
      <div className="mt-4" data-testid="brand-color">
        <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>{t('brand.ownColour', 'Or your own colour')}</p>
        <div className="flex items-center gap-2">
          <input type="color" value={brand ? color : '#1E5F8C'} onChange={(e) => onColor(e.target.value.toUpperCase())}
                 className="w-12 h-12 rounded-xl border cursor-pointer p-1 bg-white" style={{ borderColor: brand ? 'var(--ink)' : 'var(--brand-border)' }}
                 aria-label={t('brand.pick', 'Pick your colour')} data-testid="brand-color-picker" />
          <input value={draft} onChange={(e) => { const v = e.target.value.trim(); setDraft(v); if (HEX.test(v)) onColor(v.toUpperCase()); }}
                 placeholder="#1E5F8C" maxLength={7} dir="ltr" className="w-28 px-3 py-2 rounded-lg border text-sm min-h-[44px]"
                 style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} aria-label={t('brand.hex', 'Colour code')} data-testid="brand-color-hex" />
          {brand && (
            <button type="button" onClick={() => onColor(null)} className="text-xs underline" style={{ color: 'var(--brand-muted)' }} data-testid="brand-color-clear">
              {t('brand.clear', 'Use a ready-made colour')}
            </button>
          )}
        </div>
        {brand && (
          <p className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold" style={{ background: brand.tint, color: brand.on }} data-testid="brand-color-sample">
            <Check size={13} /> {t('brand.readable', 'Text on it stays readable')}
          </p>
        )}
        <p className="text-xs mt-1.5" style={{ color: 'var(--brand-muted)' }}>
          {t('brand.colourHint', 'Your logo’s colour, for example. We pick white or dark text on it so it always reads.')}
        </p>
      </div>

      <section className="pt-5 mt-5 border-t" style={{ borderColor: 'var(--brand-border)' }} data-testid="brand-fonts">
        <h3 className="text-sm font-bold" style={{ color: 'var(--ink)' }}>{t('brand.fonts', 'Fonts')}</h3>
        <p className="text-xs mt-0.5 mb-2" style={{ color: 'var(--brand-muted)' }}>
          {t('brand.fontsHint', 'Every font here has Hebrew and English letters, so your page looks the same in both.')}
        </p>
        <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--ink)' }}>{t('brand.headings', 'Headings and your name')}</p>
        <FontChoices list={HEADING_FONTS} value={fonts.heading} onChange={(v) => onFonts((f) => ({ ...f, heading: v }))}
                     sample={sample} testid="brand-font-heading" siteLabel={t('brand.siteFont', 'The site’s font')} />
        <p className="text-xs font-semibold mt-4 mb-1.5" style={{ color: 'var(--ink)' }}>{t('brand.text', 'Text')}</p>
        <FontChoices list={BODY_FONTS} value={fonts.body} onChange={(v) => onFonts((f) => ({ ...f, body: v }))}
                     sample={t('brand.textSample', 'Fresh every Friday')} testid="brand-font-body" siteLabel={t('brand.siteFont', 'The site’s font')} />
      </section>
    </>
  );
}
