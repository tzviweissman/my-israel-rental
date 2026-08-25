import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, FileCheck, ArrowRight, X, Sparkles, MessageCircle, Wallet } from 'lucide-react';

/**
 * The three things this product actually does for a new member, one line
 * each. Every one is a feature that exists and can be pointed at.
 *
 * This card used to advertise the government-document service — Arnona
 * discount, property name change, "quickly and professionally" — which is
 * DISCONTINUED (see CLAUDE.md). It was still the second thing every new
 * signup saw, so the site's first promise to a new member was for
 * something it no longer sells.
 *
 * Notably absent: any "verified listing" badge. There is no verification
 * feature — FeaturedProviders.jsx already refuses the same badge for the
 * same reason — and a trust mark for a check nobody performs is worse than
 * no trust mark at all.
 */
const WELCOME_POINTS = [
  { key: 'chat', icon: MessageCircle },
  { key: 'fees', icon: Wallet },
  { key: 'contract', icon: FileCheck },
];

const WelcomePopups = ({ onDismiss }) => {
  const { t } = useTranslation();
  const [currentPopup, setCurrentPopup] = useState(0); // 0 = first, 1 = second, 2 = done
  const [animating, setAnimating] = useState(false);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Auto-advance from first popup after 4 seconds
    if (currentPopup === 0) {
      const timer = setTimeout(() => {
        advancePopup();
      }, 4500);
      return () => clearTimeout(timer);
    }
    // Auto-dismiss second popup after 5 seconds
    if (currentPopup === 1) {
      const timer = setTimeout(() => {
        dismissAll();
      }, 5500);
      return () => clearTimeout(timer);
    }
  }, [currentPopup]);

  const advancePopup = () => {
    setAnimating(true);
    setTimeout(() => {
      setCurrentPopup(1);
      setAnimating(false);
    }, 300);
  };

  const dismissAll = () => {
    setVisible(false);
    setTimeout(() => {
      if (onDismiss) onDismiss();
    }, 400);
  };

  if (currentPopup >= 2 || !visible) return null;

  return (
    <div className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-400 ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={dismissAll}
      />

      {/* Popup Card */}
      <div
        className={`relative w-full max-w-md mx-4 transform transition-all duration-500 ${animating ? 'scale-90 opacity-0' : 'scale-100 opacity-100'}`}
      >
        {currentPopup === 0 && (
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl" data-testid="welcome-popup-sublease">
            {/* Header gradient */}
            <div className="bg-gradient-to-br from-[var(--brand-primary)] to-[#267a7a] px-8 pt-8 pb-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
              <button
                onClick={dismissAll}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X size={16} className="text-white" />
              </button>
              <div className="relative z-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  <Home size={30} className="text-white" />
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles size={16} className="text-[var(--gold)]" />
                  <span className="text-xs font-semibold text-[var(--gold)] uppercase tracking-wider">{t('welcome.newFeature')}</span>
                  <Sparkles size={16} className="text-[var(--gold)]" />
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-8 text-center -mt-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'var(--font-head)' }}>
                  {t('welcome.subleaseTitle')}
                </h2>
                <p className="text-lg text-gray-600">
                  {t('welcome.subleaseSub')}
                </p>
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={advancePopup}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:shadow-lg active:scale-95"
                    style={{ backgroundColor: 'var(--gold)' }}
                  >
                    {t('welcome.learnMore')} <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex justify-center gap-2 pb-6">
              <div className="w-8 h-1.5 rounded-full bg-[var(--brand-primary)]" />
              <div className="w-8 h-1.5 rounded-full bg-gray-200" />
            </div>
          </div>
        )}

        {currentPopup === 1 && (
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl" data-testid="welcome-popup-services">
            {/* Header gradient */}
            <div className="bg-gradient-to-br from-[var(--gold)] to-[#c4a030] px-8 pt-8 pb-12 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-10 translate-x-10" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-8 -translate-x-8" />
              <button
                onClick={dismissAll}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/15 hover:bg-white/30 flex items-center justify-center transition-colors"
              >
                <X size={16} className="text-white" />
              </button>
              <div className="relative z-10 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
                  <FileCheck size={30} className="text-white" />
                </div>
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Sparkles size={16} className="text-white" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">{t('welcome.premiumService')}</span>
                  <Sparkles size={16} className="text-white" />
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-8 text-center -mt-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-6">
                {/* `var(--font-head)`, not the literal face: Playfair has no
                    Hebrew glyphs and an inline literal beats the RTL swap in
                    design-tokens.css, so a Hebrew heading silently falls back
                    to a system serif. */}
                <h2 className="text-2xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'var(--font-head)' }}>
                  {t('welcome.servicesTitle')}
                </h2>
                <ul className="space-y-3 text-start">
                  {WELCOME_POINTS.map(({ key, icon: Icon }) => (
                    <li key={key} className="flex items-start gap-2.5">
                      <Icon size={16} className="shrink-0 mt-0.5 text-[var(--brand-primary)]" aria-hidden="true" />
                      <span className="text-sm text-gray-600 leading-relaxed">
                        {t(`welcome.point_${key}`)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-5 flex justify-center">
                  <button
                    onClick={dismissAll}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:shadow-lg active:scale-95"
                    style={{ backgroundColor: 'var(--brand-primary)' }}
                  >
                    {t('welcome.goToDashboard')} <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex justify-center gap-2 pb-6">
              <div className="w-8 h-1.5 rounded-full bg-gray-200" />
              <div className="w-8 h-1.5 rounded-full bg-[var(--gold)]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomePopups;
