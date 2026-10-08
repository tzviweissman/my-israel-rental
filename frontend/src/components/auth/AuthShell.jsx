/**
 * The frame every sign-in page shares: one white card, one screen tall from
 * lg up, the form centred on the left and the dark sphere panel inset on the
 * right (Tzvi, 7 Oct 2026: "cleaner", one card, fits on one screen; "the log
 * in page should look the same").
 *
 * The form column centres with auto margins, not justify-center: a flex
 * column centred that way clips its top out of reach of the scrollbar once
 * it overflows. Below lg the sphere is not mounted at all (a phone would
 * fetch a sphere it never draws) and the page simply scrolls.
 */
import React from 'react';
import SignupSphere from './SignupSphere';
import useIsWide from '../../hooks/useIsWide';

export default function AuthShell({ children, testId }) {
  const isWide = useIsWide(1024);
  return (
    <div
      className="min-h-screen relative [overflow-x:clip]"
      // The flow theme's one alternate surface, so the white card reads as the page.
      style={{ background: '#F9FAFB' }}
      data-testid={testId}
    >
      <div className="mx-auto max-w-[1320px] px-3 sm:px-4 pt-20 sm:pt-24 lg:pt-[4.75rem] pb-4 lg:pb-2">
        <div
          className="rounded-3xl bg-white shadow-[0_1px_2px_rgba(17,24,39,0.04),0_12px_32px_-12px_rgba(17,24,39,0.12)] lg:grid lg:grid-cols-[1.4fr_1fr] xl:grid-cols-2 lg:h-[calc(100svh-5.5rem)] lg:min-h-[500px] lg:p-3"
          data-testid="auth-card"
        >
          <div
            className="px-5 py-8 sm:px-10 sm:py-10 lg:py-5 lg:flex lg:flex-col lg:overflow-y-auto"
            data-testid="signup-form-panel"
          >
            <div className="w-full max-w-[30rem] m-auto">{children}</div>
          </div>
          {isWide && (
            <div className="hidden lg:block lg:min-h-0" data-testid="signup-right-panel">
              <SignupSphere />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// The fields and the action, shared so the pages cannot drift apart.
export const authInput = 'w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm focus:outline-none focus:border-[var(--brand-primary)] focus:ring-2 focus:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/20';
export const authLabel = 'block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5';
export const authButton = 'w-full inline-flex items-center justify-center gap-2 rounded-full px-8 py-3 text-sm font-bold shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed';
// The theme's black action with a white label.
export const authButtonStyle = { background: 'var(--action, #000)', color: 'var(--action-ink, #fff)' };
