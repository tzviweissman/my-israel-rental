import React, { useState, useEffect, useContext, useRef } from 'react';
import OnboardingProvider from '../components/onboarding/OnboardingProvider';
import OnboardingTip from '../components/onboarding/OnboardingTip';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Home } from 'lucide-react';
import { toast } from 'sonner';

import ChatHeader from '../components/chat/ChatHeader';
import MessageList from '../components/chat/MessageList';
import MessageInput from '../components/chat/MessageInput';

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
  const [job, setJob] = useState(null);
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
    // Scroll *only* the messages container, never the page itself.
    // Using messagesEndRef.scrollIntoView() would bubble up and pull the
    // whole window down on mobile (~1s after the messages list rendered),
    // which felt like "the screen automatically lowered" to the user.
    const container = messagesContainerRef.current;
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    }
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
      // Property may have been deleted OR the propertyId is actually a
      // Jobs-Board job UUID (a poster clicked "Message" on an applicant).
      // Try the job endpoint as a fallback — if it resolves, we render a
      // job info bar in the header instead of the property card.
      try {
        const jobRes = await axios.get(`${API}/marketplace/jobs/${propertyId}`);
        setJob(jobRes.data);
        // Counterparty: prefer `?with=` (poster→applicant), else fall
        // back to the job poster (applicant→poster).
        if (!counterpartyOverride) {
          setOtherUserId(jobRes.data.poster_user_id);
        }
      } catch {
        // Neither a live property nor a job — the conversation is a
        // pure orphan. Keep the `?with=` counterparty if present so the
        // messages still load.
        console.error('Failed to fetch property or job', error);
      }
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

  const sendMessage = async (e, opts = {}) => {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const imageUrl = opts.imageUrl || null;
    const videoUrl = opts.videoUrl || null;
    const hasMedia = !!(imageUrl || videoUrl);
    if (!hasMedia && !newMessage.trim()) return;
    if (sending) return;
    setSending(true);
    try {
      await axios.post(`${API}/chat/messages`, {
        property_id: propertyId,
        message: hasMedia ? '' : newMessage,
        receiver_id: otherUserId,
        image_url: imageUrl,
        video_url: videoUrl,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!hasMedia) setNewMessage('');
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

  // Search matches: ids of messages containing the query (case-insensitive).
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

  return (
    /* Chat is its own route, outside the dashboard's provider, so it
       carries one of its own. The "only one visible at a time" rule still
       holds: these are different pages and only one is ever on screen. */
    <OnboardingProvider>
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100" data-testid="chat-page">
      {/* Mobile nav is taller (top bar + category strip = ~123px); desktop
          nav is ~80px. Pad enough on mobile so the chat header (Back / Live
          Chat / Search / Dashboard) isn't hidden under the nav. */}
      <div className="max-w-3xl mx-auto px-4 pt-32 md:pt-20 pb-6 h-screen flex flex-col">
        {/* T2 — the one thing about this chat that is not obvious: it
            translates. Said once, where the typing happens. */}
        <OnboardingTip id="tip.chat" className="mb-2" />

        <ChatHeader
          property={property}
          sublease={sublease}
          job={job}
          onBack={() => navigate(-1)}
          onDashboard={() => navigate('/dashboard')}
          searchOpen={searchOpen}
          setSearchOpen={setSearchOpen}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          activeMatchIndex={activeMatchIndex}
          setActiveMatchIndex={setActiveMatchIndex}
          matchIds={matchIds}
        />

        <MessageList
          messages={messages}
          user={user}
          property={property}
          sublease={sublease}
          translations={translations}
          uiLang={uiLang}
          editingId={editingId}
          editingText={editingText}
          setEditingText={setEditingText}
          onBeginEdit={beginEdit}
          onCancelEdit={cancelEdit}
          onSaveEdit={saveEdit}
          onDelete={handleDeleteMessage}
          onTranslate={translateMessage}
          normalizedQuery={normalizedQuery}
          matchIds={matchIds}
          activeMatchIndex={activeMatchIndex}
          theyAreTyping={theyAreTyping}
          messagesContainerRef={messagesContainerRef}
          messagesEndRef={messagesEndRef}
          onScroll={handleScroll}
          showScrollBtn={showScrollBtn}
          onScrollToBottom={scrollToBottom}
        />

        <MessageInput
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          onSend={sendMessage}
          sending={sending}
          onTyping={emitTyping}
          API={API}
          token={token}
        />

        {/* Return to Dashboard Footer */}
        <div className="flex justify-center pt-4 flex-shrink-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-600 text-sm font-medium hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] transition-all shadow-sm hover:shadow-md"
            data-testid="return-dashboard-footer-btn"
          >
            <Home size={16} />
            {t('chat.returnToDashboard')}
          </button>
        </div>
      </div>
    </div>
    </OnboardingProvider>
  );
};

export default Chat;

