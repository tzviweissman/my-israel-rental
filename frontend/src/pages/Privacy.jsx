/**
 * /privacy — the Privacy Policy on its own page.
 *
 * WHY A SECOND PAGE. /terms already carries the privacy sections, and the
 * signup checkbox points there (see the note at the top of Terms.jsx). Meta
 * rejects a WhatsApp Business application whose website has no privacy
 * policy at its own address, and its reviewers look for one that says what
 * happens to a phone number and a WhatsApp message. This is that page
 * (17 Oct 2026, after Meta declined the WhatsApp automated messages).
 *
 * Same layout and the same one-string-per-section copy convention as
 * Terms.jsx: copy lives under `privacy.*` in en.js and he.js, paragraphs
 * separated by a blank line.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import BackLink from '../components/common/BackLink';
import SiteFooter from '../components/common/SiteFooter';

const SECTIONS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10', 'p11'];

export const SUPPORT_EMAIL = 'support@myisraelrental.com';

const Privacy = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg, #FFFFFF)' }}>
      <PageMeta
        title={t('privacy.metaTitle')}
        description={t('privacy.metaDescription')}
        path="/privacy"
      />

      <div className="mx-auto max-w-[760px] px-6 py-12 sm:py-16">
        <BackLink />

        <header className="mt-6 mb-10">
          <h1
            className="text-[34px] sm:text-[44px] leading-[1.15] font-normal"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
          >
            {t('privacy.title')}
          </h1>
          <p className="mt-3 text-sm" style={{ color: 'var(--brand-muted, #666666)' }}>
            {t('privacy.updated')}
          </p>
          <p className="mt-6 text-[17px] leading-[1.7]" style={{ color: 'var(--ink)' }}>
            {t('privacy.intro')}
          </p>
        </header>

        <div className="space-y-10">
          {SECTIONS.map((id) => (
            <section key={id}>
              <h2
                className="text-[22px] sm:text-[24px] leading-snug font-semibold"
                style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
              >
                {t(`privacy.${id}Head`)}
              </h2>
              {String(t(`privacy.${id}Body`))
                .split('\n\n')
                .map((para, i) => (
                  <p
                    key={i}
                    className="mt-3 text-[16px] leading-[1.75]"
                    style={{ color: 'var(--brand-muted, #666666)' }}
                  >
                    {para}
                  </p>
                ))}
            </section>
          ))}
        </div>

        <aside
          className="mt-14 rounded-2xl p-6 sm:p-7"
          style={{
            background: 'var(--surface-muted, #F9FAFB)',
            border: '1px solid var(--brand-border, #E3E3E3)',
          }}
        >
          <p className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>
            {t('privacy.contactCta')}
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-3 inline-flex items-center gap-2 text-[15px] font-semibold underline underline-offset-4"
            style={{ color: 'var(--gold)' }}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {SUPPORT_EMAIL}
          </a>
          <p className="mt-4 text-[15px]" style={{ color: 'var(--brand-muted, #666666)' }}>
            <Link to="/contact" className="underline underline-offset-4" style={{ color: 'var(--gold)' }}>
              {t('privacy.allWays')}
            </Link>
          </p>
        </aside>
      </div>
      <SiteFooter />
    </div>
  );
};

export default Privacy;
