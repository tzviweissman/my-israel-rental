import React, { useContext, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Check, Info } from 'lucide-react';
import { AuthContext } from '../App';
import PayPalCheckout from '../components/PayPalCheckout';

const SERVICES = [
  {
    key: 'arnona_discount',
    label: 'Arnona discount filing',
    hint: 'We prepare and file your Arnona (municipal tax) discount request with the city.',
    price: 150,
  },
  {
    key: 'property_name_change',
    label: 'Property name change',
    hint: 'Officially change the name on record for electricity, water, and Arnona.',
    price: 150,
  },
];

const BUNDLE_PRICE = 250; // both together

const DocumentService = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [selected, setSelected] = useState(['arnona_discount']);
  const [form, setForm] = useState({
    property_address: '',
    tenant_name: user?.name || '',
    tenant_id: '',
    additional_info: '',
  });

  const total = useMemo(() => {
    if (selected.length >= 2) return BUNDLE_PRICE;
    if (selected.length === 1) return 150;
    return 0;
  }, [selected]);

  const valid = useMemo(() => (
    selected.length >= 1 &&
    form.property_address.trim() &&
    form.tenant_name.trim() &&
    form.tenant_id.trim()
  ), [selected, form]);

  const toggle = (key) => {
    setSelected((prev) => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const metadata = {
    services: selected,
    property_address: form.property_address,
    tenant_name: form.tenant_name,
    details: {
      tenant_id: form.tenant_id,
      additional_info: form.additional_info,
    },
  };

  return (
    <div className="min-h-screen bg-[#fafafa] pt-20 pb-16" data-testid="document-service-page">
      <div className="max-w-4xl mx-auto px-6">
        <h1 className="text-4xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }}>
          Document Filing Service
        </h1>
        <p className="text-gray-500 mb-8">
          Pick a service, enter the property details, and pay securely with PayPal. We'll handle the filing.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_360px] gap-8">
          {/* Left: form */}
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
                  <span>Bundle discount applied: both services for <strong>$250</strong> instead of $300.</span>
                </div>
              )}
            </div>

            <h2 className="text-base font-semibold mb-4">2. Property & tenant details</h2>
            <form className="space-y-4" onSubmit={(e) => e.preventDefault()} data-testid="document-service-form">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Property Address</label>
                <input
                  type="text"
                  value={form.property_address}
                  onChange={(e) => setForm({ ...form, property_address: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
                  placeholder="e.g. Dizengoff 10, Tel Aviv"
                  required
                  data-testid="property-address-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tenant Name</label>
                <input
                  type="text"
                  value={form.tenant_name}
                  onChange={(e) => setForm({ ...form, tenant_name: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
                  required
                  data-testid="tenant-name-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Tenant ID</label>
                <input
                  type="text"
                  value={form.tenant_id}
                  onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
                  required
                  data-testid="tenant-id-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional Information</label>
                <textarea
                  value={form.additional_info}
                  onChange={(e) => setForm({ ...form, additional_info: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
                  placeholder="Any context we should know (optional)"
                  data-testid="additional-info-input"
                />
              </div>
            </form>
          </div>

          {/* Right: payment summary — allowed to flow with the page so long
              forms scroll normally; on taller screens it stays near the top. */}
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
                  <dd>-$50</dd>
                </div>
              )}
            </dl>
            <div className="border-t border-gray-100 pt-3 mb-5 flex justify-between items-baseline">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-2xl font-bold text-[#1E6A6A]" data-testid="service-total">${total}</span>
            </div>
            {!valid ? (
              <p className="text-xs text-gray-500 text-center" data-testid="fill-form-hint">
                Select at least one service and fill in the property + tenant details to continue.
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
