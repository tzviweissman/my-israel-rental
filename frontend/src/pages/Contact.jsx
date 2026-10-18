/**
 * /contact — who runs the site and how to reach us.
 *
 * Meta's business verification (needed for WhatsApp automated messages)
 * checks that the website names the business and gives a way to reach it.
 * The site had a floating WhatsApp button and an email inside /terms, but
 * no page that said either plainly (17 Oct 2026).
 *
 * The WhatsApp number is the one the floating button already shows on
 * every page (components/WhatsAppButton.js); keep the two in step.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Mail, MessageCircle, Globe } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import BackLink from '../components/common/BackLink';
import SiteFooter from '../components/common/SiteFooter';
import { SUPPORT_EMAIL } from './Privacy';

const WHATSAPP = '972553225141';
const WHATSAPP_SHOWN = '+972 55-322-5141';

function Way({ icon: Icon, label, children }) {
  return (
    <div
      className="flex items-start gap-4 rounded-2xl p-5 sm:p-6"
      style={{ background: 'var(--surface-muted, #F9FAFB)', border: '1px solid var(--brand-border, #E3E3E3)' }}
    >
      <Icon className="h-5 w-5 mt-0.5 shrink-0" style={{ color: 'var(--gold)' }} aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-sm" style={{ color: 'var(--brand-muted, #666666)' }}>{label}</p>
        <div className="mt-1 text-[17px] font-semibold break-words" style={{ color: 'var(--ink)' }}>{children}</div>
      </div>
    </div>
  );
}

const Contact = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg, #FFFFFF)' }}>
      <PageMeta title={t('contactPage.metaTitle')} description={t('contactPage.metaDescription')} path="/contact" />

      <div className="mx-auto max-w-[760px] px-6 py-12 sm:py-16">
        <BackLink />

        <header className="mt-6 mb-10">
          <h1
            className="text-[34px] sm:text-[44px] leading-[1.15] font-normal"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
          >
            {t('contactPage.title')}
          </h1>
          <p className="mt-6 text-[17px] leading-[1.7]" style={{ color: 'var(--ink)' }}>
            {t('contactPage.intro')}
          </p>
        </header>

        <div className="grid gap-4">
          <Way icon={Mail} label={t('contactPage.email')}>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4" style={{ color: 'var(--gold)' }}>
              {SUPPORT_EMAIL}
            </a>
          </Way>
          <Way icon={MessageCircle} label={t('contactPage.whatsapp')}>
            <a
              href={`https://wa.me/${WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-4"
              style={{ color: 'var(--gold)' }}
            >
              <bdi dir="ltr">{WHATSAPP_SHOWN}</bdi>
            </a>
          </Way>
          <Way icon={Globe} label={t('contactPage.website')}>
            <bdi dir="ltr">myisraelrental.com</bdi>
          </Way>
        </div>

        <section className="mt-12">
          <h2
            className="text-[22px] sm:text-[24px] leading-snug font-semibold"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
          >
            {t('contactPage.aboutHead')}
          </h2>
          {String(t('contactPage.aboutBody')).split('\n\n').map((para, i) => (
            <p key={i} className="mt-3 text-[16px] leading-[1.75]" style={{ color: 'var(--brand-muted, #666666)' }}>
              {para}
            </p>
          ))}
          {/* The registered name and the registered agent's address, as on the
              New York filing (DOS ID 7446100). Meta matches the site against
              those papers. The owner's own name and home address stay off the
              site at the owner's request; the agent's address is already public record. */}
          <h3 className="mt-8 text-[17px] font-semibold" style={{ color: 'var(--ink)' }}>
            {t('contactPage.companyHead')}
          </h3>
          <dl className="mt-3 grid gap-3 text-[15px]" style={{ color: 'var(--brand-muted, #666666)' }}>
            <div>
              <dt>{t('contactPage.legalName')}</dt>
              <dd className="font-semibold" style={{ color: 'var(--ink)' }}><bdi dir="ltr">My Israel Rental LLC</bdi></dd>
            </div>
            <div>
              <dt>{t('contactPage.registeredIn')}</dt>
              <dd className="font-semibold" style={{ color: 'var(--ink)' }}>{t('contactPage.registeredInValue')}</dd>
            </div>
            <div>
              <dt>{t('contactPage.registeredAddress')}</dt>
              <dd className="font-semibold" style={{ color: 'var(--ink)' }}>
                <bdi dir="ltr">ZenBusiness Inc., 41 State Street, Suite 112, Albany, NY 12207, USA</bdi>
              </dd>
            </div>
          </dl>
          <p className="mt-6 text-[15px] flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/privacy" className="underline underline-offset-4" style={{ color: 'var(--gold)' }}>
              {t('footer.privacy')}
            </Link>
            <Link to="/terms" className="underline underline-offset-4" style={{ color: 'var(--gold)' }}>
              {t('footer.terms')}
            </Link>
          </p>
        </section>
      </div>
      <SiteFooter />
    </div>
  );
};

export default Contact;
