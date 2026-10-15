/**
 * Dashboard → Tools: the business tools, each switched on or off
 * (backend utils/business_tools.py). The ones that suit the business are
 * on from the start; the rest wait here until someone wants them.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, ClipboardList, Users, CalendarClock, Briefcase, Network } from 'lucide-react';

const TOOLS = [
  { id: 'orders', Icon: ClipboardList },
  { id: 'members', Icon: Users },
  { id: 'appointments', Icon: CalendarClock },
  { id: 'job-requests', Icon: Briefcase },
  { id: 'network', Icon: Network },
];

export default function ToolsTab({ API, token, onChanged }) {
  const { t } = useTranslation();
  const auth = useMemo(() => ({ headers: { Authorization: `Bearer ${token}` } }), [token]);
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    axios.get(`${API}/dashboard/tools`, auth).then(({ data: d }) => setData(d)).catch(() => setData(false));
  }, [API, auth]);

  const words = {
    orders: [t('tools.orders', 'Orders'), t('tools.ordersBody', 'Take and track orders: for shops, bakeries, caterers and anyone who sells products.')],
    members: [t('tools.members', 'Members'), t('tools.membersBody', 'Monthly and yearly memberships and class packs, with check-in at the door: for gyms, studios and classes.')],
    appointments: [t('tools.appointments', 'Appointments'), t('tools.appointmentsBody', 'Bookings for a time slot: for cleaners, tutors, therapists and anyone who books visits.')],
    'job-requests': [t('tools.jobRequests', 'Work offers'), t('tools.jobRequestsBody', 'Jobs people post in your field, so you can offer to do them.')],
    network: [t('tools.network', 'Network'), t('tools.networkBody', 'Connect with other businesses: suppliers, partners and referrals.')],
  };

  // The switch moves the moment it is tapped and saves behind it; only a
  // failed save moves it back (Tzvi: "it takes too long for these to flip").
  const toggle = async (id, on) => {
    setBusy(id);
    setData((d) => ({ ...d, tools: { ...d.tools, [id]: on } }));
    try {
      const { data: d } = await axios.put(`${API}/dashboard/tools`, { tools: { [id]: on } }, auth);
      setData(d);
      onChanged?.();
    } catch {
      setData((d) => ({ ...d, tools: { ...d.tools, [id]: !on } }));
      toast.error(t('tools.saveFailed', 'Could not save. Try again.'));
    } finally { setBusy(null); }
  };

  if (data === null) return <div className="py-16 text-center"><Loader2 className="animate-spin inline" size={18} /></div>;
  if (data === false) return <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{t('tools.loadFailed', 'Could not load your tools. Try again.')}</p>;

  return (
    <div data-testid="tools-tab">
      <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--ink)' }}>{t('tools.title', 'Tools')}</h2>
      <p className="text-sm mb-5" style={{ color: 'var(--brand-muted)' }}>
        {t('tools.body', 'The tools that suit your business are already on. Switch on anything else you need, or hide what you don’t use. Nothing is deleted when a tool is off.')}
      </p>
      <ul className="space-y-2">
        {TOOLS.map(({ id, Icon }) => {
          const on = !!data.tools[id];
          const [name, body] = words[id];
          const suggested = data.recommended.includes(id);
          return (
            <li key={id} className="rounded-2xl border bg-white p-4 flex items-start gap-3" style={{ borderColor: 'var(--brand-border)' }} data-testid={`tool-${id}`} data-on={on ? '1' : '0'}>
              <Icon size={20} className="shrink-0 mt-0.5" style={{ color: 'var(--ink)' }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-sm" style={{ color: 'var(--ink)' }}>
                  {name}
                  {suggested && <span className="ms-2 px-2 py-0.5 rounded-full text-[11px] font-semibold align-middle" style={{ background: 'rgba(36,175,235,.33)', color: '#111827' }}>{t('tools.suggested', 'Suits your business')}</span>}
                </p>
                <p className="text-sm" style={{ color: 'var(--brand-muted)' }}>{body}</p>
              </div>
              <label className="shrink-0 inline-flex items-center min-h-[44px] cursor-pointer">
                <span className="sr-only">{name}</span>
                <input type="checkbox" className="sr-only peer" checked={on} onChange={(e) => { if (busy !== id) toggle(id, e.target.checked); }} />
                <span className="relative w-11 h-6 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2"
                      style={{ background: on ? '#000' : '#D1D5DB' }} aria-hidden="true">
                  <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ insetInlineStart: on ? '22px' : '2px' }} />
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
