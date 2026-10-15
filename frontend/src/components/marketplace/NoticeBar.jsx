/**
 * The business's notice bar (backend businesses.py Notice): one line at the
 * top of its page and its order page, "Closed for Sukkot" or "Free delivery
 * this week". Shown only between its dates, Israel time; in the business's
 * own colour with text that reads on it (utils/businessAccent.js).
 */
import React from 'react';
import { Megaphone } from 'lucide-react';
import { accentColors } from '../../utils/businessAccent';

const todayIL = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date());

/** The notice to show today, or null. */
export function liveNotice(business) {
  const n = business && business.notice;
  if (!n || !n.text) return null;
  const today = todayIL();
  if (n.starts_on && today < n.starts_on) return null;
  if (n.ends_on && today > n.ends_on) return null;
  return n;
}

export default function NoticeBar({ business, className = '', always = false }) {
  const n = always ? business?.notice : liveNotice(business);
  if (!n || !n.text) return null;
  const c = accentColors(business);
  return (
    <div role="note" className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold ${className}`}
         style={{ background: c.tint, color: c.on }} data-testid="notice-bar">
      <Megaphone size={16} aria-hidden="true" className="shrink-0" />
      <span dir="auto" className="min-w-0">{n.text}</span>
    </div>
  );
}
