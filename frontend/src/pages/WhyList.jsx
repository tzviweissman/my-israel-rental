/**
 * "Why list with us" — the value page in front of the plan selection.
 *
 * A provider hits pricing before they've been told what they're buying. This
 * page is what sits in between.
 *
 * Two rules held throughout, both from the brief:
 *
 *   1. **Only claim what exists today.** Every benefit block below maps to
 *      shipped code (the jobs board, auto-translation, transaction-tied
 *      reviews, the Top-Rated / fast-response badges, appointment gigs,
 *      WhatsApp contact). The two roadmap items — the leads dashboard and
 *      the Verified badge — are rendered in a visually distinct section and
 *      explicitly labelled "coming soon", because neither is built.
 *
 *   2. **No invented numbers.** There is no provider count, no "X leads
 *      delivered", no testimonial on this page. At the time of writing
 *      production has a single published gig, so any stat would be either
 *      embarrassing or false. `SocialProof` renders nothing until there is
 *      something real to say — see the note there.
 *
 * The competitor is deliberately never named or disparaged; the positioning
 * section talks about scattered WhatsApp and Facebook groups, which is the
 * actual alternative providers use.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  Target, Briefcase, Languages, Star, CalendarCheck, MessageCircle,
  BarChart3, BadgeCheck, ArrowRight, Check,
} from 'lucide-react';
import PageMeta from '../components/PageMeta';
import PlanPicker from '../components/marketplace/PlanPicker';

// Shipped features only. Each `key` resolves to whyList.<key>Title/<key>Body.
const BENEFITS = [
  { key: 'reach', Icon: Target },
  { key: 'leads', Icon: Briefcase },
  { key: 'bilingual', Icon: Languages },
  { key: 'reputation', Icon: Star },
  { key: 'booking', Icon: CalendarCheck },
  { key: 'contact', Icon: MessageCircle },
];

// Built but NOT shipped. Rendered separately and labelled, never mixed in
// with the list above — a roadmap item presented as a live feature is the
// fastest way to lose a paying provider.
const ROADMAP = [
  { key: 'dashboard', Icon: BarChart3 },
  { key: 'verified', Icon: BadgeCheck },
];

const FAQ_KEYS = ['billing', 'cancel', 'leads', 'language'];

/**
 * Social proof.
 *
 * Intentionally renders nothing right now. The brief allows placeholder
 * slots, but a placeholder on a live sales page is still something a visitor
 * reads, and the honest position today is that the marketplace is new.
 *
 * When there is something real — a provider count worth quoting, or consented
 * testimonials — add it here and wire it to a real endpoint. Do not hardcode
 * a figure: if it can't be counted, it shouldn't be claimed.
 */
const SocialProof = () => null;

