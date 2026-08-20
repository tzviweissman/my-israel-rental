/**
 * Super Admin → what needs a person today (spec A3).
 *
 * The most useful thing a console can do is answer that question, and
 * this one answered it nowhere: an admin had to open five tabs and infer.
 *
 * Renders NOTHING when everything is zero. No "all caught up!" card — a
 * panel that is always present teaches people to skim past it, and then
 * it fails on the day it finally has something to say. Absence is the
 * signal.
 *
 * Every row links to the view that contains the thing, because a count
 * an admin cannot act on is trivia.
 */
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle, Clock, ImageOff, BadgeCheck, MailWarning, ChevronRight } from 'lucide-react';
import { API } from '../../App';

export default function AttentionQueue({ token, onNavigate }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/admin/attention`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled) setData(res.data);
      } catch {
        // A queue that cannot be loaded shows nothing rather than an
        // error card: it is a summary of other screens, and each of those
        // still reports its own failures.
        if (!cancelled) setData(null);
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  if (!data) return null;

  const rows = [
    {
      key: 'requests-expiring',
      n: data.requests_expiring_unanswered,
      Icon: Clock,
      text: (n) => `${n} request${n === 1 ? '' : 's'} expiring within 3 days with no responses`,
      go: 'requests',
    },
    {
      key: 'chats-unanswered',
      n: data.chats_unanswered,
      Icon: AlertTriangle,
      text: (n) => `${n} conversation${n === 1 ? '' : 's'} with no reply for 3 days`,
      go: 'chats',
    },
    {
      key: 'services-no-photo',
      n: data.services_without_photo,
      Icon: ImageOff,
      text: (n) => `${n} published service${n === 1 ? '' : 's'} with no photo`,
      go: 'services',
    },
    {
      key: 'businesses-unverified',
      n: data.businesses_unverified,
      Icon: BadgeCheck,
      text: (n) => `${n} business${n === 1 ? '' : 'es'} awaiting a verification decision`,
      go: 'services',
    },
    {
      key: 'emails-bounced',
      n: data.emails_bounced_7d,
      Icon: MailWarning,
      text: (n) => `${n} email${n === 1 ? '' : 's'} bounced in the last 7 days`,
      // Points at Email health, not Settings — the row is only useful if it
      // lands on the bounce list it is describing.
      go: 'email-health',
    },
  ].filter((r) => (r.n || 0) > 0);

  if (!rows.length) return null;

  return (
    <div
      className="mb-8 rounded-xl border bg-white overflow-hidden"
      style={{ borderColor: 'var(--brand-border)' }}
      data-testid="admin-attention-queue"
    >
      <p
        className="px-4 py-2 text-xs font-bold uppercase tracking-wide"
        style={{ background: 'rgb(var(--brand-primary-rgb) / 0.06)', color: 'var(--brand-primary)' }}
      >
        Needs attention
      </p>
      {rows.map(({ key, n, Icon, text, go }) => (
        <button
          key={key}
          type="button"
          onClick={() => onNavigate && onNavigate(go)}
          className="w-full flex items-center gap-3 px-4 py-2.5 text-start border-t hover:bg-gray-50 transition-colors"
          style={{ borderColor: 'var(--brand-border)' }}
          data-testid={`attention-${key}`}
        >
          <Icon size={15} className="shrink-0" style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
          <span className="flex-1 text-sm" style={{ color: 'var(--ink)' }}>{text(n)}</span>
          <ChevronRight size={14} className="shrink-0" style={{ color: 'var(--brand-muted)' }} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
