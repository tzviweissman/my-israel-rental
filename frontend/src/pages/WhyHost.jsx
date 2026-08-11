/**
 * "Why host with us" — the property-owner pitch, at /why-host.
 *
 * The counterpart to /why-list (which is the service-provider pitch). The
 * Host card on /join links here; neither page is in the nav any more.
 *
 * Assembled from the section library in home-redesign-preview.html — the
 * supply band, the tabbed how-it-works, and the testimonials block —
 * restyled onto tokens. Styles are `.wh-*` in App.css.
 *
 * Two rules inherited from /why-list, and they are the reason this page
 * says less than the mockup does:
 *
 *   1. **Only claim what exists today.** Every benefit below maps to
 *      shipped code — free listing, direct WhatsApp/in-app contact,
 *      message translation, digital contract signing, iCal sync. The
 *      Requests board is NOT among them: /requests is still a placeholder
 *      page, so it sits in a separate, explicitly-labelled "coming soon"
 *      block rather than being sold as inbound demand that exists.
 *
 *   2. **No invented people.** The mockup's testimonials section carries
 *      three named renters and owners with stock headshots and five-star
 *      ratings. They are fictional. Shipping them would be fabricating
 *      reviews and putting strangers' faces on them, so `Testimonials`
 *      renders nothing until there is something real — same decision, and
 *      the same reasoning, as `SocialProof` on /why-list.
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  MessageCircle, Languages, FileSignature, CalendarSync,
  Wallet, Inbox, ArrowRight,
} from 'lucide-react';
import PageMeta from '../components/PageMeta';

// Shipped features only. Each key resolves to whyHost.<key>Title/<key>Body.
const BENEFITS = [
  { key: 'free', Icon: Wallet },
  { key: 'direct', Icon: MessageCircle },
  { key: 'bilingual', Icon: Languages },
  { key: 'contract', Icon: FileSignature },
  { key: 'ical', Icon: CalendarSync },
];

// Built but NOT shipped — /requests is a placeholder today. Rendered in
// its own labelled block so it can never read as a live feature.
const ROADMAP = [{ key: 'requests', Icon: Inbox }];

const TABS = ['longTerm', 'vacation'];

/**
 * Intentionally renders nothing.
 *
 * The mockup's testimonial cards are invented — fictional names, stock
 * photos, five stars each. A placeholder on a live pitch page is still
 * something a visitor reads and believes.
 *
 * When there are real, consented testimonials, render them here and bind
 * them to something stored. Do not hardcode quotes.
 */
const Testimonials = () => null;

