import React from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';

/**
 * Super Admin → Document Services tab.
 * Lists service requests and lets admin update their status inline.
 */
export const ServicesTab = ({ token, onStatsChange }) => {
  const headers = { Authorization: `Bearer ${token}` };

  const { data: services, refresh: fetchServices } = useApiSWR(
    `${API}/admin/document-services`, token, { initial: [] }
  );

  const updateServiceStatus = async (serviceId, status) => {
    try {
      await axios.put(`${API}/admin/document-services/${serviceId}/status?status=${status}`, {}, { headers });
      toast.success(`Status updated to ${status}`);
      fetchServices();
      if (onStatsChange) onStatsChange();
    } catch (e) { toast.error('Failed to update status'); }
  };

  return (
    <div data-testid="admin-services-section">
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Service</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Requested By</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Address</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tenant</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {services.map(svc => (
              <tr key={svc.id} className="border-t border-[#E5E5E5] hover:bg-gray-50" data-testid={`service-row-${svc.id}`}>
                <td className="px-5 py-3 font-medium text-sm capitalize">{svc.service_type?.replace(/_/g, ' ')}</td>
                <td className="px-5 py-3 text-sm">{svc.user_name}<br/><span className="text-xs text-gray-400">{svc.user_email}</span></td>
                <td className="px-5 py-3 text-sm">{svc.property_address}</td>
                <td className="px-5 py-3 text-sm">{svc.tenant_name}</td>
                <td className="px-5 py-3 text-sm text-gray-500">{svc.created_at ? new Date(svc.created_at).toLocaleDateString() : '-'}</td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${svc.status === 'completed' ? 'bg-green-100 text-green-700' : svc.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : svc.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                    {svc.status?.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <select
                    value={svc.status}
                    onChange={e => updateServiceStatus(svc.id, e.target.value)}
                    className="text-xs px-2 py-1 rounded border border-[#E5E5E5] focus:outline-none"
                    data-testid={`service-status-${svc.id}`}
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {services.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No document service requests</p>}
      </div>
    </div>
  );
};

export default ServicesTab;
