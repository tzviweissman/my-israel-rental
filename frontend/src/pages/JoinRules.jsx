/**
 * /join-rules — what a business sends us and agrees to before it joins.
 *
 * The link the super admin sends with an invite (Admin → Invite businesses).
 * Every line restates something already true elsewhere, so the page promises
 * nothing new: the price and removal from whyList.*, what may be posted and
 * what is not allowed from terms.s3/s7, money and agreements from terms.s4/s6,
 * and "facts only, each claim with its proof" from the page builder's own
 * rules (docs/page-generation-rules.md §1).
 *
 * Copy lives in locales under joinRules.*, one string per section body with
 * blank lines between paragraphs, the same shape as pages/Terms.jsx.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ArrowRight, Mail } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import BackLink from '../components/common/BackLink';

const SECTIONS = ['j1', 'j2', 'j3', 'j4', 'j5', 'j6', 'j7'];
const SUPPORT_EMAIL = 'support@myisraelrental.com';

const JoinRules = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg, #FFFFFF)' }}>
      <PageMeta title={t('joinRules.metaTitle')} description={t('joinRules.metaDescription')} path="/join-rules" />

      <div className="mx-auto max-w-[760px] px-6 py-12 sm:py-16">
        <BackLink />

        <header className="mt-6 mb-10">
          <h1
            className="text-[34px] sm:text-[44px] leading-[1.15] font-normal"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
          >
            {t('joinRules.title')}
          </h1>
          <p className="mt-6 text-[17px] leading-[1.7]" style={{ color: 'var(--ink)' }}>
            {t('joinRules.intro')}
          </p>
        </header>

        <div className="space-y-10">
          {SECTIONS.map((id) => (
            <section key={id}>
              <h2
                className="text-[22px] sm:text-[24px] leading-snug font-semibold"
                style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
              >
                {t(`joinRules.${id}Head`)}
              </h2>
              {String(t(`joinRules.${id}Body`)).split('\n\n').map((para, i) => (
                <p key={i} className="mt-3 text-[16px] leading-[1.75]" style={{ color: 'var(--brand-muted, #666666)' }}>
                  {para}
                </p>
              ))}
            </section>
          ))}
          <Link to="/terms" className="inline-block text-[15px] font-semibold underline underline-offset-4" style={{ color: 'var(--gold)' }}>
            {t('terms.title')}
          </Link>
        </div>

        <aside
          className="mt-14 rounded-2xl p-6 sm:p-7"
          style={{ background: 'var(--surface-muted, #F9FAFB)', border: '1px solid var(--brand-border, #E3E3E3)' }}
        >
          <p className="text-[18px] font-semibold" style={{ color: 'var(--ink)' }}>{t('joinRules.ctaHead')}</p>
          <p className="mt-2 text-[15px]" style={{ color: 'var(--brand-muted, #666666)' }}>{t('joinRules.ctaBody')}</p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link
              to="/why-list"
              className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-[15px] font-semibold text-white"
              style={{ background: 'var(--brand-primary)' }}
              data-testid="join-rules-start"
            >
              {t('joinRules.ctaButton')}
              <ArrowRight className="h-4 w-4 rtl:rotate-180" aria-hidden="true" />
            </Link>
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="inline-flex items-center gap-2 text-[15px] font-semibold underline underline-offset-4"
              style={{ color: 'var(--gold)' }}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              {SUPPORT_EMAIL}
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default JoinRules;
