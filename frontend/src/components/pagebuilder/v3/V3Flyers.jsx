/**
 * "From the business": their flyers, posters and menus, shown whole.
 *
 * docs/page-builder-design-rules.md, part 4: a picture with baked-in text is
 * never the hero and is never cropped. The flyer check (backend
 * utils/flyer_check.py) marked these; here they are drawn at their own shape
 * (object-fit: contain), ungraded, as the business made them. Renders nothing
 * when there are none.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';

import { themeVars } from './V3Hero';
import { fxFor } from './effects';

export default function V3Flyers({ brief, urls, name }) {
  const { t } = useTranslation();
  if (!brief || !urls || urls.length === 0) return null;
  return (
    <section className="pv3-flyers" data-page-v3="" data-fx={fxFor(brief, 'flyers')} style={themeVars(brief)} data-testid="pv3-flyers">
      <div className="pv3-flyers-inner">
        <p className="pv3-label">{t('pageV3.fromTheBusiness', 'From the business')}</p>
        <div className="pv3-flyers-row">
          {urls.map((url) => (
            <figure key={url} className="pv3-flyer">
              <img src={url} alt={t('pageV3.flyerAlt', { defaultValue: 'A flyer from {{name}}', name })} loading="lazy" />
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
