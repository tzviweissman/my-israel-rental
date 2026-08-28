import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Languages, CalendarDays, Truck, Timer, Wallet, BadgeCheck, ScrollText } from 'lucide-react';
import { needsDirectoryDisclaimer } from '../../lib/categories';

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

// Kosher certification is shown only where it means something. A plumber
// with a hechsher is not a signal; a bakery without one is. Matched on
// the business's own categories rather than guessed from its name.
const FOOD_CATEGORIES = new Set([
  'food', 'catering', 'bakery', 'restaurant', 'grocery', 'butcher', 'caterer',
]);

export const isFoodBusiness = (categories = []) =>
  (categories || []).some((c) => FOOD_CATEGORIES.has(String(c).toLowerCase()));

export default function GoodToKnow({ business }) {
  const { t } = useTranslation();
  const b = business || {};

  const years = b.founded_year
    ? Math.max(0, new Date().getFullYear() - Number(b.founded_year))
    : null;

  const rows = [
    b.hours && { key: 'hours', Icon: Clock, label: t('businessPage.hours', 'Hours'), value: b.hours },
    (b.languages || []).length > 0 && {
      key: 'languages', Icon: Languages,
      label: t('businessPage.languages', 'Languages'),
      value: b.languages.join(' · '),
    },
    // Only worth saying once it is a real number. "0 years in business"
    // is worse than silence for someone who started this year.
    years !== null && years >= 1 && {
      key: 'years', Icon: CalendarDays,
      label: t('businessPage.yearsInBusiness', 'In business'),
      value: t('businessPage.yearsValue', '{{n}} years', { n: years }),
    },
    b.delivery_note && { key: 'delivery', Icon: Truck, label: t('businessPage.delivery', 'Delivery'), value: b.delivery_note },
    b.lead_time && { key: 'lead', Icon: Timer, label: t('businessPage.leadTime', 'Notice needed'), value: b.lead_time },
    b.payment_note && { key: 'payment', Icon: Wallet, label: t('businessPage.payment', 'Payment'), value: b.payment_note },
  ].filter(Boolean);

  const cert = b.kosher_certification;
  const showCert = !!(cert && cert.body && isFoodBusiness(b.categories));

  // Same rule as the hechsher above: shown only where it means
  // something. A licence number on a cleaner is noise; on a money
  // changer it is one of the few checkable facts on the page.
  const regulated = (b.categories || []).some(needsDirectoryDisclaimer);
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
