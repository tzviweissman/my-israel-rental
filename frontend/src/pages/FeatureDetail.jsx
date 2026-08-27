/**
 * `/features/{slug}` — one feature, in full (spec Part 1, F2).
 *
 * A real page rather than a modal, deliberately: linkable, shareable and
 * indexable. An owner answering "can your site do X?" can send the answer
 * instead of describing it, and a search engine can find it.
 *
 * Structure per F2: what it is, who it's for, and ONE call to action
 * straight into using it. One, not three — a page that offers three next
 * steps is a page nobody takes a step from.
 *
 * NOT INCLUDED, and it is a real gap: F2 also asks for "a screenshot or a
 * short animation" on each detail page. There are 15 of these and no
 * captured assets for any of them, and inventing placeholder imagery would
 * be worse than an honest text page. Flagged rather than faked.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams, Navigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { ArrowLeft, Check } from 'lucide-react';
import PageMeta from '../components/PageMeta';
import SiteFooter from '../components/common/SiteFooter';
import { featureBySlug } from '../data/featureLibrary';

export default function FeatureDetail() {
  const { t } = useTranslation();
  const { slug } = useParams();
  const feature = featureBySlug(slug);

  // An unknown slug goes back to the library rather than to a 404 page:
  // these URLs get shared, and a renamed feature should land somewhere
  // useful rather than on a dead end.
  if (!feature) return <Navigate to="/what-you-can-do" replace />;

  const Icon = Icons[feature.icon] || Icons.Sparkles;
  const title = t(`features.item.${slug}.title`, slug);
  const benefit = t(`features.item.${slug}.benefit`, '');
  const body = t(`features.item.${slug}.body`, '');
  const forWho = t(`features.item.${slug}.forWho`, '');

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)', paddingTop: 'var(--nav-h, 68px)' }}
      data-testid={`feature-detail-${slug}`}>
      <PageMeta
        title={`${title} — MyIsraelRental`}
        description={benefit}
        path={`/features/${slug}`}
      />

      <div className="max-w-2xl mx-auto px-4 py-10 sm:py-14">
        <Link
          to="/what-you-can-do"
          className="inline-flex items-center gap-1.5 text-sm font-semibold"
          style={{ color: 'var(--brand-primary)' }}
          data-testid="feature-back"
        >
          <ArrowLeft size={15} aria-hidden="true" className="rtl:rotate-180" />
          {t('features.backToAll', 'All features')}
        </Link>

        {/* A `div`, not an inline `span`: the back link above is inline, so
            an inline-flex icon sat on the same line as it instead of
            starting the page. Visible in both directions. */}
        <div
          className="flex items-center justify-center w-12 h-12 rounded-2xl mt-6 mb-4"
          style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)' }}
        >
          <Icon size={22} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold"
          style={{ fontFamily: 'var(--font-head)', color: 'var(--ink)' }}>
          {title}
        </h1>
        <p className="mt-3 text-lg" style={{ color: 'var(--brand-muted)' }}>{benefit}</p>

        {body ? (
          <p className="mt-6 text-[15px] leading-relaxed" style={{ color: 'var(--ink)' }}
            data-testid="feature-body">
            {body}
          </p>
        ) : null}

        {forWho ? (
          <div
            className="mt-6 rounded-xl border p-4 flex items-start gap-2.5"
            style={{ background: 'var(--surface)', borderColor: 'var(--brand-border)' }}
          >
            <Check size={16} className="shrink-0 mt-0.5" aria-hidden="true"
              style={{ color: 'var(--brand-primary)' }} />
            <p className="text-sm" style={{ color: 'var(--ink)' }}>
              <strong>{t('features.forWho', 'Who it is for')}: </strong>{forWho}
            </p>
          </div>
        ) : null}

        {/* Exactly one CTA, straight into using it. */}
        <Link
          to={feature.cta}
          className="btn-gold inline-flex items-center gap-2 px-6 py-3 text-sm mt-8"
          data-testid="feature-cta"
        >
          {t(`features.item.${slug}.cta`, t('features.defaultCta', 'Try it'))}
        </Link>
      </div>

      <SiteFooter />
    </div>
  );
}
