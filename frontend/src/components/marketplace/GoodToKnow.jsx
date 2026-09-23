import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Languages, CalendarDays, Truck, Timer, Wallet, BadgeCheck, ScrollText } from 'lucide-react';
import { needsDirectoryDisclaimer } from '../../lib/categories';
import { isFoodBusiness, yearsInBusiness, kosherBody } from '../../utils/businessProof';

/**
 * The "Good to know" band on a business page (spec C6).
 *
 * Facts get their own band and are never interleaved with the services.
 * That is the one thing the WhatsApp catalog this was modelled on gets
 * badly wrong: its kosher certificate and its delivery terms sit in the
 * same stream as the bread, some with prices and some without, so the
 * most persuasive thing on the page reads as clutter and gets skimmed.
 *
 * Every row is optional and the whole band disappears when a business
 * has filled in none of it — which will be the common case at first, and
 * is fine. An empty "Good to know" heading advertises that we asked and
 * they did not answer.
 *
 * Years in business is DERIVED from founded_year rather than stored, so
 * it cannot go stale the way a typed "12 years" silently does.
 */

// The kosher, years and "new here" rules moved to utils/businessProof.js
// (23 Sep 2026) so the proof line beside the main button reads the same
// ones. The history of why the kosher rule looks the way it does is kept
// there too.
export { isFoodBusiness };

export default function GoodToKnow({ business }) {
  const { t } = useTranslation();
  const b = business || {};

  const years = yearsInBusiness(b.founded_year);

  const rows = [
    b.hours && { key: 'hours', Icon: Clock, label: t('businessPage.hours', 'Hours'), value: b.hours },
    (b.languages || []).length > 0 && {
      key: 'languages', Icon: Languages,
      label: t('businessPage.languages', 'Languages'),
      value: b.languages.join(' · '),
    },
    // Only worth saying once it is a real number. "0 years in business"
    // is worse than silence for someone who started this year.
    years && {
      key: 'years', Icon: CalendarDays,
      label: t('businessPage.yearsInBusiness', 'In business'),
      value: t('businessPage.yearsValue', '{{n}} years', { n: years }),
    },
    b.delivery_note && { key: 'delivery', Icon: Truck, label: t('businessPage.delivery', 'Delivery'), value: b.delivery_note },
    b.lead_time && { key: 'lead', Icon: Timer, label: t('businessPage.leadTime', 'Notice needed'), value: b.lead_time },
    // Order cutoffs (orders spec O8): "Friday orders close Thursday 14:00".
    (b.order_cutoffs || []).length > 0 && {
      key: 'cutoffs', Icon: Timer,
      label: t('businessPage.orderBy', 'Order by'),
      value: b.order_cutoffs.map((c) => t('businessPage.cutoffValue', '{{for}} orders close {{closes}} {{time}}', {
        for: t(`weekday.${c.for_day}`, String(c.for_day)),
        closes: t(`weekday.${c.closes_day}`, String(c.closes_day)),
        time: c.closes_time,
      })).join(' · '),
    },
    b.payment_note && { key: 'payment', Icon: Wallet, label: t('businessPage.payment', 'Payment'), value: b.payment_note },
  ].filter(Boolean);

  // Everything this business is known to sell — listings first, because
  // `categories` is hand-entered and usually empty.
  const known = [
    ...(b.listings || []).map((g) => g && g.category),
    ...(b.listing_categories || []),
    ...(b.categories || []),
  ].filter(Boolean);

  // Shown when a hechsher was entered AND nothing contradicts it. An
  // owner who typed a certifying body has made the claim deliberately;
  // withholding it because we could not infer "bakery" from a taxonomy
  // that has no bakery in it serves nobody.
  const cert = b.kosher_certification;
  const showCert = !!kosherBody(cert, known);

  // Same rule as the hechsher above: shown only where it means
  // something. A licence number on a cleaner is noise; on a money
  // changer it is one of the few checkable facts on the page.
  //
  // Read from the LISTINGS, not from `b.categories`. That field is only
  // ever written when an owner edits the business and fills it in by
  // hand — creating a listing does not touch it — so it is empty for
  // most businesses, and keying off it would have meant the licence
  // almost never appeared. Falls back to `categories` for a business
  // whose owner did fill it in but has no live listings yet.
  const regulated = known.some(needsDirectoryDisclaimer);
  const showLicence = !!(regulated && b.license_number);

  if (!rows.length && !showCert && !showLicence) return null;

  return (
    <section
      className="rounded-2xl border p-5 mb-8"
      style={{ background: 'var(--bg)', borderColor: 'var(--brand-border)' }}
      data-testid="business-good-to-know"
    >
      <h2
        className="text-sm font-bold uppercase tracking-wide mb-4"
        style={{ color: 'var(--brand-muted)' }}
      >
        {t('businessPage.goodToKnow', 'Good to know')}
      </h2>

      {/* The certificate first and given its own block: for a food
          business in Israel it is often the single most decisive fact on
          the page, and it earns more than a row in a list. */}
      {showCert && (
        <div
          className="flex items-start gap-3 rounded-xl p-3 mb-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--brand-border)' }}
          data-testid="business-kosher"
        >
          {cert.logo_url ? (
            <img src={cert.logo_url} alt="" className="w-11 h-11 rounded-lg object-contain shrink-0" />
          ) : (
            <span
              className="w-11 h-11 rounded-lg shrink-0 inline-flex items-center justify-center"
              style={{ background: '#E3F3EA', color: '#1F8A50' }}
            >
              <BadgeCheck size={20} />
            </span>
          )}
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
              {t('businessPage.kosher', 'Kosher certification')}
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{cert.body}</p>
            {cert.certificate_url && (
              <a
                href={cert.certificate_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold underline"
                style={{ color: 'var(--brand-primary)' }}
                data-testid="business-kosher-cert-link"
              >
                {t('businessPage.viewCertificate', 'View certificate')}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Given its own block rather than a row, for the reason the
          certificate above is: in a regulated category it is the fact a
          careful buyer is looking for. Labelled as SUPPLIED, not
          verified — we do not check it against the registrar, and a
          number presented as if we had is worse than no number. */}
      {showLicence && (
        <div
          className="flex items-start gap-3 rounded-xl p-3 mb-4"
          style={{ background: 'var(--surface)', border: '1px solid var(--brand-border)' }}
          data-testid="business-licence"
        >
          <span
            className="w-11 h-11 rounded-lg shrink-0 inline-flex items-center justify-center"
            style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)', color: 'var(--brand-primary)' }}
          >
            <ScrollText size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--brand-muted)' }}>
              {t('directory.licence', 'Licence number')}
            </p>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }} dir="auto">
              {b.license_number}
            </p>
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>
              {t('directory.licenceUnverified', 'As supplied by the business')}
            </p>
          </div>
        </div>
      )}

      {rows.length > 0 && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {rows.map(({ key, Icon, label, value }) => (
            <div key={key} className="flex items-start gap-2.5" data-testid={`gtk-${key}`}>
              <Icon size={15} className="shrink-0 mt-0.5" style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
              <div className="min-w-0">
                <dt className="text-xs font-semibold" style={{ color: 'var(--brand-muted)' }}>{label}</dt>
                <dd className="text-sm" style={{ color: 'var(--ink)' }}>{value}</dd>
              </div>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}
