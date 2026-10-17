/**
 * Hours, deliveries and prices → Order from the table (backend tables.py):
 * the switch, how many tables, and the printable sheet of table codes.
 */
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Printer } from 'lucide-react';

export default function TableOrdering({ API, auth, businessId }) {
  const { t } = useTranslation();
  const [d, setD] = useState(null);
  const url = `${API}/marketplace/businesses/${businessId}/table-ordering`;
  useEffect(() => { axios.get(url, auth).then(({ data }) => setD(data)).catch(() => setD(null)); }, [url, auth]);
  if (!d) return null;
  const save = async (patch) => {
    const next = { ...d, ...patch };
    const prev = d;
    setD(next);
    try { await axios.put(url, { on: next.on, tables: Math.max(1, Math.min(500, parseInt(next.tables, 10) || 1)) }, auth); } catch (err) {
      setD(prev);
      toast.error(err?.response?.status === 403 ? t('feedbackBiz.ownerOnly', 'Only the owner can change this.') : t('auto.failed', 'Could not save. Try again.'));
    }
  };
  return (
    <div className="mt-3 rounded-xl p-3" style={{ background: '#F9FAFB' }} data-testid="table-ordering">
      <div className="flex items-start justify-between gap-3 text-sm">
        <div>
          <p className="font-semibold" style={{ color: 'var(--ink)' }}>{t('tableOrder.title', 'Order from the table')}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>{t('tableOrder.hint', 'Each table gets a QR code. Guests scan it, order from your menu, and the order reaches your board marked with the table number. No phone or date needed.')}</p>
        </div>
        <button type="button" role="switch" aria-checked={d.on} onClick={() => save({ on: !d.on })} data-testid="table-switch"
                className="relative w-10 h-6 rounded-full shrink-0 mt-1" style={{ background: d.on ? 'var(--ink)' : '#D1D5DB' }}>
          <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white" style={{ insetInlineStart: d.on ? '18px' : '2px' }} />
        </button>
      </div>
      {d.on && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <label className="inline-flex items-center gap-2" style={{ color: 'var(--ink)' }}>{t('tableOrder.howMany', 'Tables')}
            <input type="number" min="1" max="500" value={d.tables} onChange={(e) => setD({ ...d, tables: e.target.value })} onBlur={() => save({})}
                   className="w-20 px-3 py-2 rounded-lg border text-sm bg-white min-h-[40px]" style={{ borderColor: 'var(--brand-border)', color: 'var(--ink)' }} data-testid="table-count" />
          </label>
          {d.store_id ? (
            <a href={`/tables/print?business=${encodeURIComponent(businessId)}`} target="_blank" rel="noopener noreferrer"
               className="inline-flex items-center gap-1.5 px-4 min-h-[40px] rounded-full border text-sm font-semibold bg-white" style={{ borderColor: 'var(--ink)', color: 'var(--ink)' }} data-testid="table-print-link">
              <Printer size={14} /> {t('tableOrder.print', 'Print the table codes')}
            </a>
          ) : <span className="text-xs" style={{ color: 'var(--brand-muted)' }}>{t('tableOrder.noStore', 'Add a shop listing with your menu first: the table codes open its order form.')}</span>}
        </div>
      )}
    </div>
  );
}
