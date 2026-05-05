import React, { useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCheck, Check, Info, MessageCircle } from 'lucide-react';
import { AuthContext } from '../../App';
import PayPalCheckout from '../PayPalCheckout';
import { DOC_SERVICES, computeTotal, computeSavings } from '../../lib/documentServices';

/**
 * Renter dashboard tab: paid document services. The renter picks the
 * services they want, pays via PayPal, and we email them a checklist of the
 * info to send us via WhatsApp so we can complete the filings.
 */
const GovernmentServicesTab = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const [selected, setSelected] = useState(['kitzvat_yeladim']);

  const total = useMemo(() => computeTotal(selected), [selected]);
  const savings = useMemo(() => computeSavings(selected), [selected]);
  const valid = selected.length >= 1;

  const toggle = (key) => {
    setSelected((prev) => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const metadata = {
    services: selected,
    contact_name: user?.name || '',
    contact_email: user?.email || '',
  };

  return (
    <div className="space-y-6" data-testid="services-tab">
      <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
        Our Services
      </h2>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-[#D4AF37] to-[#c4a030] px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
              <FileCheck size={24} className="text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Document Filing Services</h3>
              <p className="text-white/80 text-sm">We file the forms — you keep the benefits</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-gray-600 text-sm mb-5 leading-relaxed">
            Pick the filings you'd like us to handle — Bituach Leumi benefits, Arnona discount, or apartment name change.
            After payment we'll email you a checklist of details to send us on WhatsApp, then we file the forms for you.
          </p>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
            {/* Left: service picker */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-3">1. Choose your services</h4>
              <div className="space-y-2.5 mb-4">
                {DOC_SERVICES.map(svc => {
                  const isOn = selected.includes(svc.key);
                  return (
                    <button
                      key={svc.key}
                      type="button"
                      onClick={() => toggle(svc.key)}
                      className={`w-full text-left flex items-start gap-3 rounded-xl border p-4 transition-all ${isOn ? 'border-[#1E6A6A] bg-[#1E6A6A]/5' : 'border-gray-200 hover:border-gray-300'}`}
                      data-testid={`service-option-${svc.key}`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 ${isOn ? 'bg-[#1E6A6A] text-white' : 'border-2 border-gray-300 bg-white'}`}>
                        {isOn && <Check size={12} strokeWidth={3} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-gray-900">{svc.label}</p>
                          <span className="text-sm font-semibold text-[#1E6A6A]">${svc.price}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{svc.hint}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              {savings > 0 ? (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800" data-testid="bundle-notice">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>Bundle discount applied — you saved <strong>${savings}</strong>. Every additional pair saves another $50.</span>
                </div>
              ) : (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs text-gray-600">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>Add another service to unlock <strong>$50 off</strong> — every pair you bundle saves $50.</span>
                </div>
              )}

              <div className="mt-6 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                <h4 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                  <MessageCircle size={14} className="text-[#25D366]" />
                  How it works
                </h4>
                <ol className="space-y-1.5 text-xs text-gray-600">
                  <li data-testid="how-it-works-step-1">1. Pick your services and pay with PayPal.</li>
                  <li data-testid="how-it-works-step-2">2. We email you a checklist of documents and details.</li>
                  <li data-testid="how-it-works-step-3">3. Send the info to us on WhatsApp — we file the forms.</li>
                </ol>
              </div>
            </div>

            {/* Right: pay panel */}
            <aside className="bg-white rounded-xl border border-gray-200 p-5 h-fit" data-testid="payment-panel">
              <h4 className="text-sm font-semibold text-gray-700 mb-3">2. Review & pay</h4>
              <dl className="space-y-1.5 text-sm mb-3">
                {selected.map(k => {
                  const svc = DOC_SERVICES.find(s => s.key === k);
                  return (
                    <div key={k} className="flex justify-between">
                      <dt className="text-gray-600 truncate pr-2">{svc.label}</dt>
                      <dd className="text-gray-900">${svc.price}</dd>
                    </div>
                  );
                })}
                {savings > 0 && (
                  <div className="flex justify-between text-amber-700">
                    <dt>Bundle discount</dt>
                    <dd>-${savings}</dd>
                  </div>
                )}
              </dl>
              <div className="border-t border-gray-100 pt-3 mb-4 flex justify-between items-baseline">
                <span className="text-sm font-semibold text-gray-700">Total</span>
                <span className="text-2xl font-bold text-[#1E6A6A]" data-testid="service-total">${total}</span>
              </div>
              {!valid ? (
                <p className="text-xs text-gray-500 text-center" data-testid="fill-form-hint">
                  Select at least one service to continue.
                </p>
              ) : (
                <PayPalCheckout
                  productType="document_service"
                  metadata={metadata}
                  currency="USD"
                  onCaptured={(order) => {
                    navigate(`/payment/success?orderId=${order.id}`);
                  }}
                />
              )}
              <p className="text-[11px] text-gray-400 text-center mt-3 leading-relaxed">
                Secure PayPal checkout. You'll receive a receipt + checklist by email.
              </p>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GovernmentServicesTab;
