import React from 'react';
import { useTranslation } from 'react-i18next';
import { Clock, Check, CheckCheck, Pencil, X, MessageCircle, Languages, ChevronDown, AtSign } from 'lucide-react';

const HEBREW_RE = /[\u0590-\u05FF]/;
const EDIT_WINDOW_MS = 5 * 60 * 1000;

// Match the same `@owner|@renter|@manager` word-boundary tokens the backend
// stores. Used to render the @-pill chips inline inside a message bubble.
const MENTION_TOKEN_RE = /(?<![A-Za-z0-9_])@(owner|renter|manager)\b/gi;

// ---------- pure helpers --------------------------------------------------

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

const getInitials = (name) => {
  if (!name) return '?';
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
};

const renderHighlighted = (text, normalizedQuery) => {
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
    parts.push({ text: text.slice(idx, idx + normalizedQuery.length), match: true });
    cursor = idx + normalizedQuery.length;
  }
  return parts.map((p, i) =>
    p.match ? (
      <mark key={i} className="bg-[#D4AF37] text-[#1E6A6A] rounded px-0.5">{p.text}</mark>
    ) : (
      <React.Fragment key={i}>{p.text}</React.Fragment>
    ),
  );
};

// Convert plain text into React nodes where @-mentions are rendered as
// pill chips. Works on already-highlighted output too (the chips wrap
// around any inner mark from the search highlighter).
const renderWithMentions = (textOrNodes, isMe) => {
  // If we already got React nodes (from highlight pass), only walk string
  // children; leave existing React elements untouched.
  const walkString = (str, keyPrefix) => {
    if (!MENTION_TOKEN_RE.test(str)) {
      MENTION_TOKEN_RE.lastIndex = 0;
      return [str];
    }
    MENTION_TOKEN_RE.lastIndex = 0;
    const out = [];
    let last = 0;
    let match;
    let i = 0;
    while ((match = MENTION_TOKEN_RE.exec(str)) !== null) {
      const before = str.slice(last, match.index);
      if (before) out.push(before);
      out.push(
        <span
          key={`${keyPrefix}-m-${i}`}
          className={`inline-flex items-center gap-0.5 px-1.5 rounded-md font-semibold text-[12px] ${
            isMe ? 'bg-white/20 text-white' : 'bg-[#D4AF37]/15 text-[#8a6d1d]'
          }`}
        >
          <AtSign size={10} className="opacity-80" />
          {match[1]}
        </span>,
      );
      last = match.index + match[0].length;
      i += 1;
    }
    if (last < str.length) out.push(str.slice(last));
    return out;
  };

  if (typeof textOrNodes === 'string') {
    return walkString(textOrNodes, 't');
  }
  if (Array.isArray(textOrNodes)) {
    return textOrNodes.flatMap((node, idx) => {
      if (typeof node === 'string') return walkString(node, `n${idx}`);
      return [node];
    });
  }
  return textOrNodes;
};

// ---------- internal sub-components --------------------------------------

const InlineTranslation = ({ msg, isMe, translations, uiLang, onTranslate }) => {
  const { t } = useTranslation();
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
          {tr.source_lang === 'he' ? t('chat.hebrewLabel') : t('chat.englishLabel')} →{' '}
          {tr.target_lang === 'he' ? t('chat.hebrewLabel') : t('chat.englishLabel')}
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
        onClick={() => onTranslate(msg.id)}
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
};

