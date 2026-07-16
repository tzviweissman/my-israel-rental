/**
 * NotificationSettings — Jobs Board notification preferences card.
 *
 * Three modes:
 *   • instant — email fires the moment a matching job is posted
 *   • digest  — one grouped email at ~9am (safer default)
 *   • both    — both channels
 *
 * Autosaves on toggle (no submit button). New/unsaved providers land
 * on 'digest' by default to avoid inbox overload on day one.
 *
 * Also lists any currently-active snoozes (per-category, 7-day rolling)
 * with a "clear" affordance so a provider who snoozed a category can
 * back out before the auto-expiry.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Bell, Zap, Layers, Loader2, X } from 'lucide-react';

const MODES = [
  {
    key: 'instant',
    icon: Zap,
    title: 'Instant per-post pings',
    desc: 'Email me the moment a matching job goes live. Best for fast responders.',
  },
  {
    key: 'digest',
    icon: Layers,
    title: 'Daily digest',
    desc: 'One email at ~9am with every match grouped by category. Quiet inbox.',
  },
  {
    key: 'both',
    icon: Bell,
    title: 'Both',
    desc: 'Get the ping AND the digest — belt and braces.',
  },
];

const CATEGORY_LABELS = {
  'home-repair': 'Home Repair',
  'womens-spa': "Women's Spa",
  'transportation': 'Transportation',
  'tours-activities': 'Tours & Activities',
  'music-entertainment': 'Music & Entertainment',
  'photo-video': 'Photo & Video',
  'other': 'Other',
};
const label = (slug) => CATEGORY_LABELS[slug] || slug;

const NotificationSettings = ({ API, token }) => {
  const [mode, setMode] = useState(null);
  const [snoozed, setSnoozed] = useState([]);
  const [saving, setSaving] = useState(false);
  const sectionRef = useRef(null);

  useEffect(() => {
    axios
      .get(`${API}/marketplace/notification-preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => {
        setMode(r.data.mode);
        setSnoozed(r.data.snoozed_categories || []);
      })
      .catch(() => {
        setMode('digest');
        setSnoozed([]);
      });
  }, [API, token]);

  // If the user landed via ?section=notifications, scroll the card
  // into view. Uses document.location so we don't need to plumb
  // searchParams down from the Dashboard.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('section') === 'notifications' && sectionRef.current) {
      sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const daysLeft = useMemo(() => {
    const now = Date.now();
    return (until) => Math.max(0, Math.ceil((new Date(until).getTime() - now) / (1000 * 60 * 60 * 24)));
  }, []);

  const patchMode = async (next) => {
    if (next === mode) return;
    setSaving(true);
    try {
      const { data } = await axios.patch(
        `${API}/marketplace/notification-preferences`,
        { mode: next },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMode(data.mode);
      setSnoozed(data.snoozed_categories || []);
      toast.success('Notification preference saved');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Could not save preference');
    } finally {
      setSaving(false);
    }
  };

  const clearSnooze = async (category) => {
    // Optimistic UI: drop from list immediately, then persist. On
    // failure we re-fetch to reconcile — no manual rollback needed
    // because prefs are small.
    const before = snoozed;
    setSnoozed((cur) => cur.filter((s) => s.category !== category));
    try {
      await axios.delete(
        `${API}/marketplace/notification-preferences/snooze/${category}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(`${label(category)} snooze cleared`);
    } catch (err) {
      setSnoozed(before);
      toast.error(err.response?.data?.detail || 'Could not clear snooze');
    }
  };

  if (mode === null) {
    return (
      <div
        className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl mb-6"
        data-testid="notification-settings-loading"
      >
        <Loader2 className="animate-spin text-[#1E6A6A]" size={20} />
      </div>
    );
  }

  return (
    <div
      ref={sectionRef}
      className="bg-white rounded-2xl border border-gray-200 p-6 max-w-2xl mb-6"
      data-testid="notification-settings-card"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-3 rounded-full bg-[#1E6A6A]/10">
          <Bell size={22} className="text-[#1E6A6A]" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900">Job match notifications</h3>
          <p className="text-sm text-gray-500">
            Choose how often we email you about new job matches. Saves automatically.
          </p>
        </div>
      </div>

      <div className="space-y-2" role="radiogroup" aria-label="Notification frequency">
        {MODES.map(({ key, icon: Icon, title, desc }) => {
          const active = key === mode;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => patchMode(key)}
              disabled={saving}
              className={`w-full text-left flex items-start gap-3 p-3 rounded-xl border transition-all ${
                active
                  ? 'border-[#1E6A6A] bg-[#1E6A6A]/5 ring-2 ring-[#1E6A6A]/20'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              } disabled:opacity-60`}
              data-testid={`notification-mode-${key}`}
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  active ? 'bg-[#1E6A6A] text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{title}</p>
                <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
              </div>
              <div
                className={`w-4 h-4 rounded-full border-2 mt-1 shrink-0 ${
                  active ? 'border-[#1E6A6A] bg-[#1E6A6A]' : 'border-gray-300 bg-white'
                }`}
              >
                {active && <div className="w-full h-full rounded-full bg-white scale-[0.4]" />}
              </div>
            </button>
          );
        })}
      </div>

      {snoozed.length > 0 && (
        <div className="mt-6 pt-5 border-t border-gray-100" data-testid="notification-snoozed-section">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Currently snoozed
          </p>
          <div className="flex flex-wrap gap-2">
            {snoozed.map((s) => (
              <span
                key={s.category}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-gray-100 text-gray-700 border border-gray-200"
                data-testid={`snooze-chip-${s.category}`}
              >
                <span className="font-semibold">{label(s.category)}</span>
                <span className="text-gray-500">· {daysLeft(s.until)}d left</span>
                <button
                  type="button"
                  onClick={() => clearSnooze(s.category)}
                  className="text-gray-400 hover:text-red-500 ml-0.5"
                  aria-label={`Clear ${label(s.category)} snooze`}
                  data-testid={`snooze-clear-${s.category}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationSettings;
