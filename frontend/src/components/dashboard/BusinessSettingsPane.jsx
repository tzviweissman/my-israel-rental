/**
 * The sidebar's way straight to a setting that belongs to one business
 * (Tzvi, 6 Nov 2026: people who do not scroll the business card never found
 * these). One business goes straight in; several choose first.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import TextNotificationsPanel from './TextNotificationsPanel';

export default function BusinessSettingsPane({ API, token, setting }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [items, setItems] = useState(null);
  const [picked, setPicked] = useState('');

  useEffect(() => {
    axios.get(`${API}/marketplace/businesses`, auth)
      .then(({ data }) => setItems((data || []).filter((b) => b.active !== false)))
      .catch(() => setItems([]));
  }, [API, auth]);

  const openDesign = (id) => navigate(`/dashboard?tab=my-businesses&design=${encodeURIComponent(id)}`, { replace: true });
  useEffect(() => {
    if (setting === 'design' && items?.length === 1) openDesign(items[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, setting]);

  const muted = { color: 'var(--brand-muted)' };
  if (!items) return <div className="py-8 text-center" style={muted}><Loader2 size={18} className="animate-spin inline" /></div>;
  if (!items.length) {
    return <p className="text-sm py-6" style={muted} data-testid="settings-pane-empty">{t('dashboard.noBusinessTitle', 'No business page yet')}</p>;
  }
  if (setting === 'design' && items.length === 1) return <div className="py-8 text-center" style={muted}><Loader2 size={18} className="animate-spin inline" /></div>;

  const current = picked || items[0].id;

  return (
    <div className="max-w-xl" data-testid={`settings-pane-${setting}`}>
      {setting === 'design' && <h2 className="text-xl font-bold mb-3" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>{t('pageDesign.open', 'Design your page')}</h2>}
      {setting === 'design' ? (
        <div className="space-y-2">
          <p className="text-sm mb-2" style={muted}>{t('orderTexts.pickBusiness', 'Which business?')}</p>
          {items.map((b) => (
            <button key={b.id} type="button" onClick={() => openDesign(b.id)} className="block w-full text-start px-4 min-h-[48px] rounded-xl border bg-white text-sm font-semibold"
                    style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid={`settings-pane-design-${b.id}`}>{b.name}</button>
          ))}
        </div>
      ) : (
        <>
          {items.length > 1 && (
            <div className="mb-3">
              <label className="block text-xs font-semibold mb-1" style={muted} htmlFor="settings-pane-business">{t('orderTexts.pickBusiness', 'Which business?')}</label>
              <select id="settings-pane-business" value={current} onChange={(e) => setPicked(e.target.value)} className="w-full px-2 min-h-[44px] rounded-lg border text-sm bg-white"
                      style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="settings-pane-business">
                {items.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
          )}
          <TextNotificationsPanel key={current} API={API} token={token} businessId={current} />
        </>
      )}
    </div>
  );
}
