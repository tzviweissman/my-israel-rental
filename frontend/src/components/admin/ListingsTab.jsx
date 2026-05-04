import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  Trash2, ToggleLeft, ToggleRight, Search,
  CalendarX, CalendarCheck, Lock,
} from 'lucide-react';
import { API } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';
import MarkAsBookedModal from './MarkAsBookedModal';

/**
 * Super Admin → Listings tab.
 */
export const ListingsTab = ({ token, onStatsChange }) => {
  const { t } = useTranslation();
  const headers = { Authorization: `Bearer ${token}` };

  const { data: properties, refresh: fetchProperties } = useApiSWR(
    `${API}/admin/properties`, token, { initial: [] }
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPropIds, setSelectedPropIds] = useState(new Set());
  const [bookedModalOpen, setBookedModalOpen] = useState(false);
  // bookedTarget: null | { mode: 'single', id } | { mode: 'bulk' }
  const [bookedTarget, setBookedTarget] = useState(null);
  const [blockSaving, setBlockSaving] = useState(false);

  const notifyStatsChange = () => { if (onStatsChange) onStatsChange(); };

  // --- Row actions ---
  const togglePropertyStatus = async (propertyId) => {
    try {
      const res = await axios.put(`${API}/admin/properties/${propertyId}/status`, {}, { headers });
      toast.success(res.data.message);
      fetchProperties();
      notifyStatsChange();
    } catch (e) { toast.error('Failed to update property'); }
  };

  const deleteProperty = (propertyId) => {
    toast.custom((tid) => (
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
        <p className="text-sm font-semibold text-gray-800 mb-1">{t('admin.deleteListingTitle')}</p>
        <p className="text-xs text-gray-500 mb-3">{t('admin.deleteListingDesc')}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
            {t('admin.cancel')}
          </button>
          <button
            onClick={async () => {
              toast.dismiss(tid);
              try {
                await axios.delete(`${API}/properties/${propertyId}`, { headers });
                toast.success('Property deleted');
                fetchProperties();
                notifyStatsChange();
              } catch (e) { toast.error('Failed to delete property'); }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600"
            data-testid={`confirm-delete-listing-${propertyId}`}
          >
            {t('admin.deleteAction')}
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  // --- Mark-as-booked flow ---
  const openMarkBookedModal = (target) => {
    setBookedTarget(target);
    setBookedModalOpen(true);
  };

  const closeMarkBookedModal = () => {
    setBookedModalOpen(false);
    setBookedTarget(null);
  };

  const submitMarkBooked = async (body) => {
    if (!bookedTarget) return;
    setBlockSaving(true);
    try {
      if (bookedTarget.mode === 'single') {
        await axios.post(`${API}/admin/properties/${bookedTarget.id}/mark-booked`, body, { headers });
        toast.success('Property marked as booked');
      } else {
        const ids = Array.from(selectedPropIds);
        if (ids.length === 0) {
          toast.error('No properties selected');
          return;
        }
        const res = await axios.post(
          `${API}/admin/properties/bulk-mark-booked`,
          { ...body, property_ids: ids },
          { headers }
        );
        toast.success(res.data.message || `${ids.length} properties marked as booked`);
        setSelectedPropIds(new Set());
      }
      closeMarkBookedModal();
      fetchProperties();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to mark as booked');
    } finally {
      setBlockSaving(false);
    }
  };

  const unmarkBooked = (property) => {
    const block = property.active_admin_block;
    if (!block) return;
    toast.custom((tid) => (
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
        <p className="text-sm font-semibold text-gray-800 mb-1">{t('admin.removeBlockTitle')}</p>
        <p className="text-xs text-gray-500 mb-3">
          {block.indefinite
            ? t('admin.removeBlockDesc')
            : t('admin.removeBlockDescRange', { start: block.start_date?.slice(0, 10), end: block.end_date?.slice(0, 10) })}
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
            {t('admin.cancel')}
          </button>
          <button
            onClick={async () => {
              toast.dismiss(tid);
              try {
                await axios.delete(`${API}/admin/properties/blocks/${block.id}`, { headers });
                toast.success('Admin block removed');
                fetchProperties();
              } catch (e) { toast.error('Failed to remove block'); }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-black hover:bg-gray-800"
            data-testid={`confirm-unblock-${property.id}`}
          >
            {t('admin.removeBlock')}
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const togglePropSelected = (id) => {
    setSelectedPropIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const filteredProperties = properties.filter(p =>
    !searchTerm ||
    p.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.area?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div data-testid="admin-listings-section">
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('admin.searchListings')}
            className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
            data-testid="listings-search-input"
          />
        </div>
        <span className="text-sm text-gray-500">{t('admin.listingsCount', { count: filteredProperties.length })}</span>
        {selectedPropIds.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-xs font-medium text-gray-700" data-testid="selected-count">
              {t('admin.selectedCount', { count: selectedPropIds.size })}
            </span>
            <button
              onClick={() => openMarkBookedModal({ mode: 'bulk' })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-semibold hover:bg-gray-800"
              data-testid="bulk-mark-booked-btn"
            >
              <CalendarX size={14} /> {t('admin.markSelectedBooked')}
            </button>
            <button
              onClick={() => setSelectedPropIds(new Set())}
              className="px-2 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
              data-testid="clear-selection-btn"
            >
              {t('admin.clear')}
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={filteredProperties.length > 0 && filteredProperties.every(p => selectedPropIds.has(p.id))}
                  onChange={e => {
                    if (e.target.checked) {
                      setSelectedPropIds(new Set(filteredProperties.map(p => p.id)));
                    } else {
                      setSelectedPropIds(new Set());
                    }
                  }}
                  data-testid="select-all-listings"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colTitle')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colOwner')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colArea')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colType')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colPrice')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.status')}</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredProperties.map(p => (
              <tr key={p.id} className="border-t border-[#E5E5E5] hover:bg-gray-50" data-testid={`listing-row-${p.id}`}>
                <td className="px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selectedPropIds.has(p.id)}
                    onChange={() => togglePropSelected(p.id)}
                    data-testid={`select-listing-${p.id}`}
                  />
                </td>
                <td className="px-4 py-3 font-medium text-sm">
                  <div className="flex items-center gap-2">
                    <span>{p.title}</span>
                    {p.admin_blocked_now && (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800"
                        title={p.active_admin_block?.indefinite ? t('admin.adminBlockedIndefinite') : t('admin.adminBlockedRange', { start: p.active_admin_block?.start_date?.slice(0,10), end: p.active_admin_block?.end_date?.slice(0,10) })}
                        data-testid={`admin-blocked-badge-${p.id}`}
                      >
                        <Lock size={10} /> {t('admin.adminBlocked')}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {p.owner_name}<br />
                  <span className="text-xs text-gray-400">{p.owner_email}</span>
                </td>
                <td className="px-4 py-3 text-sm">{p.area}</td>
                <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs bg-[#E5E5E5]">{p.rental_type}</span></td>
                <td className="px-4 py-3 font-bold text-sm">{p.currency === 'USD' ? '$' : '₪'}{p.monthly_price || p.nightly_price || 0}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {p.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1">
                    {p.admin_blocked_now ? (
                      <button
                        onClick={() => unmarkBooked(p)}
                        className="p-1.5 rounded hover:bg-green-50 text-green-600"
                        title={t('admin.removeAdminBlock')}
                        data-testid={`unmark-booked-${p.id}`}
                      >
                        <CalendarCheck size={18} />
                      </button>
                    ) : (
                      <button
                        onClick={() => openMarkBookedModal({ mode: 'single', id: p.id })}
                        className="p-1.5 rounded hover:bg-amber-50 text-amber-600"
                        title={t('admin.markAsBooked')}
                        data-testid={`mark-booked-${p.id}`}
                      >
                        <CalendarX size={18} />
                      </button>
                    )}
                    <button
                      onClick={() => togglePropertyStatus(p.id)}
                      className="p-1.5 rounded hover:bg-gray-100"
                      title={p.status === 'active' ? t('admin.deactivate') : t('admin.activate')}
                      data-testid={`toggle-property-${p.id}`}
                    >
                      {p.status === 'active'
                        ? <ToggleRight size={18} className="text-green-600" />
                        : <ToggleLeft size={18} className="text-gray-400" />}
                    </button>
                    <button
                      onClick={() => deleteProperty(p.id)}
                      className="p-1.5 rounded hover:bg-red-50 text-red-500"
                      title={t('admin.deleteTooltip')}
                      data-testid={`delete-property-${p.id}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredProperties.length === 0 && (
          <p className="text-center text-gray-400 py-8 text-sm">{t('admin.noListings')}</p>
        )}
      </div>

      <MarkAsBookedModal
        open={bookedModalOpen}
        target={bookedTarget}
        selectedCount={selectedPropIds.size}
        saving={blockSaving}
        onClose={closeMarkBookedModal}
        onSubmit={submitMarkBooked}
      />
    </div>
  );
};

export default ListingsTab;
