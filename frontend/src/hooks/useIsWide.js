/**
 * useIsWide — true when the viewport is at least `px` wide, live.
 *
 * A hook rather than a CSS media query because the decision it feeds -
 * sidebar or tab strip - changes which COMPONENT renders, and only JS can
 * do that. Starts from the real width on first render so there is no flash
 * of the wrong navigation.
 */
import { useEffect, useState } from 'react';

export default function useIsWide(px = 1024) {
  const [wide, setWide] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= px));
  useEffect(() => {
    const check = () => setWide(window.innerWidth >= px);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, [px]);
  return wide;
}
