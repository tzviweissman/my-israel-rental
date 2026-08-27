/**
 * `/what-you-can-do` — the feature library (spec Part 1, F1–F5).
 *
 * The site does a lot and almost nobody discovers any of it. A plumber
 * does not care about iCal sync; a traveller does not care about bulk
 * upload. So the list is filtered by who you are rather than presented in
 * full and left for the reader to sort out.
 *
 * F1 — three audiences, matching `/join`. Signed out, the tabs default to
 * Business owner: the supply side is the lead per CLAUDE.md positioning,
 * and this page is one of the surfaces that note explicitly governs.
 * Signed in, it opens on the visitor's own role.
 *
 * F2 — card, then a real page. Every card links to `/features/{slug}`
 * rather than opening a modal, so each one is linkable, shareable and
 * indexable. An owner can send a customer straight to the thing that
 * answers their question.
 */
import React, { useContext, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { ArrowRight } from 'lucide-react';
import { AuthContext } from '../App';
import PageMeta from '../components/PageMeta';
import SiteFooter from '../components/common/SiteFooter';
import { AUDIENCES, featuresFor, defaultAudience } from '../data/featureLibrary';

export default function WhatYouCanDo() {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const [audience, setAudience] = useState(() => defaultAudience(user?.role));
  const features = useMemo(() => featuresFor(audience), [audience]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 'var(--nav-h, 68px)' }}
      data-testid="what-you-can-do">
      <PageMeta
        title={`${t('features.metaTitle', 'What you can do here')} — MyIsraelRental`}
        description={t('features.metaDescription',
          'Everything MyIsraelRental does for businesses, hosts and travellers — free to list, free to be found.')}
        path="/what-you-can-do"
      />

      <div className="max-w-5xl mx-auto px-4 py-10 sm:py-14">
        <h1
          className="text-3xl sm:text-4xl font-bold"
          // `var(--font-head)`, never the literal face — Playfair has no
          // Hebrew glyphs and an inline literal beats the RTL swap.
          style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}
        >
          {t('features.title', 'What you can do here')}
        </h1>
        <p className="mt-2 text-[15px] max-w-2xl" style={{ color: 'var(--brand-muted)' }}>
          {t('features.intro', 'Free to list, free to be found, and no commission. Here is what the site actually does — pick the one that sounds like you.')}
        </p>

        {/* F1 — the three audiences, in the same order and with the same
            names as /join, so nobody has to work out which one they are
            twice. */}
        <div
          className="mt-6 inline-flex flex-wrap gap-1 p-1 rounded-full"
          role="tablist"
          style={{ background: 'rgb(var(--brand-primary-rgb) / 0.07)' }}
        >
          {AUDIENCES.map((a) => {
            const on = a === audience;
            return (
              <button
                key={a}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setAudience(a)}
                className="px-4 py-2 rounded-full text-sm font-semibold transition-colors"
                style={on
                  ? { background: 'var(--brand-primary)', color: '#fff' }
                  : { color: 'var(--brand-primary)' }}
                data-testid={`features-tab-${a}`}
              >
                {t(`features.audience.${a}`, a)}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6"
          data-testid="features-grid">
          {features.map((f) => {
            // Named in the data, resolved here, so the data module stays a
            // plain list with no React in it.
            const Icon = Icons[f.icon] || Icons.Sparkles;
            return (
              <Link
                key={f.slug}
                to={`/features/${f.slug}`}
                className="rounded-2xl border p-5 bg-white transition-shadow hover:shadow-md flex flex-col"
                style={{ borderColor: 'var(--brand-border)' }}
                data-testid={`feature-card-${f.slug}`}
              >
                <span
                  className="inline-flex items-center justify-center w-10 h-10 rounded-xl mb-3"
                  style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)' }}
                >
                  <Icon size={19} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
                </span>
                <h2 className="text-base font-bold"
                  style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
                  {t(`features.item.${f.slug}.title`, f.slug)}
                </h2>
                <p className="text-sm mt-1.5 flex-1" style={{ color: 'var(--brand-muted)' }}>
                  {t(`features.item.${f.slug}.benefit`, '')}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-semibold mt-3"
                  style={{ color: 'var(--brand-primary)' }}>
                  {t('features.more', 'How it works')}
                  <ArrowRight size={14} aria-hidden="true" className="rtl:rotate-180" />
                </span>
              </Link>
            );
          })}
        </div>

        {/* The standing supply-side CTA. Free to list, free to be found,
            no commission — and never addressed only to property owners. */}
        <div
          className="mt-10 rounded-2xl border p-5 flex flex-wrap items-center justify-between gap-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--brand-border)' }}
        >
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            {t('features.ctaBand', 'Have something to offer? Add your business — free.')}
          </p>
          <Link
            to="/signup"
            className="btn-gold inline-flex items-center gap-2 px-5 py-2.5 text-sm"
            data-testid="features-cta"
          >
            {t('features.ctaButton', 'Add your business')}
          </Link>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
