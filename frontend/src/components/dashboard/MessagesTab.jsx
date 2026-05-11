import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { MessageCircle, Building2 } from 'lucide-react';

/**
 * Inbox tab — lists every conversation the current user is part of and
 * deep-links into the matching `/chat/:propertyId?with=…` route.
 */
const MessagesTab = ({ API, token, onUnreadChange }) => {
  const { t } = useTranslation();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchConversations = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/chat/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const list = res.data || [];
      setConversations(list);
      if (onUnreadChange) onUnreadChange(list.filter((c) => c.unread).length);
    } catch (err) {
      console.error('Failed to fetch conversations', err);
    } finally {
      setLoading(false);
    }
  }, [API, token, onUnreadChange]);

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 15000);
    return () => clearInterval(interval);
  }, [fetchConversations]);

  const openConversation = (conv) => {
    const counterpartyId = conv.other_user?.id;
    const params = new URLSearchParams();
    if (counterpartyId) params.set('with', counterpartyId);
    const qs = params.toString();
    navigate(`/chat/${conv.property_id}${qs ? `?${qs}` : ''}`);
  };

  if (loading) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm" data-testid="messages-tab-loading">
        {t('dashboard.loadingConversations')}
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div
        className="text-center py-16 bg-white rounded-2xl border border-gray-100"
        data-testid="messages-tab-empty"
      >
        <MessageCircle size={36} className="mx-auto mb-3 text-gray-300" />
        <p className="text-gray-500 text-sm">{t('dashboard.noConversations')}</p>
        <p className="text-gray-400 text-xs mt-1">
          {t('dashboard.noConversationsHint')}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="messages-tab">
      {conversations.map((conv) => {
        const key = `${conv.property_id}-${conv.other_user?.id || conv.other_user?.email || 'x'}`;
        const isUnread = !!conv.unread;
        const fromMe = !!conv.last_message_from_me;
        const previewTime = conv.last_message_time
          ? new Date(conv.last_message_time).toLocaleDateString([], { month: 'short', day: 'numeric' })
          : null;
        return (
          <button
            key={key}
            onClick={() => openConversation(conv)}
            className={`w-full text-left bg-white rounded-2xl border transition-all hover:shadow-md p-4 flex items-start gap-3 ${
              isUnread ? 'border-[#D4AF37] ring-1 ring-[#D4AF37]/30' : 'border-gray-100'
            }`}
            data-testid={`conversation-${conv.property_id}`}
          >
            <div className="w-11 h-11 rounded-full bg-[#1E6A6A]/10 flex items-center justify-center flex-shrink-0">
              <Building2 size={20} className="text-[#1E6A6A]" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className={`text-sm truncate ${isUnread ? 'font-bold text-gray-900' : 'font-semibold text-gray-800'}`}>
                  {conv.property_title || 'Property'}
                </p>
                {previewTime && (
                  <span className="text-[11px] text-gray-400 flex-shrink-0">{previewTime}</span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5 truncate">
                {conv.other_user?.name || conv.other_user?.email || 'Unknown sender'}
              </p>
              {/* Mini chat-bubble preview — shifted left/right with teal/white
                  styling so the inbox row matches the conversation view at a
                  glance. */}
              {conv.last_message ? (
                <div className={`mt-1.5 flex ${fromMe ? 'justify-end' : 'justify-start'}`}>
                  <span
                    className={`inline-block max-w-[85%] truncate rounded-2xl px-3 py-1.5 text-xs leading-relaxed ${
                      fromMe
                        ? 'bg-gradient-to-br from-[#1E6A6A] to-[#1a5e5e] text-white rounded-br-md'
                        : 'bg-gray-100 text-gray-800 rounded-bl-md'
                    } ${isUnread && !fromMe ? 'font-semibold' : ''}`}
                    data-testid={`conversation-preview-${conv.property_id}`}
                  >
                    {fromMe && <span className="opacity-70 mr-1">You:</span>}
                    {conv.last_message}
                  </span>
                </div>
              ) : (
                <p className="text-sm mt-1 text-gray-400 italic">—</p>
              )}
            </div>
            {isUnread && (
              <span
                className="w-2.5 h-2.5 rounded-full bg-[#D4AF37] mt-2 flex-shrink-0"
                aria-label="Unread"
              />
            )}
          </button>
        );
      })}
    </div>
  );
};

export default MessagesTab;
