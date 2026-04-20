import React, { useState } from 'react';
import { FileText, Send } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const ServicesTab = ({ user, token, API }) => {
  const [serviceForm, setServiceForm] = useState({
    service_type: '',
    property_address: '',
    tenant_name: '',
    tenant_id: '',
    additional_info: ''
  });

  const handleServiceSubmit = async (e) => {
    e.preventDefault();

    if (!serviceForm.service_type || !serviceForm.property_address || !serviceForm.tenant_name || !serviceForm.tenant_id) {
      toast.error('Please fill in all required fields');
      return;
    }

    try {
      await axios.post(`${API}/document-service`, serviceForm, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Service request submitted successfully! We will contact you soon.');
      setServiceForm({
        service_type: '',
        property_address: '',
        tenant_name: '',
        tenant_id: '',
        additional_info: ''
      });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit service request');
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'Playfair Display' }}>Government Services</h2>
        <p className="text-gray-600">We handle the paperwork for you - Arnona discounts, property name changes, and more</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-full bg-[#D4AF37]/10">
            <FileText size={24} className="text-[#D4AF37]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-gray-900">Request a Service</h3>
            <p className="text-sm text-gray-500">Choose a service and we'll take care of the rest</p>
          </div>
        </div>

        <form onSubmit={handleServiceSubmit} className="space-y-4">
          {/* Service Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Service Type *</label>
            <select
              value={serviceForm.service_type}
              onChange={(e) => setServiceForm({ ...serviceForm, service_type: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
              required
            >
              <option value="">Select a service</option>
              <option value="arnona_discount">Arnona Discount (Property Tax Reduction)</option>
              <option value="name_change">Property Name Change (Tabu)</option>
              <option value="lease_registration">Lease Registration</option>
              <option value="tenant_rights">Tenant Rights Documentation</option>
              <option value="other">Other Government Service</option>
            </select>
          </div>

          {/* Property Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Property Address *</label>
            <input
              type="text"
              value={serviceForm.property_address}
              onChange={(e) => setServiceForm({ ...serviceForm, property_address: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
              placeholder="Enter full property address"
              required
            />
          </div>

          {/* Tenant Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tenant Name *</label>
            <input
              type="text"
              value={serviceForm.tenant_name}
              onChange={(e) => setServiceForm({ ...serviceForm, tenant_name: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
              placeholder="Full name as it appears on lease"
              required
            />
          </div>

          {/* Tenant ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tenant ID Number *</label>
            <input
              type="text"
              value={serviceForm.tenant_id}
              onChange={(e) => setServiceForm({ ...serviceForm, tenant_id: e.target.value })}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
              placeholder="Israeli ID or Passport number"
              required
            />
          </div>

          {/* Additional Information */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Additional Information</label>
            <textarea
              value={serviceForm.additional_info}
              onChange={(e) => setServiceForm({ ...serviceForm, additional_info: e.target.value })}
              rows={4}
              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A]"
              placeholder="Any additional details or special requests..."
            />
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-sm text-blue-900">
              <strong>💡 How it works:</strong> After you submit this request, our team will review your information and contact you within 24-48 hours to discuss the service details and pricing.
            </p>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full px-6 py-3 rounded-xl text-white font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
            style={{ backgroundColor: '#D4AF37' }}
          >
            <Send size={18} />
            Submit Service Request
          </button>
        </form>
      </div>
    </div>
  );
};

export default ServicesTab;
