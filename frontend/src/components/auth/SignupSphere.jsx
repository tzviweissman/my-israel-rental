/**
 * The right half of the sign-in pages. Until 16 Nov 2026 this was a turning sphere of listing photos with the live
 * work line under it; the line covered the sphere's foot, and Tzvi asked for the circles to go and the live work to
 * be the main thing ("make that thing the main theme"). The panel is now the live stream of real work the site does
 * for businesses (WorkForYou, filling the panel), under one headline.
 *
 * The ground is white with a mist of the accent blue (Tzvi, 7 Oct 2026: the black-to-navy panel was "too dark").
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'motion/react';
import WorkForYou from './WorkForYou';

export default function SignupSphere() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const from = (v) => (reduced ? false : v);
  return (
    <div
      className="relative flex h-full flex-col overflow-clip rounded-2xl p-8 xl:p-10 [@media(max-height:800px)]:p-6"
      style={{
        background: 'radial-gradient(60% 55% at 50% 60%, rgba(36,175,235,0.22), transparent 70%), var(--surface, #FFFFFF)',
        color: 'var(--ink, #111827)',
        boxShadow: 'inset 0 0 0 1px var(--brand-border, #E3E3E3)',
      }}
      data-testid="signup-sphere-panel"
    >
      <div className="max-w-[480px] shrink-0">
        <motion.p
          initial={from({ opacity: 0, y: 12, filter: 'blur(6px)' })}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="text-xs font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--brand-primary-dark, #0F5E8F)' }}
        >
          {t('signupJoin.workEyebrow', 'Working right now')}
        </motion.p>
        <motion.h2
          initial={from({ opacity: 0, y: 18, filter: 'blur(8px)' })}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
          className="mt-3 text-2xl font-light leading-tight tracking-[-0.02em] xl:text-[1.75rem]"
          style={{ fontFamily: 'var(--font-head)' }}
        >
          {t('signupJoin.workHeadline', 'While businesses get on with their day, the site does the rest.')}
        </motion.h2>
      </div>
      <WorkForYou fill className="relative z-10 mt-5" />
    </div>
  );
}
