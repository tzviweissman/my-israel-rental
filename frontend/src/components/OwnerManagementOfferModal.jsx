import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Sparkles, Users, Wrench, MessageCircle, Check } from 'lucide-react';

// Same WhatsApp number used by the global floating WhatsAppButton.
const WHATSAPP_NUMBER = '972553225141';
const WHATSAPP_PREFILL =
  "Hi! I just signed up as an owner and I'd like to learn more about your property management services.";

/**
 * Pitched at owners right after signup: tell them we'll handle their
 * property end-to-end (find tenants, deal with maintenance, etc.) and let
 * them DM us on WhatsApp in one tap.
 */
const OwnerManagementOfferModal = ({ open, onDismiss }) => {
  const { t } = useTranslation();
  if (!open) return null;

  const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_PREFILL)}`;

  const benefits = [
    {
      icon: Users,
      title: t('ownerOffer.findTenants', 'We find your tenants'),
      copy: t(
        'ownerOffer.findTenantsCopy',
        'We list your property, screen renters, and run viewings — you just approve who moves in.',
      ),
    },
    {
      icon: Wrench,
      title: t('ownerOffer.handleIssues', 'We handle every issue'),
      copy: t(
        'ownerOffer.handleIssuesCopy',
        'Plumbing, electricity, neighbour disputes — your tenants call us, not you.',
      ),
    },
    {
      icon: Sparkles,
      title: t('ownerOffer.fullService', 'You stay hands-off'),
      copy: t(
        'ownerOffer.fullServiceCopy',
        "Rent collection, contract renewals, end-of-stay walkthroughs — we run it. You get the income.",
      ),
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-8 bg-black/55 backdrop-blur-sm overflow-y-auto"
      data-testid="owner-management-offer-backdrop"
      onClick={onDismiss}
    >
      <div
        className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden"
        data-testid="owner-management-offer-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 z-10 p-1.5 rounded-full bg-white/95 hover:bg-gray-100 text-gray-600 transition-colors"
          aria-label="Close"
          data-testid="owner-management-offer-close"
        >
          <X size={18} />
        </button>

        <div className="bg-gradient-to-br from-[#1E6A6A] via-[#1E6A6A] to-[#155454] text-white px-7 pt-8 pb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-1 rounded-full bg-[#D4AF37] text-[#1E6A6A] text-[10px] font-bold uppercase tracking-wider">
              {t('ownerOffer.tag', 'Owner perk')}
            </span>
          </div>
          <h2
            className="text-2xl md:text-3xl font-bold leading-tight"
            style={{ fontFamily: 'Playfair Display' }}
          >
            {t('ownerOffer.title', 'Want us to manage your property for you?')}
          </h2>
          <p className="text-sm text-white/80 mt-2 leading-relaxed">
            {t(
              'ownerOffer.subtitle',
              "Owning a rental shouldn't feel like a second job. Let our team take it off your plate end-to-end.",
            )}
          </p>
        </div>

        <div className="px-7 py-6 space-y-4">
          {benefits.map((b) => (
            <div key={b.title} className="flex items-start gap-3">
              <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-[#1E6A6A]/10 text-[#1E6A6A] flex items-center justify-center mt-0.5">
                <b.icon size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                  <Check size={13} className="text-[#1E6A6A]" /> {b.title}
                </p>
                <p className="text-xs text-gray-600 leading-relaxed mt-0.5">{b.copy}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-7 pb-7 flex flex-col-reverse sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={onDismiss}
            className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors border border-gray-200"
            data-testid="owner-management-offer-decline"
          >
            {t('ownerOffer.dismiss', 'Maybe later')}
          </button>
          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onDismiss}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold text-white bg-[#25D366] hover:bg-[#1fb558] transition-colors shadow-sm"
            data-testid="owner-management-offer-whatsapp"
          >
            <MessageCircle size={16} />
            {t('ownerOffer.contactCta', 'Chat with us on WhatsApp')}
          </a>
        </div>
      </div>
    </div>
  );
};

export default OwnerManagementOfferModal;
