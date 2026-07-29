import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en';

// ---------------------------------------------------------------------------
// Lazy language loading
//
// The two translation catalogues used to live inline in this file as one
// ~142KB object literal, which meant every visitor downloaded BOTH languages
// in the entry bundle before anything could render. They now live in
// ./locales/en.js and ./locales/he.js.
//
//   * English is imported statically. It is the `fallbackLng`, so it has to be
//     in memory for any missing-key fallback to work — there is no version of
//     this app that can run without it.
//   * Hebrew is fetched on demand through the tiny "backend" plugin below,
//     which webpack turns into its own async chunk.
//
// Because the loader is registered as a real i18next backend (rather than a
// hand-rolled wrapper around changeLanguage), i18next itself waits for the
// chunk before it emits `languageChanged`. That means:
//   * every existing `i18n.changeLanguage('he')` call site keeps working
//     unchanged (Navigation toggle, SettingsTab, the saved-preference sync in
//     App.js);
//   * there is no window where components re-render against a half-loaded
//     Hebrew store, so no flash of raw `some.key` strings. During the (brief)
//     load the UI simply stays on the previously rendered language.
//
// `i18nReady` is exported so src/index.js can hold the very first paint until
// the detected language is in the store. For an English visitor that promise
// is already settled by the time React mounts (no extra round trip); for a
// returning Hebrew visitor it costs one chunk fetch and guarantees they see
// Hebrew on first paint instead of an English flash.
// ---------------------------------------------------------------------------

const lazyBackend = {
  type: 'backend',
  init() {},
  read(language, namespace, callback) {
    const lng = (language || '').split('-')[0];
    if (lng === 'he' && namespace === 'translation') {
      import(/* webpackChunkName: "locale-he" */ './locales/he')
        .then((mod) => callback(null, mod.default))
        // `false` (not `true`) tells i18next not to retry — a failed chunk
        // fetch won't recover on its own, and `fallbackLng: 'en'` keeps the
        // UI readable.
        .catch((err) => callback(err, false));
      return;
    }
    // Anything else (including 'en', which is already in `resources` and so
    // never actually reaches this branch) resolves to an empty bundle rather
    // than an error, so i18next doesn't sit in a retry loop.
    callback(null, {});
  },
};

const resources = {
  en: {
    translation: en,
  },
};

export const i18nReady = i18n
  .use(LanguageDetector)
  .use(lazyBackend)
  .use(initReactI18next)
  .init({
    resources,
    // Tells i18next that `resources` is deliberately incomplete and that the
    // backend above should still be consulted for anything missing. Without
    // it, providing `resources` short-circuits the backend entirely and
    // Hebrew would never load.
    partialBundledLanguages: true,
    fallbackLng: 'en',
    // Collapse region variants ('he-IL' -> 'he') so we resolve/load one
    // bundle per language instead of firing a second lookup for the base tag.
    load: 'languageOnly',
    supportedLngs: ['en', 'he'],
    interpolation: {
      escapeValue: false,
    },
    react: {
      // The first paint is gated on `i18nReady` (see src/index.js) and
      // subsequent switches only re-render on `languageChanged` (which now
      // fires after the chunk lands), so suspense is never needed. Disabling
      // it means a `ready === false` render can never throw a promise into a
      // tree that has no Suspense boundary — it would just fall back to
      // English text.
      useSuspense: false,
    },
  });

// ---------------------------------------------------------------------------
// Language sync — set the <html lang> and <html dir> attributes so screen
// readers, browser translation heuristics, and our `[dir="rtl"]` CSS rules
// (App.css) pick up the switch. `useIsRtl()` mirrors this via i18n.dir() for
// components that need to flip icons/scroll direction at runtime.
// ---------------------------------------------------------------------------
const applyLocaleDir = (lng) => {
  if (typeof document === 'undefined') return;
  const lang = (lng || 'en').split('-')[0];
  document.documentElement.setAttribute('lang', lang);
  document.documentElement.setAttribute('dir', i18n.dir(lang));
};
applyLocaleDir(i18n.language);
// Still bound to `languageChanged`, which the lazy backend defers until the
// Hebrew chunk has been added to the store — so dir/lang flip in the same
// tick as the text, not before it.
i18n.on('languageChanged', applyLocaleDir);

export default i18n;
