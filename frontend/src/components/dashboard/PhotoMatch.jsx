/**
 * Make my photos match: puts one item photo on a plain background.
 *
 * The owner picks a colour (a few plain ones, or their own), sees the
 * before and after side by side, and only "Use this photo" swaps it into
 * the editor. Nothing is stored on the listing until they press Save, and
 * a tidied photo can always be put back to the original, which the server
 * keeps (backend/routes/marketplace/photo_match.py).
 */
import React, { useState } from 'react';
import axios from 'axios';
import { X, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const PLAIN = ['FFFFFF', 'F3F4F6', 'F5EEE3', 'E9DCC8'];

export default function PhotoMatch({ API, token, gigId, url, state, onUse, onDone, onClose }) {
  const { t } = useTranslation();
  const original = state.originals?.[url];
  const [color, setColor] = useState(state.color || 'FFFFFF');
  const [after, setAfter] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const swatches = PLAIN.includes(color) ? PLAIN : [...PLAIN, color];
  const left = state.left_today ?? 0;

  const make = async () => {
    setBusy(true);
    setError('');
    try {
      const { data } = await axios.post(`${API}/marketplace/gigs/${gigId}/photo-match`,
        { url, color }, { headers: { Authorization: `Bearer ${token}` } });
      setAfter(data.url);
      onDone(data);
    } catch (e) {
      setError(e?.response?.data?.detail || t('photoMatch.failed', "We couldn't tidy this photo. Please try again later."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true"
      aria-labelledby="photo-match-title" data-testid="photo-match"
      // Rendered inside the editor's backdrop, which closes the editor on
      // click: stop here so a click in this dialog never closes both.
      onClick={(e) => { e.stopPropagation(); if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-lg max-h-full overflow-y-auto rounded-2xl p-5" style={{ background: 'var(--surface)' }}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <h3 id="photo-match-title" className="text-lg font-semibold" style={{ fontFamily: 'var(--font-head)' }}>
            {t('photoMatch.title', 'Plain background')}
          </h3>
          <button type="button" onClick={onClose} aria-label={t('photoMatch.close', 'Close')} className="p-1" data-testid="photo-match-close">
            <X size={18} />
          </button>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--brand-muted)' }}>
          {t('photoMatch.lead', 'We cut out your item and put it on a plain colour. The item itself is not changed.')}
        </p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          {[[t('photoMatch.before', 'Before'), url], [t('photoMatch.after', 'After'), after]].map(([label, src]) => (
            <figure key={label} className="m-0">
              <div className="aspect-square rounded-lg overflow-hidden flex items-center justify-center" style={{ background: 'var(--surface-muted)' }}>
                {src
                  ? <img src={src} alt="" className="w-full h-full object-contain" />
                  : busy ? <Loader2 size={20} className="animate-spin" aria-label={t('photoMatch.working', 'Working')} />
                    : <span className="w-10 h-10 rounded-full border" style={{ background: `#${color}`, borderColor: 'var(--brand-border)' }} />}
              </div>
              <figcaption className="text-xs mt-1" style={{ color: 'var(--brand-muted)' }}>{label}</figcaption>
            </figure>
          ))}
        </div>

        <fieldset className="mb-4">
          <legend className="text-sm font-medium mb-2">{t('photoMatch.colour', 'Background colour')}</legend>
          <div className="flex flex-wrap items-center gap-2">
            {swatches.map((c) => (
              <button key={c} type="button" onClick={() => { setColor(c); setAfter(null); }}
                className="w-9 h-9 rounded-full border-2"
                style={{ background: `#${c}`, borderColor: c === color ? 'var(--ink)' : 'var(--brand-border)' }}
                aria-label={`#${c}`} aria-pressed={c === color} data-testid={`photo-match-swatch-${c}`} />
            ))}
            <label className="flex items-center gap-2 text-sm cursor-pointer ms-1">
              <input type="color" value={`#${color.toLowerCase()}`}
                onChange={(e) => { setColor(e.target.value.slice(1).toUpperCase()); setAfter(null); }}
                className="w-9 h-9 p-0 border-0 bg-transparent cursor-pointer" data-testid="photo-match-own" />
              {t('photoMatch.own', 'Your own colour')}
            </label>
          </div>
        </fieldset>

        {error && <p className="text-sm mb-3 text-red-700" role="alert" data-testid="photo-match-error">{error}</p>}

        <div className="flex flex-wrap items-center gap-2">
          {after ? (
            <button type="button" className="btn-primary px-4 py-2 rounded-lg text-sm" onClick={() => onUse(after)} data-testid="photo-match-use">
              {t('photoMatch.use', 'Use this photo')}
            </button>
          ) : (
            <button type="button" className="btn-primary px-4 py-2 rounded-lg text-sm disabled:opacity-50" onClick={make}
              disabled={busy || left <= 0} data-testid="photo-match-make">
              {busy ? t('photoMatch.working', 'Working') : t('photoMatch.make', 'Show me')}
            </button>
          )}
          {original && (
            <button type="button" className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--brand-border)' }}
              onClick={() => onUse(original)} data-testid="photo-match-restore">
              {t('photoMatch.restore', 'Put the original back')}
            </button>
          )}
          <button type="button" className="px-4 py-2 text-sm underline" onClick={onClose} data-testid="photo-match-keep">
            {t('photoMatch.keep', 'Keep this photo')}
          </button>
        </div>
        <p className="text-xs mt-3" style={{ color: 'var(--brand-muted)' }} data-testid="photo-match-left">
          {left > 0
            ? t('photoMatch.left', { count: left, defaultValue: '{{count}} left today' })
            : t('photoMatch.none', 'No more today. You can do more tomorrow.')}
        </p>
      </div>
    </div>
  );
}
