import React, { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import SCENES from './scenes';
import useCinematicScroll, { useSceneVideos } from './useCinematicScroll';

/**
 * The five pinned scenes of the cinematic home page.
 *
 * Each scene is a tall section containing a `position: sticky` pin: the
 * section provides scroll distance, the pin holds the viewport-filling
 * picture still while that distance is consumed. That is the whole trick —
 * there is no scroll-jacking, so the scrollbar, keyboard paging and
 * find-in-page all behave normally.
 *
 * Reduced motion is decided ONCE here and passed down, rather than each
 * piece asking independently. The video, the zoom and the caption fades have
 * to agree: a paused video under a still-zooming frame is worse than either
 * on its own.
 */
const CinematicScenes = ({ reducedMotion }) => {
  const { t } = useTranslation();
  const root = useRef(null);

  useCinematicScroll(root, { enabled: !reducedMotion });
  useSceneVideos(root, { enabled: !reducedMotion });

  return (
    <div ref={root}>
      {SCENES.map((scene) => (
        <section
          key={scene.key}
          className="scene"
          data-scene={scene.dataScene || scene.key}
          style={{ height: `${scene.heightVh}vh` }}
        >
          <div className="pin">
            <video
              // `data-layer` rather than a class hook: the engine addresses
              // these two layers by role, and a class is a styling concern
              // that a restyle could rename out from under it.
              data-layer={scene.dataScene === 'villa' ? 'villa' : undefined}
              muted
              playsInline
              loop={scene.loop}
              preload={scene.key === 'villa' ? 'auto' : 'metadata'}
              poster={scene.poster}
              aria-hidden="true"
            >
              <source src={scene.video} type="video/mp4" />
            </video>

            {/* Villa only: the interior we zoom through the wall into. A
                still, not a second video — it only ever appears fully
                dissolved, so a video's first frame would be wasted bytes. */}
            {scene.still && (
              <div
                className="still"
                data-layer="interior"
                style={{ backgroundImage: `url('${scene.still}')`, opacity: 0 }}
                aria-hidden="true"
              />
            )}

            <div className="shade" />
            <div className="vig" />

            {scene.texts.map((txt) => (
              <div className="txt" data-seg={txt.seg} key={txt.key}>
                <div className="kick">{t(`home.scenes.${txt.key}.kick`)}</div>
                <h2>
                  {t(`home.scenes.${txt.key}.h2`)}{' '}
                  <span className="a">{t(`home.scenes.${txt.key}.accent`)}</span>
                </h2>
                {/* Not every caption has body copy — the villa's second beat
                    is deliberately just a headline. `defaultValue: ''` keeps
                    i18next from rendering the key name when it's absent. */}
                {t(`home.scenes.${txt.key}.p`, { defaultValue: '' }) && (
                  <p>{t(`home.scenes.${txt.key}.p`)}</p>
                )}
              </div>
            ))}

            {scene.notes.length > 0 && (
              <div className="note">
                {scene.notes.map((n) => (
                  <div className="ncard" data-seg={n.seg} key={n.key}>
                    <div className={`from${n.wa ? ' wa' : ''}`}>
                      {t(`home.scenes.${n.key}.from`)}
                    </div>
                    <div className="msg">{t(`home.scenes.${n.key}.msg`)}</div>
                    {/* The contract card has a different shape from a
                        notification: a signature line and a verified pill
                        instead of a timestamp. Both classes are already in
                        the ported CSS. */}
                    {n.sig ? (
                      <>
                        <div className="sig">{t(`home.scenes.${n.key}.sig`)}</div>
                        <div className="ok">{t(`home.scenes.${n.key}.ok`)}</div>
                      </>
                    ) : (
                      <div className="meta">{t(`home.scenes.${n.key}.meta`)}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
};

export default CinematicScenes;