const EditPanel = ({ msg, editingText, setEditingText, onSave, onCancel }) => {
  const { t } = useTranslation();
  return (
    <div className="space-y-2 min-w-[200px]">
      <textarea
        value={editingText}
        onChange={(e) => setEditingText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            onSave(msg.id);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
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
          onClick={onCancel}
          className="text-[11px] text-white/70 hover:text-white underline underline-offset-2"
          data-testid={`edit-cancel-${msg.id}`}
        >
          {t('chat.cancel')}
        </button>
        <button
          type="button"
          onClick={() => onSave(msg.id)}
          className="px-3 py-1 rounded-md text-[11px] font-bold text-[#1E6A6A] bg-[#D4AF37] hover:opacity-90"
          data-testid={`edit-save-${msg.id}`}
        >
          {t('chat.save')}
        </button>
      </div>
      <p className="text-[10px] text-white/60">{t('chat.editHint')}</p>
    </div>
  );
};

const MessageBubble = ({
  msg, isMe, isLast, showAvatar,
  user, normalizedQuery, matchIds, activeMatchIndex,
  translations, uiLang,
  editingId, editingText, setEditingText,
  onBeginEdit, onCancelEdit, onSaveEdit, onDelete, onTranslate,
}) => {
  const { t } = useTranslation();
  const isHighlighted =
    normalizedQuery && matchIds[activeMatchIndex] === msg.id;

  return (
    <div
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
            const withinEditWindow =
              Number.isFinite(created) && Date.now() - created < EDIT_WINDOW_MS;
            if (!withinEditWindow) return null;
            return (
              <button
                type="button"
                onClick={() => onBeginEdit(msg)}
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
            onClick={() => onDelete(msg.id)}
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
        } ${isHighlighted ? 'ring-2 ring-[#D4AF37] ring-offset-2 ring-offset-transparent' : ''}`}
      >
        {editingId === msg.id ? (
          <EditPanel
            msg={msg}
            editingText={editingText}
            setEditingText={setEditingText}
            onSave={onSaveEdit}
            onCancel={onCancelEdit}
          />
        ) : (
          <>
            {msg.image_url && (
              <a
                href={msg.image_url}
                target="_blank"
                rel="noopener noreferrer"
                className="block mb-1"
                data-testid={`chat-image-${msg.id}`}
              >
                <img
                  src={msg.image_url}
                  alt="Shared"
                  loading="lazy"
                  className="rounded-xl max-w-full max-h-72 object-cover border border-black/10 cursor-zoom-in hover:opacity-95 transition-opacity"
                />
              </a>
            )}
            {msg.video_url && (
              <video
                src={msg.video_url}
                controls
                preload="metadata"
                playsInline
                className="rounded-xl max-w-full max-h-72 mb-1 border border-black/10 bg-black"
                data-testid={`chat-video-${msg.id}`}
              >
                <a href={msg.video_url} target="_blank" rel="noopener noreferrer">
                  Open video
                </a>
              </video>
            )}
            {msg.message && (
              <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">
                {renderWithMentions(
                  normalizedQuery
                    ? renderHighlighted(msg.message, normalizedQuery)
                    : msg.message,
                  isMe,
                )}
              </p>
            )}
          </>
        )}

        <InlineTranslation
          msg={msg}
          isMe={isMe}
          translations={translations}
          uiLang={uiLang}
          onTranslate={onTranslate}
        />

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
          {isMe &&
            (msg.read ? (
              <CheckCheck size={12} className="text-[#D4AF37]" data-testid={`tick-read-${msg.id}`} />
            ) : (
              <Check size={12} className="text-white/60" data-testid={`tick-sent-${msg.id}`} />
            ))}
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
};

/**
 * Scrollable messages area: empty state, date separators, message bubbles,
 * typing indicator, scroll-to-bottom button. Self-grouping by day. All
 * state stays in the parent (Chat.js).
 */
const MessageList = ({
  messages, user, property, sublease,
  translations, uiLang,
  editingId, editingText, setEditingText,
  onBeginEdit, onCancelEdit, onSaveEdit, onDelete, onTranslate,
  normalizedQuery, matchIds, activeMatchIndex,
  theyAreTyping,
  messagesContainerRef, messagesEndRef, onScroll,
  showScrollBtn, onScrollToBottom,
}) => {
  const { t } = useTranslation();

  // Group messages by day for date separators.
  const groupedMessages = messages.reduce((groups, msg) => {
    const key = getDateKey(msg.created_at);
    if (!groups[key]) groups[key] = [];
    groups[key].push(msg);
    return groups;
  }, {});

  return (
    <div
      ref={messagesContainerRef}
      onScroll={onScroll}
      className="flex-1 overflow-y-auto bg-white border-x border-gray-200 relative"
      style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, #f0f0f0 1px, transparent 0)',
        backgroundSize: '24px 24px',
      }}
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

              {msgs.map((msg, idx) => {
                const isMe = msg.sender_id === user.id;
                const showAvatar = idx === 0 || msgs[idx - 1]?.sender_id !== msg.sender_id;
                const isLast = idx === msgs.length - 1 || msgs[idx + 1]?.sender_id !== msg.sender_id;
                return (
                  <MessageBubble
                    key={msg.id}
                    msg={msg}
                    isMe={isMe}
                    isLast={isLast}
                    showAvatar={showAvatar}
                    user={user}
                    normalizedQuery={normalizedQuery}
                    matchIds={matchIds}
                    activeMatchIndex={activeMatchIndex}
                    translations={translations}
                    uiLang={uiLang}
                    editingId={editingId}
                    editingText={editingText}
                    setEditingText={setEditingText}
                    onBeginEdit={onBeginEdit}
                    onCancelEdit={onCancelEdit}
                    onSaveEdit={onSaveEdit}
                    onDelete={onDelete}
                    onTranslate={onTranslate}
                  />
                );
              })}
            </div>
          ))
        )}
        {theyAreTyping && (
          <div className="flex items-end gap-2 justify-start mb-3" data-testid="typing-indicator">
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

      {showScrollBtn && (
        <button
          onClick={onScrollToBottom}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-white border border-gray-200 shadow-lg flex items-center justify-center hover:bg-gray-50 transition-all z-10"
        >
          <ChevronDown size={16} className="text-gray-600" />
        </button>
      )}
    </div>
  );
};

export default MessageList;
