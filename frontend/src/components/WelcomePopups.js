import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Home, FileCheck, ArrowRight, X, Sparkles } from 'lucide-react';
import DOMPurify from 'dompurify';

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
            <div className="bg-gradient-to-br from-[#1E6A6A] to-[#267a7a] px-8 pt-8 pb-12 relative overflow-hidden">
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
                  <Sparkles size={16} className="text-[#D4AF37]" />
                  <span className="text-xs font-semibold text-[#D4AF37] uppercase tracking-wider">{t('welcome.newFeature')}</span>
                  <Sparkles size={16} className="text-[#D4AF37]" />
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-8 text-center -mt-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Playfair Display' }}>
                  {t('welcome.subleaseTitle')}
                </h2>
                <p className="text-lg text-gray-600">
                  {t('welcome.subleaseSub')}
                </p>
                <div className="mt-4 flex justify-center">
                  <button
                    onClick={advancePopup}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:shadow-lg active:scale-95"
                    style={{ backgroundColor: '#D4AF37' }}
                  >
                    {t('welcome.learnMore')} <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex justify-center gap-2 pb-6">
              <div className="w-8 h-1.5 rounded-full bg-[#1E6A6A]" />
              <div className="w-8 h-1.5 rounded-full bg-gray-200" />
            </div>
          </div>
        )}

        {currentPopup === 1 && (
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl" data-testid="welcome-popup-services">
            {/* Header gradient */}
            <div className="bg-gradient-to-br from-[#D4AF37] to-[#c4a030] px-8 pt-8 pb-12 relative overflow-hidden">
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
                <h2 className="text-2xl font-bold text-gray-900 mb-3" style={{ fontFamily: 'Playfair Display' }}>
                  {t('welcome.servicesTitle')}
                </h2>
                <p
                  className="text-sm text-gray-600 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(t('welcome.servicesDesc')) }}
                />
                <div className="mt-5 flex justify-center">
                  <button
                    onClick={dismissAll}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:shadow-lg active:scale-95"
                    style={{ backgroundColor: '#1E6A6A' }}
                  >
                    {t('welcome.goToDashboard')} <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </div>

            {/* Progress dots */}
            <div className="flex justify-center gap-2 pb-6">
              <div className="w-8 h-1.5 rounded-full bg-gray-200" />
              <div className="w-8 h-1.5 rounded-full bg-[#D4AF37]" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WelcomePopups;
