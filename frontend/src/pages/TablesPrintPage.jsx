/**
 * /tables/print?business=<id>: one QR code per table, to print, cut and put
 * on the tables (backend tables.py). Each opens the order form for that
 * table. A4, six to a page; the screen shows a Print button only.
 */
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { QRCodeSVG } from 'qrcode.react';
import { ArrowLeft, Printer, Loader2 } from 'lucide-react';
import { API, AuthContext } from '../App';

export default function TablesPrintPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const businessId = params.get('business');
  const { token } = useContext(AuthContext);
  const [d, setD] = useState(null);
  const [biz, setBiz] = useState(null);

  useEffect(() => {
    if (!businessId || !token) return;
    const auth = { headers: { Authorization: `Bearer ${token}` } };
    axios.get(`${API}/marketplace/businesses/${businessId}/table-ordering`, auth).then(({ data }) => setD(data)).catch(() => setD(false));
    axios.get(`${API}/marketplace/my-workplaces`, auth).then(({ data }) => setBiz((data || []).find((b) => b.id === businessId) || null)).catch(() => {});
  }, [businessId, token]);

  if (d === null) return <div className="py-24 text-center"><Loader2 className="animate-spin inline" size={20} /></div>;
  if (!d || !d.store_id) {
    return <p className="max-w-md mx-auto px-4 py-24 text-center text-sm" style={{ color: 'var(--brand-muted)' }}>{t('tableOrder.noStore', 'Add a shop listing with your menu first: the table codes open its order form.')}</p>;
  }
  const name = (i18n.language?.startsWith('he') && biz?.name_he) || biz?.name || '';
  const url = (n) => `${window.location.origin}/order/${d.store_id}?table=${n}`;

  return (
    <div className="max-w-4xl mx-auto px-4 pb-6 pt-[calc(var(--nav-h,68px)+24px)] print:p-0" data-testid="tables-print">
      <style>{'@media print { nav, header, footer, .no-print { display: none !important } body { background: #fff } }'}</style>
      <div className="no-print flex flex-wrap items-center justify-between gap-3 mb-5">
        <button type="button" onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm min-h-[44px]" style={{ color: 'var(--brand-muted)' }}>
          <ArrowLeft size={14} className="rtl:rotate-180" /> {t('common.back', 'Back')}
        </button>
        <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 px-5 min-h-[44px] rounded-full text-sm font-semibold"
                style={{ background: 'var(--action)', color: 'var(--action-ink)' }} data-testid="tables-print-btn">
          <Printer size={15} /> {t('tableOrder.print', 'Print the table codes')}
        </button>
      </div>
      {!d.on && <p className="no-print mb-4 text-sm rounded-xl p-3" style={{ background: '#F9FAFB', color: 'var(--ink)' }}>{t('tableOrder.offNote', 'Table ordering is switched off, so these codes will not take orders until you switch it on.')}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 print:gap-0">
        {Array.from({ length: d.tables }, (_, i) => i + 1).map((n) => (
          <div key={n} className="rounded-2xl border p-4 text-center print:rounded-none print:border-dashed" style={{ borderColor: 'var(--brand-border)', breakInside: 'avoid' }} data-testid="table-card">
            <p className="text-xs" style={{ color: 'var(--brand-muted)' }}>{name}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: 'var(--ink)' }}>{t('tableOrder.table', 'Table {{n}}', { n })}</p>
            <div className="my-3 flex justify-center"><QRCodeSVG value={url(n)} size={150} level="M" /></div>
            <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t('tableOrder.scan', 'Scan to order to your table')}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
