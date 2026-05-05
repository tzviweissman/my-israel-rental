import React, { useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Check, Info, MessageCircle } from 'lucide-react';
import { AuthContext } from '../App';
import PayPalCheckout from '../components/PayPalCheckout';

const SERVICES = [
  {
    key: 'kitzvat_yeladim',
    label: 'Kitzvat Yeladim (Child Stipend)',
    hint: 'We register and file your monthly child allowance claim with Bituach Leumi.',
    price: 150,
  },
  {
    key: 'maanak_leidah',
    label: 'Maanak Leidah (Birth Grant)',
    hint: 'We file your one-time birth grant claim with Bituach Leumi.',
    price: 150,
  },
  {
    key: 'birth_expenses',
    label: 'Birth expenses',
    hint: 'We submit your reimbursement claim for hospitalization and birth-related expenses.',
    price: 150,
  },
];

const BUNDLE_PRICE = 250; // any 2 or more

const DocumentService = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [selected, setSelected] = useState(['kitzvat_yeladim']);

  const total = useMemo(() => {
    if (selected.length >= 2) return BUNDLE_PRICE;
    if (selected.length === 1) return 150;
    return 0;
  }, [selected]);

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
    <div className="min-h-screen bg-[#fafafa] pt-20 pb-16" data-testid="document-service-page">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }}>
          Bituach Leumi Benefits
        </h1>
        <p className="text-gray-500 mb-8">
          Pick the benefits you need. Pay securely with PayPal — we'll email you exactly what info to send us on WhatsApp so we can file the forms for you.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
          {/* Left: services + how-it-works */}
          <div className="bg-white rounded-2xl p-7 border border-gray-100">
            <h2 className="text-base font-semibold mb-4">1. Choose your services</h2>
            <div className="space-y-3 mb-8">
              {SERVICES.map(svc => {
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
              {selected.length >= 2 && (
                <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800" data-testid="bundle-notice">
                  <Info size={14} className="mt-0.5 shrink-0" />
                  <span>Bundle discount applied: any 2 or more services for <strong>$250</strong> — you save $50+.</span>
                </div>
              )}
            </div>

            <h2 className="text-base font-semibold mb-4">2. How it works</h2>
            <ol className="space-y-3 text-sm text-gray-600">
              <li className="flex items-start gap-3" data-testid="how-it-works-step-1">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1E6A6A]/10 text-[#1E6A6A] text-xs font-bold flex items-center justify-center">1</span>
                <span>Pick your benefits and pay securely with PayPal.</span>
              </li>
              <li className="flex items-start gap-3" data-testid="how-it-works-step-2">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1E6A6A]/10 text-[#1E6A6A] text-xs font-bold flex items-center justify-center">2</span>
                <span>We email you a checklist of the documents and details we need.</span>
              </li>
              <li className="flex items-start gap-3" data-testid="how-it-works-step-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1E6A6A]/10 text-[#1E6A6A] text-xs font-bold flex items-center justify-center">3</span>
                <span className="flex items-center gap-1.5">
                  Send everything to us on WhatsApp <MessageCircle size={14} className="text-[#25D366]" /> and we file the forms with Bituach Leumi.
                </span>
              </li>
            </ol>
          </div>

          {/* Right: payment summary */}
          <aside className="bg-white rounded-2xl p-7 border border-gray-100 h-fit md:sticky md:top-24 md:max-h-[calc(100vh-120px)] md:overflow-y-auto" data-testid="payment-panel">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={18} className="text-[#D4AF37]" />
              <h2 className="text-base font-semibold">3. Review & pay</h2>
            </div>
            <dl className="space-y-2 text-sm mb-4">
              {selected.map(k => {
                const svc = SERVICES.find(s => s.key === k);
                return (
                  <div key={k} className="flex justify-between">
                    <dt className="text-gray-600">{svc.label}</dt>
                    <dd className="text-gray-900">${svc.price}</dd>
                  </div>
                );
              })}
              {selected.length >= 2 && (
                <div className="flex justify-between text-amber-700">
                  <dt>Bundle discount</dt>
                  <dd>-${selected.length * 150 - BUNDLE_PRICE}</dd>
                </div>
              )}
            </dl>
            <div className="border-t border-gray-100 pt-3 mb-5 flex justify-between items-baseline">
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
            <p className="text-[11px] text-gray-400 text-center mt-4 leading-relaxed">
              Sandbox mode — real PayPal payments will show live once we flip the switch.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default DocumentService;
