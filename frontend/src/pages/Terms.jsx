/**
 * /terms — the Terms & Privacy page.
 *
 * WHY THIS EXISTS. Both signup screens render a REQUIRED checkbox reading
 * "I agree to the Terms & Privacy Policy", linking to `/terms`
 * (`Auth.js:621`, `SignupJoin.jsx:670`). No such route was ever added, so
 * the link 404'd and every account on this site was created by someone
 * ticking a box about a page they could not read. Found by the 14 Sep
 * audit sweep; the fix is the page, not the removal of the link.
 *
 * ONE PAGE, NOT TWO. The checkbox says "Terms & Privacy Policy" as a single
 * thing, so this is a single document with the privacy sections inside it.
 * Splitting it would leave that label pointing at one half.
 *
 * All copy lives in `locales/en.js` and `he.js` under `terms.*`, and the
 * body text of a section is one string with blank lines between paragraphs
 * - `\n\n` - split here. That keeps a translator editing prose rather than
 * counting keys, and it is why there is no `returnObjects` call: i18next
 * needs configuration for arrays that this project does not set, and a
 * silent empty array would render a legal page with no text in it.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Mail } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import BackLink from '../components/common/BackLink';

// Fixed and explicit, rather than derived from the locale object. A section
// that loses its key disappears from the page; a numbered list that has to
// match on both sides makes that visible in review instead of in production.
const SECTIONS = ['s1', 's2', 's3', 's4', 's5', 's6', 's7', 's8', 's9', 's10', 's11', 's12'];

const SUPPORT_EMAIL = 'support@myisraelrental.com';

const Terms = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg, #FFFFFF)' }}>
      <PageMeta
        title={t('terms.metaTitle')}
        description={t('terms.metaDescription')}
        path="/terms"
      />

      <div className="mx-auto max-w-[760px] px-6 py-12 sm:py-16">
        <BackLink />

        <header className="mt-6 mb-10">
          <h1
            className="text-[34px] sm:text-[44px] leading-[1.15] font-normal"
            /* var(--font-head), never the literal face: RTL swaps the font
               VARIABLES, and an inline 'Playfair Display' beats that selector
               while having no Hebrew glyphs. */
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
          >
            {t('terms.title')}
          </h1>
          <p className="mt-3 text-sm" style={{ color: 'var(--brand-muted, #666666)' }}>
            {t('terms.updated')}
          </p>
          <p className="mt-6 text-[17px] leading-[1.7]" style={{ color: 'var(--ink)' }}>
            {t('terms.intro')}
          </p>
        </header>

        <div className="space-y-10">
          {SECTIONS.map((id) => (
            <section key={id}>
              <h2
                className="text-[22px] sm:text-[24px] leading-snug font-semibold"
                style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
              >
                {t(`terms.${id}Head`)}
              </h2>
              {String(t(`terms.${id}Body`))
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

        {/* The page tells people twice to "write to us" without ever saying
            where. This is where the address actually lives. */}
        <aside
          className="mt-14 rounded-2xl p-6 sm:p-7"
          style={{
            background: 'var(--surface-muted, #F9FAFB)',
            border: '1px solid var(--brand-border, #E3E3E3)',
          }}
        >
          <p className="text-[16px] font-semibold" style={{ color: 'var(--ink)' }}>
            {t('terms.contactCta')}
          </p>
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="mt-3 inline-flex items-center gap-2 text-[15px] font-semibold underline underline-offset-4"
            style={{ color: 'var(--gold)' }}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {SUPPORT_EMAIL}
          </a>
        </aside>
      </div>
    </div>
  );
};

export default Terms;
