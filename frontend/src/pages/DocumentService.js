import React, { useState, useContext } from 'react';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { FileText, Upload } from 'lucide-react';
import { toast } from 'sonner';

const DocumentService = () => {
  const { token } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    service_type: 'arnona',
    property_address: '',
    tenant_name: '',
    tenant_id: '',
    additional_info: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API}/document-service`, formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Document service request submitted successfully!');
      setFormData({
        service_type: 'arnona',
        property_address: '',
        tenant_name: '',
        tenant_id: '',
        additional_info: ''
      });
    } catch (error) {
      toast.error('Failed to submit request');
    }
  };

  return (
    <div className="min-h-screen" data-testid="document-service-page">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-8" style={{ fontFamily: 'Playfair Display' }}>
          Document Filing Service
        </h1>

        <div className="bg-white rounded-2xl p-8 border border-[#E5E3DC] mb-8">
          <p className="text-gray-700 mb-6">
            We provide professional document filing services for arnona documents, name change documents, and more. 
            Fill out the form below and our team will contact you shortly.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6" data-testid="document-service-form">
            <div>
              <label className="block text-sm font-medium mb-2">Service Type</label>
              <select
                value={formData.service_type}
                onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E3DC] focus:outline-none focus:ring-2 focus:ring-[#2C4A3B]/50"
                data-testid="service-type-select"
              >
                <option value="arnona">Arnona Documents</option>
                <option value="name_change">Name Change Documents</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Property Address</label>
              <input
                type="text"
                value={formData.property_address}
                onChange={(e) => setFormData({ ...formData, property_address: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E3DC] focus:outline-none focus:ring-2 focus:ring-[#2C4A3B]/50"
                required
                data-testid="property-address-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tenant Name</label>
              <input
                type="text"
                value={formData.tenant_name}
                onChange={(e) => setFormData({ ...formData, tenant_name: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E3DC] focus:outline-none focus:ring-2 focus:ring-[#2C4A3B]/50"
                required
                data-testid="tenant-name-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Tenant ID</label>
              <input
                type="text"
                value={formData.tenant_id}
                onChange={(e) => setFormData({ ...formData, tenant_id: e.target.value })}
                className="w-full px-4 py-3 rounded-lg border border-[#E5E3DC] focus:outline-none focus:ring-2 focus:ring-[#2C4A3B]/50"
                required
                data-testid="tenant-id-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Additional Information</label>
              <textarea
                value={formData.additional_info}
                onChange={(e) => setFormData({ ...formData, additional_info: e.target.value })}
                rows="4"
                className="w-full px-4 py-3 rounded-lg border border-[#E5E3DC] focus:outline-none focus:ring-2 focus:ring-[#2C4A3B]/50"
                data-testid="additional-info-input"
              ></textarea>
            </div>

            <button type="submit" className="w-full primary-btn flex items-center justify-center gap-2" data-testid="submit-document-service-button">
              <FileText size={20} />
              Submit Request
            </button>
          </form>
        </div>

        <div className="bg-white rounded-2xl p-8 border border-[#E5E3DC]">
          <h2 className="text-2xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>Payment Information</h2>
          <p className="text-gray-700 mb-4">
            Once we review your request, we will contact you with pricing and payment details.
            You can pay securely through our PayPal integration.
          </p>
          <p className="text-gray-700">
            For immediate assistance, contact us at: <a href="tel:+972553225141" className="font-bold" style={{ color: '#2C4A3B' }}>+972 55 322 5141</a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default DocumentService;