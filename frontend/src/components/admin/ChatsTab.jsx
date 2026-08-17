import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { toast } from 'sonner';
import {
  ChevronDown, ChevronUp, MessageCircle, AlertTriangle, BellRing, Loader2, Clock, Link2,
} from 'lucide-react';
import { API } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';

// Format a Date / iso string as "5min ago", "3h ago", "2d ago"…
const relTime = (iso) => {
  if (!iso) return '';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};

/**
 * Super Admin → Chats tab.
 *
 * Adds three things over the bare conversation list:
 *  • Sort by last-message time (newest first).
 *  • Per-row recency stamp ("5h ago") + absolute time on hover.
 *  • Red "Owner not replied in 24h" alert + per-row "Nudge owner" action
 *    that fires a courtesy Postmark email (throttled to once / 24h).
 */
export const ChatsTab = ({ token }) => {
  const { t } = useTranslation();
  const { data: chats, refresh } = useApiSWR(
    `${API}/admin/chats`, token, { initial: [] }
  );
  const [expandedChat, setExpandedChat] = useState(null);
  const [nudgingKey, setNudgingKey] = useState(null);
  // Per-conv "Re-attach to surviving listing" inline form: tracks which
  // row is in input mode, the target property id being typed, and whether
  // the reattach API call is in flight.
  const [reattachingKey, setReattachingKey] = useState(null);
  const [reattachTarget, setReattachTarget] = useState('');
  const [reattachLoading, setReattachLoading] = useState(false);

  const unresponsiveCount = chats.filter((c) => c.owner_unresponsive).length;
  const orphanCount = chats.filter((c) => c.property_missing).length;

  const submitReattach = async (conv) => {
    const dst = (reattachTarget || '').trim();
    if (!dst) return toast.error('Paste the surviving property id');
    setReattachLoading(true);
    try {
      const res = await axios.post(
        `${API}/admin/chats/reattach`,
        { from_property_id: conv.property_id, to_property_id: dst },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const r = res.data.reattached || {};
      toast.success(
        `Re-attached to "${res.data.to_property_title}" — ${r.messages} messages, ${r.bookings} bookings moved`,
      );
      setReattachingKey(null);
      setReattachTarget('');
      refresh();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Re-attach failed');
    } finally {
      setReattachLoading(false);
    }
  };

  const nudgeOwner = async (conv) => {
    setNudgingKey(conv.conv_key);
    try {
      const res = await axios.post(
        `${API}/admin/chats/nudge-owner`,
        { conv_key: conv.conv_key },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success(`Nudge sent to ${res.data.owner_name || res.data.owner_email}`);
      refresh();
    } catch (e) {
      const detail = e.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Nudge failed');
    } finally {
      setNudgingKey(null);
    }
  };

  return (
    <div data-testid="admin-chats-section">
      {/* Top alert: count of conversations whose referenced property has
          been deleted (orphaned chats). The inline re-attach UI on each
          row fixes them one at a time. */}
      {orphanCount > 0 && (
        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-3" data-testid="orphan-banner">
          <Link2 size={18} className="text-amber-700 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-900">
              {orphanCount} {orphanCount === 1 ? 'conversation' : 'conversations'} pointing at deleted listings
            </p>
            <p className="text-xs text-amber-800 mt-0.5">
              These chats open to &quot;Property not found&quot;. Use the <b>Re-attach</b> button on each row to move the messages onto a surviving listing (typically the duplicate&apos;s twin).
            </p>
          </div>
        </div>
      )}

      {/* Top alert: count of conversations where the owner hasn't replied
          for >24h. Clicking expands the first one to make triage fast. */}
      {unresponsiveCount > 0 && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-3" data-testid="unresponsive-banner">
          <AlertTriangle size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-900">
              {unresponsiveCount} {unresponsiveCount === 1 ? 'conversation' : 'conversations'} waiting more than 24h for the owner to reply
            </p>
            <p className="text-xs text-red-800 mt-0.5">
              Each row below has a <b>Nudge owner</b> button that emails a polite reminder. Throttled to once per conversation per 24h.
            </p>
          </div>
        </div>
      )}

      {chats.length === 0 && (
        <p className="text-center text-gray-400 py-12 text-sm">{t('admin.noConversations')}</p>
      )}
      <div className="space-y-3">
        {chats.map((conv, idx) => {
          const isExpanded = expandedChat === idx;
          const unresp = !!conv.owner_unresponsive;
          const hoursSince = conv.hours_since_last_message;
          const nudgeRecentlySent = conv.last_nudge_sent_at;
          // The owner is whichever participant has the highest property-
          // owner role — fall back to "owner" by role if we have it.
          const ownerName = (conv.participants || []).find((p) => p.role === 'owner')?.name
            || (conv.participants || [])[1]?.name;
          return (
            <div
              key={conv.conv_key || conv.property_id || idx}
              className={`bg-white rounded-xl overflow-hidden border ${unresp ? 'border-red-300' : 'border-[#E5E5E5]'}`}
              data-testid={`chat-conv-${idx}`}
            >
              <button
                onClick={() => setExpandedChat(isExpanded ? null : idx)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                data-testid={`chat-toggle-${idx}`}
              >
                <div className="flex items-center gap-4 text-left flex-1 min-w-0">
                  <div className={`p-2 rounded-lg ${unresp ? 'bg-red-600' : ''}`} style={{ backgroundColor: unresp ? undefined : 'var(--brand-primary)' }}>
                    {unresp ? <BellRing size={16} color="#fff" /> : <MessageCircle size={16} color="var(--gold)" />}
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{conv.property_title}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {conv.participants?.map((p) => `${p.name} (${p.role})`).join(' & ')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {conv.last_message_time && (
                    <span
                      className="text-[11px] text-gray-500 inline-flex items-center gap-1"
                      title={new Date(conv.last_message_time).toLocaleString()}
                    >
                      <Clock size={11} /> {relTime(conv.last_message_time)}
                    </span>
                  )}
                  {unresp && (
                    <span className="text-[10px] uppercase tracking-wider bg-red-600 text-white px-2 py-0.5 rounded-full font-bold">
                      owner unresponsive · {Math.round(hoursSince || 0)}h
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {conv.messages?.length || 0} {t('admin.messages')}
                  </span>
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {/* Inline nudge action — visible whenever the conversation is
                  flagged unresponsive, regardless of expand state. */}
              {unresp && (
                <div className="border-t border-red-100 bg-red-50/50 px-5 py-2.5 flex items-center gap-2 flex-wrap" data-testid={`nudge-bar-${idx}`}>
                  <p className="text-xs text-red-900 flex-1 min-w-[180px]">
                    Email <b>{ownerName || 'the owner'}</b> a polite reminder to reply.
                    {nudgeRecentlySent && (
                      <span className="block text-[11px] text-red-700/80 mt-0.5">
                        Last nudge sent {relTime(nudgeRecentlySent)}.
                      </span>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); nudgeOwner(conv); }}
                    disabled={nudgingKey === conv.conv_key}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                    data-testid={`nudge-btn-${idx}`}
                  >
                    {nudgingKey === conv.conv_key ? <Loader2 size={12} className="animate-spin" /> : <BellRing size={12} />}
                    Nudge owner
                  </button>
                </div>
              )}

              {/* Orphan-listing recovery: when the referenced property was
                  deleted (e.g. old duplicate cleanup) the chat opens to
                  "Property not found". This inline form lets an admin
                  re-point the entire conversation at the surviving twin
                  via the new POST /admin/chats/reattach endpoint. */}
              {conv.property_missing && (
                <div className="border-t border-amber-100 bg-amber-50/60 px-5 py-2.5" data-testid={`orphan-bar-${idx}`}>
                  {reattachingKey === conv.conv_key ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-amber-900 font-semibold shrink-0">Re-attach to listing id:</span>
                      <input
                        type="text"
                        value={reattachTarget}
                        onChange={(e) => setReattachTarget(e.target.value)}
                        placeholder="surviving property id (uuid)"
                        className="flex-1 min-w-[200px] text-xs font-mono px-2 py-1.5 rounded border border-amber-300 focus:border-amber-500 focus:outline-none"
                        data-testid={`reattach-input-${idx}`}
                      />
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); submitReattach(conv); }}
                        disabled={reattachLoading || !reattachTarget.trim()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50"
                        data-testid={`reattach-submit-${idx}`}
                      >
                        {reattachLoading ? <Loader2 size={12} className="animate-spin" /> : <Link2 size={12} />}
                        Re-attach
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setReattachingKey(null); setReattachTarget(''); }}
                        className="text-xs text-gray-600 hover:text-gray-800"
                      >Cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-amber-900 flex-1 min-w-[180px]">
                        <b>Listing removed.</b> Chat is orphaned — clicking through opens &quot;Property not found&quot;.
                        Original id: <code className="bg-white px-1 rounded font-mono text-[10px]">{conv.property_id}</code>
                      </p>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setReattachingKey(conv.conv_key); setReattachTarget(''); }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700"
                        data-testid={`reattach-open-${idx}`}
                      >
                        <Link2 size={12} /> Re-attach to surviving listing
                      </button>
                    </div>
                  )}
                </div>
              )}

              {isExpanded && (
                <div className="border-t border-[#E5E5E5] px-5 py-4 max-h-80 overflow-y-auto bg-gray-50">
                  {(conv.messages || []).map((msg, mIdx) => {
                    const sender = conv.participants?.find((p) => p.id === msg.sender_id);
                    return (
                      <div key={mIdx} className="mb-3" data-testid={`chat-message-${idx}-${mIdx}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-semibold">{sender?.name || t('admin.unknown')}</span>
                          <span className="text-xs text-gray-400" title={new Date(msg.created_at).toLocaleString()}>
                            {relTime(msg.created_at)}
                          </span>
                        </div>
                        {msg.message && (
                          <p className="text-sm text-gray-700 bg-white rounded-lg px-3 py-2 border border-[#E5E5E5] inline-block whitespace-pre-wrap break-words max-w-prose">
                            {msg.message}
                          </p>
                        )}
                        {msg.image_url && (
                          <a href={msg.image_url} target="_blank" rel="noreferrer" className="inline-block mt-1">
                            <img src={msg.image_url} alt="" loading="lazy" className="max-w-[180px] max-h-32 rounded-lg border border-gray-200 object-cover" />
                          </a>
                        )}
                        {msg.video_url && (
                          <a href={msg.video_url} target="_blank" rel="noreferrer" className="inline-block mt-1 text-xs text-[var(--brand-primary)] underline">
                            [video] {msg.video_url}
                          </a>
                        )}
                      </div>
                    );
                  })}
                  {(!conv.messages || conv.messages.length === 0) && (
                    <p className="text-sm text-gray-400">{t('admin.noMessages')}</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ChatsTab;
