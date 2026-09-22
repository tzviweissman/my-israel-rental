/**
 * /getting-started - the growth guide (Tzvi, 22 Sep 2026: "a more in depth
 * sign up guide that goes through the different features and how they
 * will help their business grow").
 *
 * One feature per screen, in the order a new business would use them, each
 * with what it does for you and a button that opens it. Built on the
 * feature library (data/featureLibrary.js), not beside it: the same copy
 * feeds /what-you-can-do and every /features page, so a feature described
 * here cannot say something different there. The guide adds only the
 * ORDER and the "why this, now" line for each step.
 *
 * Not the tour. The tour points at controls on the dashboard ("this is
 * where messages are"); this answers "why would I bother" first. The two
 * link to each other.
 */
import React, { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { AuthContext } from '../App';
import { featureBySlug, defaultAudience } from '../data/featureLibrary';
import PageMeta from '../components/PageMeta';

/* The order a new business meets these, from "be findable" to "run
   itself". Every slug must exist in the library for that audience; the
   guide drops any that do not rather than showing an empty step. */
const PATHS = {
  business: [
    'your-own-page', 'put-it-on-a-flyer', 'work-comes-to-you', 'orders-and-delivery',
    'work-with-other-businesses', 'hand-off-the-repeat-work', 'see-what-works', 'write-in-your-language',
  ],
  host: [
    'one-calendar', 'instant-or-ask', 'sign-without-printing', 'put-it-on-a-flyer',
    'hand-off-the-repeat-work', 'what-to-charge', 'see-what-works', 'write-in-your-language',
  ],
};

export default function GrowthGuide() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext) || {};
  const [params, setParams] = useSearchParams();
  const audience = params.get('for') === 'host' || params.get('for') === 'business'
    ? params.get('for')
    : (defaultAudience(user?.role) === 'host' ? 'host' : 'business');

  const steps = useMemo(
    () => PATHS[audience].map(featureBySlug).filter((f) => f && f.audiences.includes(audience)),
    [audience],
  );
  const [i, setI] = useState(0);
  const step = steps[Math.min(i, steps.length - 1)];
  const last = i >= steps.length - 1;
  const Icon = (step && Icons[step.icon]) || Icons.Sparkles;

  const setAudience = (a) => {
    const p = new URLSearchParams(params); p.set('for', a); setParams(p, { replace: true }); setI(0);
  };

  if (!step) return null;
  const k = `features.item.${step.slug}`;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="growth-guide">
      <PageMeta
        title={`${t('guide.metaTitle', 'How this site grows your business')} — MyIsraelRental`}
        description={t('guide.intro', 'One thing at a time, in the order most people use them.')}
        path="/getting-started"
      />
      <div className="max-w-2xl mx-auto px-4 pt-36 sm:pt-28 pb-16">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--gold-text)' }}>
          {t('guide.kicker', 'Getting started')}
        </p>
        <h1 className="text-3xl sm:text-4xl mt-2" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
          {t('guide.title', 'How this site grows your business')}
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--brand-muted)' }}>
          {t('guide.intro', 'One thing at a time, in the order most people use them. Each one takes a few minutes to set up and keeps working after that.')}
        </p>

        <div role="tablist" className="inline-flex gap-1 p-1 rounded-lg mt-5" style={{ background: 'rgb(var(--brand-primary-rgb) / 0.07)' }}>
          {['business', 'host'].map((a) => (
            <button key={a} type="button" role="tab" aria-selected={audience === a} onClick={() => setAudience(a)}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold ${audience === a ? 'bg-white shadow-sm' : ''}`}
              style={{ color: audience === a ? 'var(--brand-primary)' : 'var(--brand-muted)' }}
              data-testid={`guide-for-${a}`}>
              {t(`guide.for_${a}`, a === 'business' ? 'I run a business' : 'I rent out a place')}
            </button>
          ))}
        </div>

        {/* Where you are. Buttons, so any step can be reopened. */}
        <ol className="flex gap-1.5 mt-6" aria-label={t('guide.progress', 'Progress')}>
          {steps.map((s, n) => (
            <li key={s.slug} className="flex-1">
              <button type="button" onClick={() => setI(n)} aria-current={n === i ? 'step' : undefined}
                aria-label={t(`features.item.${s.slug}.title`, s.slug)}
                className="block w-full h-1.5 rounded-full"
                style={{ background: n <= i ? 'var(--brand-primary)' : 'var(--brand-border)' }} />
            </li>
          ))}
        </ol>

        <article className="mt-5 rounded-2xl border bg-white p-6 sm:p-8" style={{ borderColor: 'var(--brand-border)' }} data-testid={`guide-step-${step.slug}`}>
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 rounded-xl inline-flex items-center justify-center shrink-0"
              style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)', color: 'var(--brand-primary)' }}>
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>
              {t('guide.stepOf', 'Step {{n}} of {{total}}', { n: i + 1, total: steps.length })}
            </span>
          </div>
          <h2 className="text-2xl mt-4" style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>{t(`${k}.title`, step.slug)}</h2>
          <p className="mt-3 text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            <span style={{ color: 'var(--brand-primary)' }}>{t('guide.howItHelps', 'How it helps you grow:')}</span>{' '}
            {t(`${k}.benefit`, '')}
          </p>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--brand-muted)' }}>{t(`${k}.body`, '')}</p>
          <div className="flex flex-wrap items-center gap-2 mt-6">
            <button type="button" className="btn-primary inline-flex items-center gap-2 text-sm px-4 py-2"
              onClick={() => navigate(user ? step.cta : `/join?redirect=${encodeURIComponent(step.cta)}`)} data-testid="guide-cta">
              {t(`${k}.cta`, t('guide.setUp', 'Set this up'))}
            </button>
            <Link to={`/features/${step.slug}`} className="text-sm underline" style={{ color: 'var(--brand-muted)' }}>
              {t('guide.more', 'More about this')}
            </Link>
          </div>
        </article>

        <div className="flex items-center justify-between mt-5">
          <button type="button" disabled={i === 0} onClick={() => setI(i - 1)}
            className="inline-flex items-center gap-1 text-sm font-semibold disabled:opacity-40" style={{ color: 'var(--ink)' }}
            data-testid="guide-back">
            <ArrowLeft size={15} className="rtl:rotate-180" aria-hidden="true" /> {t('guide.back', 'Back')}
          </button>
          {last ? (
            <button type="button" onClick={() => navigate(user ? '/dashboard' : '/join')}
              className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}
              data-testid="guide-done">
              <Check size={15} aria-hidden="true" /> {user ? t('guide.toDashboard', 'Go to my dashboard') : t('guide.join', 'Add your business, free')}
            </button>
          ) : (
            <button type="button" onClick={() => setI(i + 1)}
              className="inline-flex items-center gap-1 text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}
              data-testid="guide-next">
              {t('guide.next', 'Next')} <ArrowRight size={15} className="rtl:rotate-180" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
