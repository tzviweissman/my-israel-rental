/**
 * On/off switches for the two emails that carry a "stop these emails"
 * link: the Monday summary (routes/weekly_insights.py) and the requests
 * board matches (routes/marketplace/requests.py). Without these, that link
 * was a one-way door. Backed by /marketplace/notification-preferences/emails.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';

const SWITCHES = [
  { key: 'insights_emails', title: ['emailSwitches.insightsTitle', 'Monday summary'], hint: ['emailSwitches.insightsHint', 'How your listings did last week: visitors, messages, saves and reviews. Nothing is sent in a quiet week.'] },
  { key: 'requests_emails', title: ['emailSwitches.requestsTitle', 'Matching requests'], hint: ['emailSwitches.requestsHint', 'An email when someone posts on the requests board looking for what you offer.'] },
];

export default function EmailSwitches({ API, token }) {
  const { t } = useTranslation();
  const [on, setOn] = useState(null);
  const [busy, setBusy] = useState(null);
  const auth = { headers: { Authorization: `Bearer ${token}` } };

  useEffect(() => {
    axios.get(`${API}/marketplace/notification-preferences/emails`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setOn(r.data))
      .catch(() => setOn(null));
  }, [API, token]);

  if (!on) return null;

  const flip = async (key) => {
    setBusy(key);
    try {
      const { data } = await axios.patch(`${API}/marketplace/notification-preferences/emails`, { [key]: !on[key] }, auth);
      setOn(data);
      toast.success(t('emailSwitches.saved', 'Saved'));
    } catch {
      toast.error(t('emailSwitches.failed', 'Could not save. Try again.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border p-6 max-w-2xl mb-6" style={{ borderColor: 'var(--brand-border)' }} data-testid="email-switches">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-full" style={{ background: 'rgb(var(--brand-primary-rgb) / 0.10)' }}>
          <Mail size={22} style={{ color: 'var(--brand-primary)' }} aria-hidden="true" />
        </div>
        <h3 className="text-lg font-bold" style={{ color: 'var(--ink)', fontFamily: 'var(--font-head)' }}>
          {t('emailSwitches.title', 'Emails about your listings')}
        </h3>
      </div>
      <ul className="divide-y" style={{ borderColor: 'var(--brand-border)' }}>
        {SWITCHES.map(({ key, title, hint }) => (
          <li key={key} className="py-3 flex items-start gap-4">
            <div className="flex-1 min-w-0">
              <p id={`sw-${key}`} className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{t(...title)}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--brand-muted)' }}>{t(...hint)}</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={!!on[key]}
              aria-labelledby={`sw-${key}`}
              onClick={() => flip(key)}
              disabled={busy === key}
              className={`shrink-0 mt-0.5 inline-flex h-6 w-11 items-center rounded-full px-1 transition-colors disabled:opacity-60 ${on[key] ? 'justify-end' : 'justify-start'}`}
              style={{ background: on[key] ? 'var(--brand-primary)' : 'var(--brand-border)' }}
              data-testid={`email-switch-${key}`}
            >
              <span className="h-4 w-4 rounded-full bg-white shadow-sm" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