const WhyList = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [planKey, setPlanKey] = React.useState('');

  const startListing = () => navigate('/services/create-gig');

  return (
    <div className="min-h-screen bg-white">
      <PageMeta
        title="List your service on MyIsraelRental | For service providers"
        description="Get found by English-speaking renters and olim across Israel, at the moment they're moving and need you. Bilingual profile, real reviews, and a jobs board where customers come to you."
        path="/why-list"
      />

      {/* Hero */}
      <section className="px-6 pt-24 pb-12 bg-gradient-to-b from-[#f2f8f8] to-white">
        <div className="max-w-4xl mx-auto text-center">
          <h1
            className="text-3xl sm:text-4xl lg:text-5xl font-bold text-gray-900 mb-4"
            style={{ fontFamily: 'Playfair Display' }}
          >
            {t('whyList.heroTitle', 'Get found by English-speaking renters across Israel')}
          </h1>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto mb-8">
            {t(
              'whyList.heroBody',
              'People move, and then they need movers, cleaners, handymen and more. This is where they look — in a language they read, at the moment they need you.',
            )}
          </p>
          <button
            onClick={startListing}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md active:scale-[0.98]"
            style={{ backgroundColor: '#1E6A6A' }}
            data-testid="why-list-hero-cta"
          >
            {t('whyList.startListing', 'Start listing')}
            {/* Arrow flips automatically in RTL via the parent's direction. */}
            <ArrowRight size={16} className="rtl:rotate-180" />
          </button>
          <p className="text-xs text-gray-500 mt-3">
            {t('whyList.trialNote', 'Your first 30 days are free — no card needed to start.')}
          </p>
        </div>
      </section>

      {/* Benefits — shipped features only */}
      <section className="px-6 py-14">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            {t('whyList.benefitsTitle', 'What you get')}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ key, Icon }) => (
              <div
                key={key}
                className="rounded-2xl border border-gray-200 p-5 hover:border-[#1E6A6A]/40 transition-colors"
                data-testid={`why-list-benefit-${key}`}
              >
                <div className="w-10 h-10 rounded-xl bg-[#1E6A6A]/10 flex items-center justify-center mb-3">
                  <Icon size={20} className="text-[#1E6A6A]" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">
                  {t(`whyList.${key}Title`, key)}
                </h3>
                <p className="text-sm text-gray-600">{t(`whyList.${key}Body`, '')}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Roadmap — visually separate, explicitly not yet available */}
      <section className="px-6 pb-14">
        <div className="max-w-5xl mx-auto">
          <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-5">
            <p className="text-xs font-semibold tracking-wider uppercase text-gray-500 mb-4">
              {t('whyList.roadmapLabel', 'Coming soon — not available yet')}
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              {ROADMAP.map(({ key, Icon }) => (
                <div key={key} className="flex items-start gap-3" data-testid={`why-list-roadmap-${key}`}>
                  <Icon size={18} className="shrink-0 mt-0.5 text-gray-400" />
                  <div>
                    <h3 className="font-semibold text-gray-700 text-sm">
                      {t(`whyList.${key}Title`, key)}
                    </h3>
                    <p className="text-sm text-gray-500">{t(`whyList.${key}Body`, '')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <SocialProof />

      {/* Positioning — against the real alternative, never a named rival */}
      <section className="px-6 py-14 bg-[#f2f8f8]">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {t('whyList.vsTitle', 'Better than a group chat')}
          </h2>
          <p className="text-sm text-gray-600 mb-5">
            {t(
              'whyList.vsBody',
              'Most work here still comes from scattered WhatsApp and Facebook groups — your post scrolls away in an hour, nobody can search it later, and a new customer has no way to tell whether you are any good.',
            )}
          </p>
          <ul className="space-y-2">
            {['searchable', 'trust', 'english'].map((key) => (
              <li key={key} className="flex items-start gap-2 text-sm text-gray-700">
                <Check size={16} className="shrink-0 mt-0.5 text-[#1E6A6A]" />
                {t(`whyList.vs_${key}`, '')}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Pricing — same live ladder as the dashboard, from the same endpoint */}
      <section className="px-6 py-14">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
            {t('whyList.pricingTitle', 'Simple pricing')}
          </h2>
          <p className="text-sm text-gray-600 mb-6 text-center">
            {t('whyList.pricingBody', 'The longer you commit, the lower the monthly rate. Start with 30 days free.')}
          </p>
          <PlanPicker value={planKey} onChange={setPlanKey} />
          <div className="text-center mt-6">
            <button
              onClick={startListing}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-white transition-all hover:shadow-md active:scale-[0.98]"
              style={{ backgroundColor: '#1E6A6A' }}
              data-testid="why-list-pricing-cta"
            >
              {t('whyList.startListing', 'Start listing')}
              <ArrowRight size={16} className="rtl:rotate-180" />
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            {t('whyList.faqTitle', 'Questions')}
          </h2>
          <div className="space-y-4">
            {FAQ_KEYS.map((key) => (
              <div key={key} data-testid={`why-list-faq-${key}`}>
                <h3 className="font-semibold text-gray-900 text-sm mb-1">
                  {t(`whyList.faq_${key}_q`, key)}
                </h3>
                <p className="text-sm text-gray-600">{t(`whyList.faq_${key}_a`, '')}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-500 mt-8">
            {t('whyList.browseFirst', 'Want to look around first?')}{' '}
            <Link to="/services" className="text-[#1E6A6A] font-semibold hover:underline">
              {t('whyList.browseServices', 'Browse the services marketplace')}
            </Link>
          </p>
        </div>
      </section>
    </div>
  );
};

export default WhyList;
