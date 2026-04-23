import React, { useState } from 'react';
import axios from 'axios';
import { FileCheck, Check, Send } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Renter services tab: submit requests for Arnona discounts, property name
 * changes, etc. Posts to /api/service-requests. Self-contained.
 */
const GovernmentServicesTab = ({ API, token }) => {
  const [form, setForm] = useState({
    full_name: '',
    id_number: '',
    address: '',
    service_type: 'arnona_discount',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await axios.post(
        `${API}/service-requests`,
        { service_type: 'government', ...form },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success('Service request submitted! We will contact you shortly.');
      setForm({ full_name: '', id_number: '', address: '', service_type: 'arnona_discount', notes: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const inputCls =
    'w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] text-sm';

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
              <h3 className="text-lg font-bold text-white">Government Document Services</h3>
              <p className="text-white/80 text-sm">Let us handle the hassle for you</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <p className="text-gray-600 text-sm mb-4 leading-relaxed">
            We take care of all government documents, your{' '}
            <strong className="text-[#1E6A6A]">Arnona discount</strong>, and the{' '}
            <strong className="text-[#1E6A6A]">property name change</strong> — quickly and professionally.
          </p>

          <div className="flex flex-wrap gap-2 mb-5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1E6A6A]/10 text-[#1E6A6A] text-xs font-medium">
              <Check size={12} /> Arnona Discount
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] text-xs font-medium">
              <Check size={12} /> Property Name Change
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
              <Check size={12} /> Government Forms
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" data-testid="government-service-form">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Legal Name</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="As it appears on your ID"
                  className={inputCls}
                  required
                  data-testid="gov-fullname-input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">ID / Passport Number</label>
                <input
                  type="text"
                  value={form.id_number}
                  onChange={(e) => setForm({ ...form, id_number: e.target.value })}
                  placeholder="ID or Teudat Zehut number"
                  className={inputCls}
                  required
                  data-testid="gov-id-input"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Property Address</label>
              <input
                type="text"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Full property address"
                className={inputCls}
                required
                data-testid="gov-address-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Service Needed</label>
              <select
                value={form.service_type}
                onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                className={inputCls}
                required
                data-testid="gov-service-type-select"
              >
                <option value="arnona_discount">Arnona Discount Application</option>
                <option value="name_change">Property Name Change</option>
                <option value="both">Both — Arnona Discount + Name Change</option>
                <option value="other">Other Government Documents</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any specific details about your request"
                rows={3}
                className={`${inputCls} resize-none`}
                data-testid="gov-notes-input"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-all hover:shadow-md"
              style={{ backgroundColor: '#D4AF37' }}
              data-testid="gov-submit-btn"
            >
              <Send size={16} />
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default GovernmentServicesTab;
