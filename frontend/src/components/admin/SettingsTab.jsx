import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { API } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';
import PayPalPlansPanel from './PayPalPlansPanel';

const EMPTY = { whatsapp_number: '', contact_email: '', contact_phone: '', featured_property_ids: [] };

export const SettingsTab = ({ token }) => {
  const { t } = useTranslation();
  const headers = { Authorization: `Bearer ${token}` };

  const { data: serverSettings, refresh } = useApiSWR(
    `${API}/admin/settings`, token, { initial: EMPTY }
  );
  const [siteSettings, setSiteSettings] = useState(serverSettings || EMPTY);

  useEffect(() => {
    if (serverSettings) setSiteSettings(serverSettings);
  }, [serverSettings]);

  const saveSettings = async () => {
    try {
      await axios.put(`${API}/admin/settings`, siteSettings, { headers });
      toast.success('Settings saved');
      refresh();
    } catch (e) { toast.error('Failed to save settings'); }
  };

  return (
    <div data-testid="admin-settings-section">
      <div className="bg-white rounded-xl border border-[#E5E5E5] p-6 max-w-2xl">
        <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'var(--font-head)' }}>{t('admin.siteSettingsTitle')}</h2>
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1">{t('admin.whatsappNumber')}</label>
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
            <label className="block text-sm font-medium mb-1">{t('admin.contactEmail')}</label>
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
            <label className="block text-sm font-medium mb-1">{t('admin.contactPhone')}</label>
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
            <label className="block text-sm font-medium mb-1">{t('admin.featuredIds')}</label>
            <p className="text-xs text-gray-500 mb-2">{t('admin.featuredHelp')}</p>
            <input
              type="text"
              value={(siteSettings.featured_property_ids || []).join(', ')}
              onChange={e => setSiteSettings({ ...siteSettings, featured_property_ids: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
              placeholder={t('admin.featuredPlaceholder')}
              className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
              data-testid="settings-featured"
            />
          </div>
          <button onClick={saveSettings} className="primary-btn" data-testid="save-settings-button">
            {t('admin.saveSettings')}
          </button>
        </div>
      </div>
      {/* Subscription billing setup. Lives here rather than behind a
          devtools console command — the endpoints are admin-only and need
          an auth header, which a plain browser tab can't send. */}
      <PayPalPlansPanel token={token} />
    </div>
  );
};

export default SettingsTab;
