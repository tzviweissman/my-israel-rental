/**
 * useIsRtl — returns `true` when the current i18n locale renders the
 * page right-to-left (Hebrew, Arabic, Farsi, Urdu). Re-fires when the
 * user toggles the language so components can swap their chevrons,
 * arrow buttons or any other direction-coupled icon at runtime.
 */
import { useTranslation } from 'react-i18next';

export default function useIsRtl() {
  const { i18n } = useTranslation();
  // i18next's `dir()` returns 'ltr' | 'rtl' based on the current
  // language. Cheap to call and updates on language change because
  // `i18n.language` is part of the `useTranslation` subscription.
  return i18n.dir() === 'rtl';
}
