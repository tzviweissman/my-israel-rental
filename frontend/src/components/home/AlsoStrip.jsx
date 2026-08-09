import React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * "Also on MyIsraelRental" — the capabilities strip between the Requests
 * scene and the limestone finale.
 *
 * Its job is transitional as much as informational: it is the last dark
 * surface, so it carries the eye out of the film and into the page instead
 * of cutting straight from video to limestone.
 *
 * Structure is the preview's exactly — a div of spans, not a ul/li. I tried
 * the list markup first for the screen-reader win, but the ported CSS styles
 * `.also-grid span` as the flex child, and wrapping each span in an <li>
 * makes the <li> the flex item instead: the pills lose their layout and pick
 * up list styling. Changing the CSS to suit the markup would mean it is no
 * longer the preview's, which is the one thing this port must not do. Eight
 * decorative capability chips are a thin case for list semantics anyway.
 *
 * The emoji stay INSIDE the translated strings rather than being split out.
 * They are part of each phrase's rhythm, and a Hebrew translator may want to
 * move or drop one — hoisting them into the component would remove that
 * choice.
 *
 * No storage pill: storage rentals are a discontinued offering per
 * CLAUDE.md, so it is absent rather than hidden behind a flag.
 */
const PILL_KEYS = [
  'shabbat',
  'savedSearch',
  'chat',
  'map',
  'ical',
  'reviews',
  'subleases',
  'bulk',
];

const AlsoStrip = () => {
  const { t } = useTranslation();

  return (
    <section className="also" aria-labelledby="also-title">
      <div className="also-in">
        <div className="kick" style={{ color: 'var(--gold)' }}>
          {t('home.also.kick', "And that's not all")}
        </div>
        <h2 id="also-title">{t('home.also.title', 'Also on MyIsraelRental')}</h2>
        <div className="also-grid">
          {PILL_KEYS.map((key) => (
            <span key={key}>{t(`home.also.${key}`)}</span>
          ))}
        </div>
      </div>
    </section>
  );
};

export default AlsoStrip;
