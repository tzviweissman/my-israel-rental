import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../../App';

/**
 * Super Admin → Site Settings tab.
 * Owns its own form state and fetch/save lifecycle.
 */
export const SettingsTab = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };

  const [siteSettings, setSiteSettings] = useState({
    whatsapp_number: '',
    contact_email: '',
    contact_phone: '',
    featured_property_ids: [],
  });

  const fetchSettings = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/settings`, { headers });
      setSiteSettings(res.data);
    } catch (e) { console.error(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = async () => {
    try {
      await axios.put(`${API}/admin/settings`, siteSettings, { headers });
      toast.success('Settings saved');
    } catch (e) { toast.error('Failed to save settings'); }
  };

  return (
    <div data-testid="admin-settings-section">
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-6 max-w-2xl">
        <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>Site Settings</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">WhatsApp Number</label>
            <input
              type="text"
              value={siteSettings.whatsapp_number || ''}
              onChange={e => setSiteSettings({ ...siteSettings, whatsapp_number: e.target.value })}
              placeholder="+972-XX-XXX-XXXX"
              className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
              data-testid="settings-whatsapp"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contact Email</label>
            <input
              type="email"
              value={siteSettings.contact_email || ''}
              onChange={e => setSiteSettings({ ...siteSettings, contact_email: e.target.value })}
              placeholder="contact@myisraelrental.com"
              className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
              data-testid="settings-email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Contact Phone</label>
            <input
              type="text"
              value={siteSettings.contact_phone || ''}
              onChange={e => setSiteSettings({ ...siteSettings, contact_phone: e.target.value })}
              placeholder="+972-XX-XXX-XXXX"
              className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
              data-testid="settings-phone"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Featured Property IDs</label>
            <p className="text-xs text-gray-500 mb-2">Comma-separated property IDs to feature on the homepage</p>
            <input
              type="text"
              value={(siteSettings.featured_property_ids || []).join(', ')}
              onChange={e => setSiteSettings({ ...siteSettings, featured_property_ids: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder="property-id-1, property-id-2"
              className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
              data-testid="settings-featured"
            />
          </div>
          <button onClick={saveSettings} className="primary-btn" data-testid="save-settings-button">
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
