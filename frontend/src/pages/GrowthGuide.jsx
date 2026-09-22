/**
 * /getting-started.
 *
 * Signed in: starts the walk (components/tour) - the site's one guide
 * since 22 Sep 2026, which goes through the real pages. This page used to
 * be a set of cards that never left it; Tzvi asked for a guide that
 * "actually goes through the site", and one guide rather than three.
 *
 * Signed out there is nothing to walk through yet, so it says what the
 * walk covers, in the walk's own words, and offers the way in.
 */
import React, { useContext, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check } from 'lucide-react';
import { AuthContext } from '../App';
import { WALKS, stepKey } from '../components/tour/tourSteps';
import PageMeta from '../components/PageMeta';

export default function GrowthGuide() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext) || {};
  const [params, setParams] = useSearchParams();
  const audience = params.get('for') === 'host' ? 'host' : 'business';

  useEffect(() => {
    if (user) navigate('/dashboard?tour=1', { replace: true });
  }, [user, navigate]);
  if (user) return null;

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="growth-guide">
      <PageMeta
        title={`${t('guide.metaTitle', 'How this site grows your business')} | MyIsraelRental`}
        description={t('guide.introWalk', 'Once you add your business, a short walk takes you through the site, one page at a time.')}
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
          {t('guide.introWalk', 'Once you add your business, a short walk takes you through the site, one page at a time. At each stop you can set that part up there and then, or carry on.')}
        </p>

        <div role="tablist" className="inline-flex gap-1 p-1 rounded-lg mt-5" style={{ background: 'rgb(var(--brand-primary-rgb) / 0.07)' }}>
          {['business', 'host'].map((a) => (
            <button key={a} type="button" role="tab" aria-selected={audience === a}
              onClick={() => { const p = new URLSearchParams(params); p.set('for', a); setParams(p, { replace: true }); }}
              className={`px-3 py-1.5 rounded-md text-sm font-semibold ${audience === a ? 'bg-white shadow-sm' : ''}`}
              style={{ color: audience === a ? 'var(--brand-primary)' : 'var(--brand-muted)' }}
              data-testid={`guide-for-${a}`}>
              {t(`guide.for_${a}`, a === 'business' ? 'I run a business' : 'I rent out a place')}
            </button>
          ))}
        </div>

        <ol className="mt-6 space-y-3" data-testid="guide-stops">
          {WALKS[audience].map((s, n) => (
            <li key={s.id} className="rounded-2xl border bg-white p-4 flex gap-3" style={{ borderColor: 'var(--brand-border)' }}>
              <span className="h-7 w-7 rounded-full inline-flex items-center justify-center shrink-0 text-xs font-bold"
                style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)', color: 'var(--brand-primary)' }}>{n + 1}</span>
              <span>
                <span className="block font-semibold" style={{ color: 'var(--ink)' }}>{t(`${stepKey(s.id)}.title`, s.id)}</span>
                <span className="block text-sm mt-0.5" style={{ color: 'var(--brand-muted)' }}>{t(`${stepKey(s.id)}.body`, '')}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link to="/join" className="btn-primary inline-flex items-center gap-2 text-sm px-4 py-2" data-testid="guide-join">
            <Check size={15} aria-hidden="true" /> {t('guide.join', 'Add your business, free')}
          </Link>
          <Link to="/what-you-can-do" className="text-sm underline" style={{ color: 'var(--brand-muted)' }}>
            {t('help.whatYouCanDo', 'What you can do here')}
          </Link>
        </div>
      </div>
    </div>
  );
}
