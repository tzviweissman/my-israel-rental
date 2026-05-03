import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Send, ArrowLeft, Home, User, Building2, Clock, MessageCircle, ChevronDown, Check, CheckCheck, Languages, X, Pencil, Search, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';

const HEBREW_RE = /[\u0590-\u05FF]/;

const Chat = () => {
  const { i18n, t } = useTranslation();
  const uiLang = i18n.language?.startsWith('he') ? 'he' : 'en';
  const { propertyId } = useParams();
  const [searchParams] = useSearchParams();
  // When the user clicked a Sublease card, the chat should talk to the
  // sublessor — not the underlying property owner.
  const subleaseId = searchParams.get('sublease_id');
  // When a lister/owner deep-links from a notification, `with` carries the
  // renter's id so we route messages to that specific person (not back to
  // themselves, which is what would happen if we naively used owner_id).
  const counterpartyOverride = searchParams.get('with');
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [property, setProperty] = useState(null);
  const [sublease, setSublease] = useState(null);
  const [otherUserId, setOtherUserId] = useState('');
  const [sending, setSending] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [theyAreTyping, setTheyAreTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const lastTypingEmitRef = useRef(0);
  // message_id -> { translated_text, target_lang } | 'loading'
  const [translations, setTranslations] = useState({});
  // Edit mode state: id of message being edited + draft text.
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const EDIT_WINDOW_MS = 5 * 60 * 1000;

  // Chat search state — toggled from the chat header search icon.
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeMatchIndex, setActiveMatchIndex] = useState(0);

  const beginEdit = (msg) => {
    setEditingId(msg.id);
    setEditingText(msg.message);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingText('');
  };

  const saveEdit = async (msgId) => {
    const next = editingText.trim();
    if (!next) {
      toast.error('Message cannot be empty');
      return;
    }
    const original = messages.find((m) => m.id === msgId);
    if (original && original.message === next) {
      cancelEdit();
      return;
    }
    const prev = messages;
    setMessages((cur) =>
      cur.map((m) =>
        m.id === msgId ? { ...m, message: next, edited_at: new Date().toISOString() } : m
      )
    );
    cancelEdit();
    try {
      await axios.put(
        `${API}/chat/messages/${msgId}`,
        { message: next },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Bust any cached translation in component state
      setTranslations((t) => {
        const n = { ...t };
        delete n[msgId];
        return n;
      });
    } catch (err) {
      setMessages(prev);
      toast.error(err.response?.data?.detail || 'Failed to update message');
    }
  };

  const translateMessage = async (msgId) => {
    if (translations[msgId] === 'loading') return;
    if (translations[msgId] && translations[msgId] !== 'hidden') {
      // Toggle off — hide existing translation
      setTranslations((prev) => ({ ...prev, [msgId]: 'hidden' }));
      return;
    }
    setTranslations((prev) => ({ ...prev, [msgId]: 'loading' }));
    try {
      const res = await axios.post(
        `${API}/chat/messages/${msgId}/translate`,
        { target_lang: uiLang },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTranslations((prev) => ({ ...prev, [msgId]: res.data }));
    } catch {
      setTranslations((prev) => {
        const next = { ...prev };
        delete next[msgId];
        return next;
      });
      toast.error('Translation failed');
    }
  };

  useEffect(() => {
    fetchProperty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  useEffect(() => {
    if (!otherUserId) return;
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, otherUserId]);

  // Poll the typing-indicator endpoint independently (faster cadence than
  // the message poll so the bubble feels live).
  useEffect(() => {
    if (!otherUserId || !propertyId) return;
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await axios.get(
          `${API}/chat/typing/${propertyId}?with_user=${otherUserId}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!cancelled) setTheyAreTyping(!!res.data?.typing);
      } catch {
        /* silent — endpoint is best-effort */
      }
    };
    poll();
    const interval = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [propertyId, otherUserId, token]);

  // Debounced typing-emit: at most one POST per 2 seconds while typing.
  const emitTyping = () => {
    if (!otherUserId) return;
    const now = Date.now();
    if (now - lastTypingEmitRef.current < 2000) return;
    lastTypingEmitRef.current = now;
    axios
      .post(
        `${API}/chat/typing`,
        { property_id: propertyId, with_user: otherUserId },
        { headers: { Authorization: `Bearer ${token}` } }
      )
      .catch(() => {
        /* silent */
      });
  };

  const handleDeleteMessage = async (msgId) => {
    if (!window.confirm('Delete this message? This cannot be undone.')) return;
    // Optimistic — remove from view immediately, restore on failure.
    const prev = messages;
    setMessages((cur) => cur.filter((m) => m.id !== msgId));
    try {
      await axios.delete(`${API}/chat/messages/${msgId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch (err) {
      setMessages(prev);
      toast.error(err.response?.data?.detail || 'Failed to delete message');
    }
  };

  useEffect(() => {
    scrollToBottom();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
    setShowScrollBtn(!isNearBottom);
  };

  const fetchProperty = async () => {
    // Honor explicit `?with=` deep-links first so the chat works even if the
    // underlying property has been deleted (orphan conversations).
    if (counterpartyOverride) {
      setOtherUserId(counterpartyOverride);
    }
    try {
      const response = await axios.get(`${API}/properties/${propertyId}`);
      setProperty(response.data);
      if (counterpartyOverride) {
        if (subleaseId) {
          try {
            const subRes = await axios.get(`${API}/subleases/${subleaseId}`);
            setSublease(subRes.data);
          } catch {
            /* sublease no longer exists — fall through */
          }
        }
        return;
      }
      if (subleaseId) {
        // Route the conversation to the sublessor rather than the property owner
        try {
          const subRes = await axios.get(`${API}/subleases/${subleaseId}`);
          setSublease(subRes.data);
          setOtherUserId(subRes.data.subleasor_id || response.data.owner_id);
        } catch {
          setOtherUserId(response.data.owner_id);
        }
      } else {
        setOtherUserId(response.data.owner_id);
      }
    } catch (error) {
      // Property may have been deleted — keep the override-derived
      // counterparty if present so the conversation still loads.
      console.error('Failed to fetch property', error);
    }
  };

  const fetchMessages = async () => {
    try {
      // When the lister deep-links via notification, scope to that single
      // counterparty so multi-renter inboxes don't bleed into one another.
      const url = otherUserId
        ? `${API}/chat/messages/${propertyId}?with_user=${otherUserId}`
        : `${API}/chat/messages/${propertyId}`;
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessages(response.data);
    } catch (error) {
      console.error('Failed to fetch messages', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;
    setSending(true);
    try {
      await axios.post(`${API}/chat/messages`, {
        property_id: propertyId,
        message: newMessage,
        receiver_id: otherUserId
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (iso) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDateHeader = (iso) => {
    const date = new Date(iso);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const getDateKey = (iso) => new Date(iso).toDateString();

  // Group messages by date
  const groupedMessages = messages.reduce((groups, msg) => {
    const dateKey = getDateKey(msg.created_at);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(msg);
    return groups;
  }, {});

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Search matches: ids of messages containing the query (case-insensitive),
  // plus a helper to render a message body with matches highlighted.
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const matchIds = normalizedQuery
    ? messages
        .filter((m) => (m.message || '').toLowerCase().includes(normalizedQuery))
        .map((m) => m.id)
    : [];

  // Clamp the active index whenever the matches change so it stays in range.
  useEffect(() => {
    if (matchIds.length === 0) {
      if (activeMatchIndex !== 0) setActiveMatchIndex(0);
      return;
    }
    if (activeMatchIndex >= matchIds.length) setActiveMatchIndex(0);
    // Scroll the active match into view
    const id = matchIds[Math.min(activeMatchIndex, matchIds.length - 1)];
    const el = document.querySelector(`[data-testid="message-${id}"]`);
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeMatchIndex]);

  const renderHighlighted = (text) => {
    if (!normalizedQuery) return text;
    const parts = [];
    const lower = text.toLowerCase();
    let cursor = 0;
    while (cursor < text.length) {
      const idx = lower.indexOf(normalizedQuery, cursor);
      if (idx === -1) {
        parts.push({ text: text.slice(cursor), match: false });
        break;
      }
      if (idx > cursor) parts.push({ text: text.slice(cursor, idx), match: false });
      parts.push({
        text: text.slice(idx, idx + normalizedQuery.length),
        match: true,
      });
      cursor = idx + normalizedQuery.length;
    }
    return parts.map((p, i) =>
      p.match ? (
        <mark
          key={i}
          className="bg-[#D4AF37] text-[#1E6A6A] rounded px-0.5"
        >
          {p.text}
        </mark>
      ) : (
        <React.Fragment key={i}>{p.text}</React.Fragment>
      )
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100" data-testid="chat-page">
      <div className="max-w-3xl mx-auto px-4 pt-20 pb-6 h-screen flex flex-col">

        {/* Chat Header */}
        <div className="bg-white rounded-t-2xl border border-b-0 border-gray-200 shadow-sm overflow-hidden flex-shrink-0">
          {/* Top bar with back button */}
          <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-[#1E6A6A] to-[#267a7a]">
            <button
              onClick={() => navigate(-1)}
              className="flex items-center gap-1.5 text-white/90 hover:text-white text-sm font-medium transition-colors"
              data-testid="chat-back-btn"
            >
              <ArrowLeft size={16} />
              {t('chat.back')}
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white/80 text-xs font-medium">{t('chat.liveChat')}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setSearchOpen((v) => {
                    const next = !v;
                    if (!next) {
                      setSearchQuery('');
                      setActiveMatchIndex(0);
                    }
                    return next;
                  });
                }}
                className={`p-2 rounded-lg transition-all backdrop-blur-sm ${searchOpen ? 'bg-white/30' : 'bg-white/15 hover:bg-white/25'}`}
                data-testid="chat-search-toggle"
                aria-label={t('chat.searchMessages')}
                title={t('chat.searchMessages')}
              >
                <Search size={14} className="text-white" />
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-all backdrop-blur-sm"
                data-testid="return-dashboard-btn"
              >
                <Home size={14} />
                {t('chat.dashboard')}
              </button>
            </div>
          </div>

          {/* Search bar (collapsible) */}
          {searchOpen && (
            <div
              className="flex items-center gap-2 px-5 py-2.5 border-b border-gray-100 bg-gray-50"
              data-testid="chat-search-bar"
            >
              <Search size={14} className="text-gray-400 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setActiveMatchIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (matchIds.length > 0) {
                      setActiveMatchIndex((i) => (i + 1) % matchIds.length);
                    }
                  } else if (e.key === 'Escape') {
                    setSearchOpen(false);
                    setSearchQuery('');
                    setActiveMatchIndex(0);
                  }
                }}
                placeholder={t('chat.searchPlaceholder')}
                autoFocus
                className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-gray-400"
                data-testid="chat-search-input"
              />
              {searchQuery && (
                <span className="text-[11px] text-gray-500 flex-shrink-0" data-testid="chat-search-counter">
                  {matchIds.length === 0 ? t('chat.noMatches') : t('chat.matchCounter', { current: activeMatchIndex + 1, total: matchIds.length })}
                </span>
              )}
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    matchIds.length > 0 &&
                    setActiveMatchIndex((i) => (i - 1 + matchIds.length) % matchIds.length)
                  }
                  disabled={matchIds.length === 0}
                  className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  data-testid="chat-search-prev"
                  aria-label={t('chat.previousMatch')}
                >
                  <ChevronUp size={14} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    matchIds.length > 0 && setActiveMatchIndex((i) => (i + 1) % matchIds.length)
                  }
                  disabled={matchIds.length === 0}
                  className="p-1 rounded text-gray-500 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed"
                  data-testid="chat-search-next"
                  aria-label={t('chat.nextMatch')}
                >
                  <ChevronDown size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSearchOpen(false);
                    setSearchQuery('');
                    setActiveMatchIndex(0);
                  }}
                  className="p-1 rounded text-gray-500 hover:bg-gray-200"
                  data-testid="chat-search-close"
                  aria-label={t('chat.closeSearch')}
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Property info bar */}
          {property && (
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
              <div className="w-11 h-11 rounded-xl bg-[#1E6A6A]/10 flex items-center justify-center shrink-0">
                <Building2 size={20} className="text-[#1E6A6A]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-gray-800 truncate">
                  {sublease?.title || property.title}
                </h3>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <span>{sublease?.area || property.area}</span>
                  {sublease ? (
                    <>
                      <span className="text-gray-300 mx-1">•</span>
                      <span className="font-medium" style={{ color: '#D4AF37' }}>
                        {sublease.currency === 'USD' ? '$' : '₪'}
                        {sublease.price?.toLocaleString()}
                        {sublease.price_type === 'per_night' ? '/night' : ' total'}
                      </span>
                    </>
                  ) : property.monthly_price ? (
                    <>
                      <span className="text-gray-300 mx-1">•</span>
                      <span className="font-medium" style={{ color: '#D4AF37' }}>
                        {property.currency === 'USD' ? '$' : '₪'}{property.monthly_price?.toLocaleString()}/mo
                      </span>
                    </>
                  ) : null}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#1E6A6A]/10 text-[#1E6A6A] uppercase tracking-wider">
                  {sublease ? t('chat.subleaseLabel') : property.rental_type?.replace('-', ' ')}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Messages Area */}
        <div
          ref={messagesContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto bg-white border-x border-gray-200 relative"
          style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, #f0f0f0 1px, transparent 0)', backgroundSize: '24px 24px' }}
          data-testid="chat-messages"
        >
          <div className="px-5 py-4 space-y-1">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-[#1E6A6A]/10 flex items-center justify-center mb-4">
                  <MessageCircle size={28} className="text-[#1E6A6A]" />
                </div>
                <p className="text-gray-500 font-medium text-sm">{t('chat.noMessages')}</p>
                <p className="text-gray-400 text-xs mt-1 max-w-[260px]">
                  {t('chat.startConversation')}
                </p>
              </div>
            ) : (
              Object.entries(groupedMessages).map(([dateKey, msgs]) => (
                <div key={dateKey}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4">
                    <div className="px-3 py-1 rounded-full bg-gray-100 border border-gray-200">
                      <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                        {formatDateHeader(msgs[0].created_at)}
                      </span>
                    </div>
                  </div>

                  {/* Messages for this date */}
                  {msgs.map((msg, idx) => {
                    const isMe = msg.sender_id === user.id;
                    const showAvatar = idx === 0 || msgs[idx - 1]?.sender_id !== msg.sender_id;
                    const isLast = idx === msgs.length - 1 || msgs[idx + 1]?.sender_id !== msg.sender_id;

                    return (
                      <div
                        key={msg.id}
                        className={`flex items-end gap-2 group ${isMe ? 'justify-end' : 'justify-start'} ${isLast ? 'mb-3' : 'mb-0.5'}`}
                        data-testid={`message-${msg.id}`}
                      >
                        {/* Avatar (other user) */}
                        {!isMe && (
                          <div className={`w-7 h-7 shrink-0 ${showAvatar ? 'visible' : 'invisible'}`}>
                            <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                              <span className="text-[10px] font-bold text-gray-500">{getInitials(msg.sender_name)}</span>
                            </div>
                          </div>
                        )}

                        {/* Delete X — only on my own messages, fades in on row hover */}
                        {isMe && editingId !== msg.id && (
                          <div className="flex flex-col items-center gap-1 self-center opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-all">
                            {(() => {
                              const created = new Date(msg.created_at).getTime();
                              const withinEditWindow = Number.isFinite(created) && Date.now() - created < EDIT_WINDOW_MS;
                              if (!withinEditWindow) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => beginEdit(msg)}
                                  className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm text-gray-500 hover:text-[#1E6A6A] hover:bg-white shadow-sm flex items-center justify-center transition-all"
                                  data-testid={`edit-message-${msg.id}`}
                                  aria-label={t('chat.editMessage')}
                                  title={t('chat.editWindow')}
                                >
                                  <Pencil size={11} />
                                </button>
                              );
                            })()}
                            <button
                              type="button"
                              onClick={() => handleDeleteMessage(msg.id)}
                              className="w-6 h-6 rounded-full bg-white/90 backdrop-blur-sm text-gray-500 hover:text-red-500 hover:bg-white shadow-sm flex items-center justify-center transition-all"
                              data-testid={`delete-message-${msg.id}`}
                              aria-label={t('chat.deleteMessage')}
                              title={t('chat.deleteMessage')}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}

                        {/* Message bubble */}
                        <div
                          className={`max-w-[70%] px-4 py-2.5 transition-all ${
                            isMe
                              ? `bg-gradient-to-br from-[#1E6A6A] to-[#1a5e5e] text-white ${isLast ? 'rounded-2xl rounded-br-md' : 'rounded-2xl'}`
                              : `bg-white border border-gray-200 text-gray-800 shadow-sm ${isLast ? 'rounded-2xl rounded-bl-md' : 'rounded-2xl'}`
                          } ${
                            normalizedQuery && matchIds[activeMatchIndex] === msg.id
                              ? 'ring-2 ring-[#D4AF37] ring-offset-2 ring-offset-transparent'
                              : ''
                          }`}
                        >
                          {editingId === msg.id ? (
                            <div className="space-y-2 min-w-[200px]">
                              <textarea
                                value={editingText}
                                onChange={(e) => setEditingText(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    saveEdit(msg.id);
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    cancelEdit();
                                  }
                                }}
                                rows={2}
                                autoFocus
                                className="w-full px-2 py-1.5 rounded-lg text-[13.5px] leading-relaxed bg-white/15 text-white placeholder-white/60 border border-white/30 focus:outline-none focus:ring-2 focus:ring-white/50 resize-none"
                                data-testid={`edit-input-${msg.id}`}
                              />
                              <div className="flex items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={cancelEdit}
                                  className="text-[11px] text-white/70 hover:text-white underline underline-offset-2"
                                  data-testid={`edit-cancel-${msg.id}`}
                                >
                                  {t('chat.cancel')}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => saveEdit(msg.id)}
                                  className="px-3 py-1 rounded-md text-[11px] font-bold text-[#1E6A6A] bg-[#D4AF37] hover:opacity-90"
                                  data-testid={`edit-save-${msg.id}`}
                                >
                                  {t('chat.save')}
                                </button>
                              </div>
                              <p className="text-[10px] text-white/60">{t('chat.editHint')}</p>
                            </div>
                          ) : (
                            <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">
                              {normalizedQuery ? renderHighlighted(msg.message) : msg.message}
                            </p>
                          )}

                          {/* Inline translation block */}
                          {(() => {
                            const tr = translations[msg.id];
                            const looksLikeOtherLang =
                              uiLang === 'en' ? HEBREW_RE.test(msg.message) : !HEBREW_RE.test(msg.message);
                            const showTranslateBtn = !isMe && looksLikeOtherLang;
                            if (tr === 'loading') {
                              return (
                                <p className={`text-[12px] mt-1.5 italic ${isMe ? 'text-white/70' : 'text-gray-500'}`}>
                                  {t('chat.translating')}
                                </p>
                              );
                            }
                            if (tr && tr !== 'hidden' && tr !== 'loading') {
                              return (
                                <div
                                  className={`mt-2 pt-2 border-t ${isMe ? 'border-white/20' : 'border-gray-200'}`}
                                  data-testid={`translation-${msg.id}`}
                                >
                                  <p className={`text-[10px] uppercase tracking-wider mb-1 ${isMe ? 'text-white/60' : 'text-gray-400'}`}>
                                    {tr.source_lang === 'he' ? t('chat.hebrewLabel') : t('chat.englishLabel')} → {tr.target_lang === 'he' ? t('chat.hebrewLabel') : t('chat.englishLabel')}
                                  </p>
                                  <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">
                                    {tr.translated_text}
                                  </p>
                                </div>
                              );
                            }
                            if (showTranslateBtn) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => translateMessage(msg.id)}
                                  className={`flex items-center gap-1 mt-1.5 text-[11px] underline-offset-2 hover:underline ${
                                    isMe ? 'text-white/70 hover:text-white' : 'text-[#1E6A6A] hover:text-[#155454]'
                                  }`}
                                  data-testid={`translate-btn-${msg.id}`}
                                >
                                  <Languages size={11} />
                                  {uiLang === 'en' ? t('chat.translateToEnglish') : t('chat.translateToHebrew')}
                                </button>
                              );
                            }
                            return null;
                          })()}

                          <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <Clock size={10} className={isMe ? 'text-white/50' : 'text-gray-400'} />
                            <span className={`text-[10px] ${isMe ? 'text-white/50' : 'text-gray-400'}`}>
                              {formatTime(msg.created_at)}
                            </span>
                            {msg.edited_at && (
                              <span
                                className={`text-[10px] italic ${isMe ? 'text-white/50' : 'text-gray-400'}`}
                                title={`Edited at ${formatTime(msg.edited_at)}`}
                              >
                                · {t('chat.edited')}
                              </span>
                            )}
                            {isMe && (
                              msg.read ? (
                                <CheckCheck
                                  size={12}
                                  className="text-[#D4AF37]"
                                  data-testid={`tick-read-${msg.id}`}
                                />
                              ) : (
                                <Check
                                  size={12}
                                  className="text-white/60"
                                  data-testid={`tick-sent-${msg.id}`}
                                />
                              )
                            )}
                          </div>
                        </div>

                        {/* Avatar (me) */}
                        {isMe && (
                          <div className={`w-7 h-7 shrink-0 ${showAvatar ? 'visible' : 'invisible'}`}>
                            <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: '#D4AF37' }}>
                              <span className="text-[10px] font-bold text-white">{getInitials(user?.name)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))
            )}
            {theyAreTyping && (
              <div
                className="flex items-end gap-2 justify-start mb-3"
                data-testid="typing-indicator"
              >
                <div className="w-7 h-7 shrink-0">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-gray-500">
                      {getInitials(sublease ? '' : property?.owner_name)}
                    </span>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 text-gray-800 shadow-sm rounded-2xl rounded-bl-md px-4 py-2.5">
                  <div className="flex items-center gap-1" aria-label="Typing">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Scroll to bottom button */}
          {showScrollBtn && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all z-10"
            >
              <ChevronDown size={16} className="text-gray-600" />
            </button>
          )}
        </div>

        {/* Message Input */}
        <div className="bg-white rounded-b-2xl border border-t-0 border-gray-200 shadow-sm flex-shrink-0">
          <form onSubmit={sendMessage} className="p-4" data-testid="chat-form">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => {
                    setNewMessage(e.target.value);
                    if (e.target.value.trim()) emitTyping();
                  }}
                  placeholder={t('chat.messagePlaceholder')}
                  className="w-full pl-4 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] focus:bg-white text-sm transition-all placeholder:text-gray-400"
                  data-testid="chat-input"
                />
              </div>
              <button
                type="submit"
                disabled={!newMessage.trim() || sending}
                className="w-11 h-11 rounded-xl flex items-center justify-center text-white disabled:opacity-30 transition-all hover:shadow-md active:scale-95 shrink-0"
                style={{ backgroundColor: newMessage.trim() ? '#1E6A6A' : '#93a3a3' }}
                data-testid="send-message-button"
              >
                <Send size={18} className={sending ? 'animate-pulse' : ''} />
              </button>
            </div>
          </form>
        </div>

        {/* Return to Dashboard Footer */}
        <div className="flex justify-center pt-4 flex-shrink-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-medium hover:border-[#1E6A6A] hover:text-[#1E6A6A] transition-all shadow-sm hover:shadow-md"
            data-testid="return-dashboard-footer-btn"
          >
            <Home size={16} />
            {t('chat.returnToDashboard')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