const WhyHost = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState('longTerm');

  const startHosting = () => navigate('/join');

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }} data-testid="why-host-page">
      <PageMeta
        title="List your property on MyIsraelRental | For owners"
        description="List your apartment or vacation rental free — no listing fee, no booking fees, no commission. Renters message you directly, contracts are signed digitally, and your calendar stays in sync."
        path="/why-host"
      />

      {/* Hero */}
      <section className="px-6 pt-28 pb-12">
        <div className="max-w-4xl mx-auto text-center">
          <div className="wh-eyebrow" style={{ color: 'var(--gold-text-on-light)' }}>
            {t('whyHost.eyebrow', 'For property owners')}
          </div>
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3 mb-4"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
          >
            {t('whyHost.heroTitle', 'List your property. Keep every shekel.')}
          </h1>
          <p className="text-base sm:text-lg max-w-2xl mx-auto mb-8" style={{ color: 'var(--brand-muted)' }}>
            {t(
              'whyHost.heroBody',
              'Renters looking for a home in English find you here and message you directly. No listing fee, no booking fees, and no commission on what you agree.',
            )}
          </p>
          <button
            onClick={startHosting}
            className="btn-blue-solid inline-flex items-center gap-2"
            data-testid="why-host-hero-cta"
          >
            {t('whyHost.cta', 'List your property free')}
            <ArrowRight size={16} className="rtl:rotate-180" />
          </button>
          <p className="text-xs mt-3" style={{ color: 'var(--brand-muted)' }}>
            {t('whyHost.ctaNote', 'Free to list — no card needed, ever.')}
          </p>
        </div>
      </section>

      {/* Supply band */}
      <section className="px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <div className="wh-band" data-testid="why-host-band">
            <div>
              <div className="wh-eyebrow" style={{ color: 'var(--gold)' }}>
                {t('whyHost.bandEyebrow', 'For owners')}
              </div>
              <h2 style={{ marginTop: 10, fontFamily: 'var(--font-head)' }}>
                {t('whyHost.bandTitle', 'List your property — free')}
              </h2>
              <p>
                {t(
                  'whyHost.bandBody',
                  'No commission, no payout fees, no lock-in. Reach renters actively looking, right now.',
                )}
              </p>
              <div className="flex gap-3 flex-wrap mt-6">
                <button onClick={startHosting} className="btn-gold-solid" data-testid="why-host-band-cta">
                  {t('whyHost.cta', 'List your property free')}
                </button>
              </div>
            </div>
            <div className="wh-facts">
              <div className="wh-fact">
                <span className="fi">₪0</span>
                <div>
                  <b>{t('whyHost.factFreeTitle', 'Free to list')}</b>
                  <small>{t('whyHost.factFreeBody', 'Photos, pricing and availability in minutes.')}</small>
                </div>
              </div>
              <div className="wh-fact">
                <span className="fi"><MessageCircle size={20} aria-hidden="true" /></span>
                <div>
                  <b>{t('whyHost.factDirectTitle', 'Direct leads')}</b>
                  <small>{t('whyHost.factDirectBody', 'Renters message you directly — you own the relationship.')}</small>
                </div>
              </div>
              <div className="wh-fact">
                <span className="fi"><FileSignature size={20} aria-hidden="true" /></span>
                <div>
                  <b>{t('whyHost.factToolsTitle', 'Contracts and tools included')}</b>
                  <small>{t('whyHost.factToolsBody', 'Digital contracts, calendar sync, WhatsApp and email delivery.')}</small>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits — shipped only */}
      <section className="px-6 py-14">
        <div className="max-w-5xl mx-auto">
          <h2
            className="text-2xl font-bold mb-8 text-center"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
          >
            {t('whyHost.benefitsTitle', 'What you get')}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ key, Icon }) => (
              <div
                key={key}
                className="rounded-2xl border bg-white p-5"
                style={{ borderColor: 'var(--brand-border)' }}
                data-testid={`why-host-benefit-${key}`}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)' }}
                >
                  <Icon size={20} style={{ color: 'var(--brand-primary)' }} />
                </div>
                <h3 className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>
                  {t(`whyHost.${key}Title`, key)}
                </h3>
                <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
                  {t(`whyHost.${key}Body`, '')}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tabbed how-it-works */}
      <section className="px-6 py-14 bg-white" style={{ textAlign: 'center' }}>
        <div className="max-w-5xl mx-auto">
          <div className="wh-eyebrow" style={{ color: 'var(--gold-text-on-light)' }}>
            {t('whyHost.howEyebrow', 'Simple and direct')}
          </div>
          <h2
            className="mt-2 mb-7"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)', fontSize: 'clamp(26px,3.4vw,38px)' }}
          >
            {t('whyHost.howTitle', 'How hosting works')}
          </h2>
          <div className="flex justify-center mb-8">
            <div className="wh-tabs" role="tablist" aria-label={t('whyHost.howTitle', 'How hosting works')}>
              {TABS.map((k) => (
                <button
                  key={k}
                  type="button"
                  role="tab"
                  className="wh-tab"
                  aria-selected={tab === k}
                  aria-controls={`why-host-steps-${k}`}
                  onClick={() => setTab(k)}
                  data-testid={`why-host-tab-${k}`}
                >
                  {t(`whyHost.tab_${k}`, k)}
                </button>
              ))}
            </div>
          </div>
          {TABS.map((k) => (
            <div
              key={k}
              id={`why-host-steps-${k}`}
              role="tabpanel"
              hidden={tab !== k}
              className="wh-steps"
              data-testid={`why-host-steps-${k}`}
            >
              {[1, 2, 3].map((n) => (
                <div className="wh-step" key={n}>
                  <div className="num">{n}</div>
                  <h4 style={{ color: 'var(--ink)' }}>{t(`whyHost.${k}_s${n}_title`, '')}</h4>
                  <p>{t(`whyHost.${k}_s${n}_body`, '')}</p>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* Roadmap — separate and labelled, never mixed with the shipped list */}
      <section className="px-6 pb-14">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-dashed p-5" style={{ borderColor: 'var(--brand-border)' }}>
            <p className="text-xs font-semibold tracking-wider uppercase mb-4" style={{ color: 'var(--brand-muted)' }}>
              {t('whyHost.roadmapLabel', 'Coming soon — not available yet')}
            </p>
            {ROADMAP.map(({ key, Icon }) => (
              <div key={key} className="flex items-start gap-3" data-testid={`why-host-roadmap-${key}`}>
                <Icon size={18} className="shrink-0 mt-0.5" style={{ color: 'var(--brand-muted)' }} />
                <div>
                  <h3 className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                    {t(`whyHost.${key}Title`, key)}
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>
                    {t(`whyHost.${key}Body`, '')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Testimonials />

      {/* Closing CTA */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto text-center">
          <h2
            className="text-2xl font-bold mb-3"
            style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
          >
            {t('whyHost.closingTitle', 'Your next tenant is already looking')}
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--brand-muted)' }}>
            {t('whyHost.closingBody', 'Listing takes a few minutes and costs nothing.')}
          </p>
          <button
            onClick={startHosting}
            className="btn-blue-solid inline-flex items-center gap-2"
            data-testid="why-host-closing-cta"
          >
            {t('whyHost.cta', 'List your property free')}
            <ArrowRight size={16} className="rtl:rotate-180" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default WhyHost;
