import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Edit, Eye, Trash2, Upload, FileText, CalendarSync, Link2, X, RefreshCw, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Owner-facing property card grid with edit / delete / contract-upload /
 * iCal panel controls. Self-contained: owns ical panel state + all mutation
 * handlers. Uses toast-confirms for destructive actions (window.confirm is
 * blocked inside the Emergent preview iframe).
 */
const PropertyList = ({ properties, onEdit, onRefresh, API, token }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [icalPanel, setIcalPanel] = useState(null);
  const [icalUrl, setIcalUrl] = useState('');
  const [icalSyncing, setIcalSyncing] = useState(false);
  const [icalData, setIcalData] = useState({});
  const [copiedExport, setCopiedExport] = useState(false);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // ---- Destructive actions with toast confirm (iframe-safe) ----
  const handleDeleteProperty = (propertyId) => {
    toast.custom(
      (tid) => (
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
          <p className="text-sm font-semibold text-gray-800 mb-1">Delete this property?</p>
          <p className="text-xs text-gray-500 mb-3">This cannot be undone. All bookings and images will be unlinked.</p>
          <div className="flex gap-2 justify-end">
            <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
              Cancel
            </button>
            <button
              onClick={async () => {
                toast.dismiss(tid);
                try {
                  await axios.delete(`${API}/properties/${propertyId}`, authHeaders);
                  toast.success('Property deleted');
                  onRefresh && onRefresh();
                } catch (err) {
                  toast.error(err?.response?.data?.detail || 'Failed to delete property');
                }
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600"
              data-testid={`confirm-delete-property-${propertyId}`}
            >
              Delete
            </button>
          </div>
        </div>
      ),
      { duration: 10000 },
    );
  };

  const handleContractUpload = async (propertyId, file, inputEl) => {
    if (!file) return;
    const allowed = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
    if (!allowed.includes(file.type)) {
      toast.error('Only PDF and image files (JPG, PNG, WEBP, HEIC) are allowed');
      if (inputEl) inputEl.value = '';
      return;
    }
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API}/properties/${propertyId}/contract`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Contract uploaded successfully!');
      onRefresh && (await onRefresh());
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload contract');
    } finally {
      if (inputEl) inputEl.value = '';
    }
  };

  const handleDeleteContract = (propertyId) => {
    toast((tid) => (
      <div className="flex flex-col gap-2 min-w-[240px]">
        <p className="text-sm font-medium">Delete this contract?</p>
        <p className="text-xs text-gray-500">Renters with pending bookings will no longer see it.</p>
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={async () => {
              toast.dismiss(tid);
              try {
                await axios.delete(`${API}/properties/${propertyId}/contract`, authHeaders);
                toast.success('Contract deleted successfully!');
                onRefresh && (await onRefresh());
              } catch (err) {
                toast.error(err?.response?.data?.detail || 'Failed to delete contract');
              }
            }}
            className="flex-1 px-3 py-1.5 rounded-md bg-red-500 text-white text-xs hover:bg-red-600"
            data-testid="confirm-delete-contract-btn"
          >
            Delete
          </button>
          <button type="button" onClick={() => toast.dismiss(tid)} className="flex-1 px-3 py-1.5 rounded-md bg-gray-200 text-gray-700 text-xs hover:bg-gray-300">
            Cancel
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  // ---- iCal handlers ----
  const openIcalPanel = async (propertyId) => {
    setIcalPanel(icalPanel === propertyId ? null : propertyId);
    setIcalUrl('');
    setCopiedExport(false);
    if (icalPanel !== propertyId) {
      try {
        const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
        setIcalData((prev) => ({ ...prev, [propertyId]: res.data }));
      } catch {
        toast.error('Could not load calendar data');
      }
    }
  };

  const addIcalUrl = async (propertyId) => {
    if (!icalUrl.trim()) return;
    setIcalSyncing(true);
    try {
      await axios.post(`${API}/properties/${propertyId}/ical`, { url: icalUrl.trim() }, authHeaders);
      toast.success(t('property.ical.copied') || 'iCal feed added!');
      setIcalUrl('');
      const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
      setIcalData((prev) => ({ ...prev, [propertyId]: res.data }));
      onRefresh && onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add iCal feed');
    }
    setIcalSyncing(false);
  };

  const removeIcalUrl = async (propertyId, url) => {
    try {
      await axios.delete(`${API}/properties/${propertyId}/ical`, { data: { url }, headers: { Authorization: `Bearer ${token}` } });
      toast.success('iCal feed removed');
      const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
      setIcalData((prev) => ({ ...prev, [propertyId]: res.data }));
      onRefresh && onRefresh();
    } catch {
      toast.error('Failed to remove iCal feed');
    }
  };

  const manualSync = async (propertyId) => {
    setIcalSyncing(true);
    try {
      await axios.post(`${API}/properties/${propertyId}/ical-sync`, {}, authHeaders);
      const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
      setIcalData((prev) => ({ ...prev, [propertyId]: res.data }));
      toast.success('Sync complete');
    } catch {
      toast.error('Sync failed');
    }
    setIcalSyncing(false);
  };

  const copyExportUrl = async (propertyId) => {
    const url = `${API.replace('/api', '')}/api/properties/${propertyId}/ical-export`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedExport(true);
    toast.success('URL copied!');
    setTimeout(() => setCopiedExport(false), 3000);
  };

  const propImage = (property) =>
    property.images?.[0]
      ? property.images[0].startsWith('/api')
        ? `${API.replace('/api', '')}${property.images[0]}`
        : property.images[0]
      : 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940';

  return (
    <div className="mb-12">
      <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>{t('dashboard.myProperties')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties.map((property) => (
          <div key={property.id} className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden" data-testid={`dashboard-property-${property.id}`}>
            <div
              className="h-48 bg-gray-200"
              style={{ backgroundImage: `url(${propImage(property)})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
            />
            <div className="p-4">
              <h3 className="text-lg font-bold mb-2">{property.title}</h3>
              <p className="text-gray-600 text-sm mb-4">{property.area}</p>
              <div className="flex items-center justify-between">
                <span className="text-xl font-bold" style={{ color: '#1E6A6A' }}>
                  {property.currency === 'USD' ? '$' : '₪'}
                  {property.monthly_price || property.nightly_price}
                </span>
                <div className="flex gap-2">
                  <button onClick={() => onEdit(property)} className="p-2 hover:bg-gray-100 rounded-lg" data-testid={`edit-property-${property.id}`}>
                    <Edit size={18} />
                  </button>
                  <button onClick={() => navigate(`/property/${property.id}`)} className="p-2 hover:bg-gray-100 rounded-lg" data-testid={`view-property-${property.id}`}>
                    <Eye size={18} />
                  </button>
                  <button onClick={() => handleDeleteProperty(property.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600" data-testid={`delete-property-${property.id}`}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Contract Upload for Long-Term/Short-Term */}
              {(property.rental_type === 'long-term' || property.rental_type === 'short-term') && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-gray-700">Property Contract</span>
                    {property.contract_url && (
                      <a
                        href={`${API.replace('/api', '')}${property.contract_url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#1E6A6A] hover:text-[#D4AF37] flex items-center gap-1"
                      >
                        <FileText size={12} /> View
                      </a>
                    )}
                  </div>
                  <label
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all border border-dashed"
                    style={{
                      borderColor: property.contract_url ? '#D4AF37' : '#ccc',
                      backgroundColor: property.contract_url ? '#f5f5f0' : 'transparent',
                      color: property.contract_url ? '#1E6A6A' : '#666',
                    }}
                  >
                    <Upload size={14} />
                    {property.contract_url ? 'Replace Contract' : 'Upload Contract'}
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                      className="hidden"
                      onChange={(e) => handleContractUpload(property.id, e.target.files[0], e.target)}
                      data-testid={`upload-contract-${property.id}`}
                    />
                  </label>
                  {property.contract_url && (
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteContract(property.id); }}
                      className="w-full mt-2 text-xs text-red-500 hover:text-red-700 py-2 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                      data-testid={`delete-contract-${property.id}`}
                    >
                      Delete Contract
                    </button>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-[11px] text-gray-500">
                    <span>Need a template?</span>
                    <a href={`${API}/contract-template/en`} target="_blank" rel="noopener noreferrer" className="text-[#1E6A6A] hover:text-[#D4AF37] underline" data-testid={`template-en-${property.id}`}>
                      EN
                    </a>
                    <span className="text-gray-300">·</span>
                    <a href={`${API}/contract-template/he`} target="_blank" rel="noopener noreferrer" className="text-[#1E6A6A] hover:text-[#D4AF37] underline" data-testid={`template-he-${property.id}`}>
                      HE
                    </a>
                  </div>
                </div>
              )}

              {/* iCal Sync for Vacation Properties */}
              {property.rental_type === 'vacation' && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => openIcalPanel(property.id)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                    style={{
                      backgroundColor: icalPanel === property.id ? '#1E6A6A' : '#f5f5f0',
                      color: icalPanel === property.id ? '#D4AF37' : '#1E6A6A',
                    }}
                    data-testid={`ical-toggle-${property.id}`}
                  >
                    <CalendarSync size={15} />
                    {t('property.ical.title')}
                    {property.ical_urls?.length > 0 && (
                      <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold bg-[#D4AF37] text-white">
                        {property.ical_urls.length}
                      </span>
                    )}
                  </button>

                  {icalPanel === property.id && (
                    <div className="mt-3 space-y-3" data-testid={`ical-panel-${property.id}`}>
                      <p className="text-xs text-gray-500">{t('property.ical.subtitle')}</p>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={icalUrl}
                          onChange={(e) => setIcalUrl(e.target.value)}
                          placeholder={t('property.ical.urlPlaceholder')}
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
                          data-testid={`ical-url-input-${property.id}`}
                        />
                        <button
                          onClick={() => addIcalUrl(property.id)}
                          disabled={icalSyncing || !icalUrl.trim()}
                          className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                          style={{ backgroundColor: '#1E6A6A' }}
                          data-testid={`ical-add-btn-${property.id}`}
                        >
                          {icalSyncing ? t('property.ical.syncing') : t('property.ical.add')}
                        </button>
                      </div>

                      {property.ical_urls?.length > 0 ? (
                        <div className="space-y-1.5">
                          {property.ical_urls.map((url, i) => (
                            <div key={url} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-xs">
                              <Link2 size={12} className="text-[#D4AF37] shrink-0" />
                              <span className="flex-1 truncate text-gray-600">{url}</span>
                              <button onClick={() => removeIcalUrl(property.id, url)} className="text-red-400 hover:text-red-600 shrink-0" data-testid={`ical-remove-${i}`}>
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 text-center py-2">{t('property.ical.noUrls')}</p>
                      )}

                      {icalData[property.id] && (
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{icalData[property.id].external?.length || 0} {t('property.ical.blockedDates')}</span>
                          <button onClick={() => manualSync(property.id)} disabled={icalSyncing} className="flex items-center gap-1 text-[#D4AF37] hover:underline disabled:opacity-40" data-testid={`ical-sync-btn-${property.id}`}>
                            <RefreshCw size={12} className={icalSyncing ? 'animate-spin' : ''} />
                            {t('property.ical.autoSync')}
                          </button>
                        </div>
                      )}

                      <div className="pt-2 border-t border-gray-100">
                        <p className="text-xs font-medium text-gray-700 mb-1">{t('property.ical.exportTitle')}</p>
                        <p className="text-[11px] text-gray-400 mb-2">{t('property.ical.exportDesc')}</p>
                        <button
                          onClick={() => copyExportUrl(property.id)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm hover:border-[#D4AF37] transition-colors"
                          data-testid={`ical-export-btn-${property.id}`}
                        >
                          {copiedExport ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-500" />}
                          <span className="text-gray-700">{copiedExport ? t('property.ical.copied') : t('property.ical.copyUrl')}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PropertyList;
