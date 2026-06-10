import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Send, AtSign, User, Home, Briefcase, Paperclip, Loader2, X, PlayCircle } from 'lucide-react';
import { uploadFilesFast } from '../../utils/fastUpload';

// Role tokens recognised by the backend mention parser (utils/mentions.py).
// Keep this list in sync — adding one here without backend support means the
// email-ping task will never fire for it.
const ROLES = [
  { key: 'owner', icon: Home, color: '#1E6A6A' },
  { key: 'renter', icon: User, color: '#1E6A6A' },
  { key: 'manager', icon: Briefcase, color: '#D4AF37' },
];

/**
 * Find an in-progress "@partial" token at the cursor position.
 * Returns `{ start, partial }` or null if the cursor isn't inside one.
 * Matches `@` only at the start of the string or after whitespace, so an
 * email like "foo@bar.com" never triggers the popover.
 */
const findMentionContext = (text, caret) => {
  if (caret == null) return null;
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  // The chars between @ and caret must be word-ish (or empty)
  const partial = before.slice(at + 1);
  if (!/^[A-Za-z]*$/.test(partial)) return null;
  // The char before @ must be start-of-string or whitespace
  const prev = at === 0 ? '' : before[at - 1];
  if (prev && !/\s/.test(prev)) return null;
  return { start: at, partial: partial.toLowerCase() };
};

/**
 * Sticky message input at the bottom of the chat. Owns nothing — the parent
 * holds `newMessage` because emitTyping is also wired to keystrokes.
 *
 * Adds a role-aware @-mention autocomplete: when the user types `@`, a small
 * popover surfaces `@owner` / `@renter` / `@manager` chips with localized
 * descriptions. Selecting one (mouse or Enter on the keyboard-highlighted
 * row) injects the canonical token at the cursor.
 */
const MessageInput = ({ newMessage, setNewMessage, onSend, sending, onTyping, API, token }) => {
  const { t } = useTranslation();
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const [mention, setMention] = useState(null); // { start, partial }
  const [hoverIdx, setHoverIdx] = useState(0);
  // Pending attachments waiting to be sent. Each entry is
  // { url, preview, kind: 'image'|'video' }. The user can queue up many
  // photos/videos in a single picker tap and we'll fan-out one chat message
  // per attachment when they hit Send.
  const [pending, setPending] = useState([]);
  const [uploading, setUploading] = useState(false);

  const pickPhoto = () => fileRef.current?.click();

  const onPickFile = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    try {
      const results = await uploadFilesFast(files, API, token);
      // Build local previews aligned to source files (uploads run in parallel
      // but uploadFilesFast preserves order).
      const next = [];
      results.forEach((r, idx) => {
        const src = files[idx];
        if (!r || r.error) {
          toast.error(`Couldn't upload ${src?.name || 'file'}: ${r?.error || 'unknown error'}`);
          return;
        }
        const kind = (src?.type || '').startsWith('video/') ? 'video' : 'image';
        next.push({
          url: r.url,
          preview: URL.createObjectURL(src),
          kind,
          name: src?.name || '',
        });
      });
      if (next.length) setPending((p) => [...p, ...next]);
    } finally {
      setUploading(false);
    }
  };

  const removePending = (idx) => {
    setPending((p) => {
      const removed = p[idx];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return p.filter((_, i) => i !== idx);
    });
  };

  const sendAttachments = async () => {
    if (pending.length === 0) return;
    // Snapshot + clear up-front so the user can't double-tap Send while the
    // batch is mid-flight.
    const batch = pending;
    setPending([]);
    for (const item of batch) {
      try {
        if (item.kind === 'video') {
          await onSend(null, { videoUrl: item.url });
        } else {
          await onSend(null, { imageUrl: item.url });
        }
      } catch {
        // onSend already surfaces a toast; keep firing the remaining ones.
      } finally {
        if (item.preview) URL.revokeObjectURL(item.preview);
      }
    }
  };

  const matches = mention
    ? ROLES.filter((r) => r.key.startsWith(mention.partial))
    : [];
  const showPopover = mention != null && matches.length > 0;

  // Reset the keyboard-highlighted row whenever the visible matches change
  useEffect(() => {
    setHoverIdx(0);
  }, [mention?.partial, matches.length]);

  const recomputeMention = useCallback((value, caret) => {
    setMention(findMentionContext(value, caret));
  }, []);

  const handleChange = (e) => {
    const value = e.target.value;
    setNewMessage(value);
    if (value.trim()) onTyping();
    recomputeMention(value, e.target.selectionStart);
  };

  const handleSelect = (e) => {
    if (e.target === document.activeElement) {
      recomputeMention(e.target.value, e.target.selectionStart);
    }
  };

  const insertMention = (roleKey) => {
    if (!mention) return;
    const before = newMessage.slice(0, mention.start);
    const afterCaret = newMessage.slice(
      inputRef.current?.selectionStart ?? mention.start + mention.partial.length + 1,
    );
    // Always inject a trailing space so the user can keep typing.
    const insertion = `@${roleKey} `;
    const next = `${before}${insertion}${afterCaret}`;
    setNewMessage(next);
    setMention(null);
    // Restore focus + caret right after the inserted token
    requestAnimationFrame(() => {
      const node = inputRef.current;
      if (node) {
        const pos = before.length + insertion.length;
        node.focus();
        node.setSelectionRange(pos, pos);
      }
    });
  };

  const handleKeyDown = (e) => {
    if (!showPopover) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHoverIdx((i) => (i + 1) % matches.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHoverIdx((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(matches[hoverIdx].key);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setMention(null);
    }
  };

  return (
    <div className="bg-white rounded-b-2xl border border-t-0 border-gray-200 shadow-sm flex-shrink-0">
      {pending.length > 0 && (
        <div className="px-4 pt-3 pb-1" data-testid="pending-attachments">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:thin]">
            {pending.map((item, idx) => (
              <div key={idx} className="relative shrink-0" data-testid={`pending-attachment-${idx}`}>
                {item.kind === 'video' ? (
                  <div className="w-16 h-16 rounded-lg border border-gray-200 bg-black flex items-center justify-center overflow-hidden">
                    <video
                      src={item.preview}
                      className="w-full h-full object-cover opacity-70"
                      muted
                      playsInline
                    />
                    <PlayCircle size={22} className="absolute text-white drop-shadow-md" />
                  </div>
                ) : (
                  <img
                    src={item.preview}
                    alt={item.name || 'To send'}
                    className="w-16 h-16 rounded-lg object-cover border border-gray-200"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removePending(idx)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-black"
                  data-testid={`cancel-pending-attachment-${idx}`}
                  aria-label="Remove"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={sendAttachments}
              disabled={sending}
              className="ml-1 px-4 py-2 rounded-xl bg-[#1E6A6A] text-white text-sm font-semibold disabled:opacity-40 hover:bg-[#175555] shrink-0"
              data-testid="send-pending-attachments"
            >
              {sending
                ? t('common.sending', 'Sending…')
                : pending.length === 1
                  ? t('chat.sendPhoto', 'Send')
                  : t('chat.sendAll', `Send all (${pending.length})`).replace('{count}', pending.length)}
            </button>
          </div>
        </div>
      )}
      <form onSubmit={onSend} className="p-4" data-testid="chat-form">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={pickPhoto}
            disabled={uploading || sending}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-[#1E6A6A] bg-gray-50 border border-gray-200 hover:bg-gray-100 disabled:opacity-50 transition-all shrink-0"
            title={t('chat.attachPhoto', 'Attach photos or a video')}
            data-testid="attach-photo-btn"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <Paperclip size={18} />}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={onPickFile}
            data-testid="chat-photo-input"
          />
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="text"
              value={newMessage}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onSelect={handleSelect}
              onBlur={() => {
                // Defer so a click on a popover row still registers
                setTimeout(() => setMention(null), 150);
              }}
              placeholder={t('chat.messagePlaceholder')}
              className="w-full pl-4 pr-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] focus:bg-white text-sm transition-all placeholder:text-gray-400"
              data-testid="chat-input"
              autoComplete="off"
            />

            {showPopover && (
              <div
                className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-xl border border-gray-200 shadow-2xl overflow-hidden z-50"
                data-testid="mention-popover"
              >
                <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                  <AtSign size={12} className="text-gray-400" />
                  <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
                    {t('chat.mentionHint')}
                  </span>
                </div>
                <ul role="listbox">
                  {matches.map((role, idx) => {
                    const Icon = role.icon;
                    const active = idx === hoverIdx;
                    return (
                      <li
                        key={role.key}
                        role="option"
                        aria-selected={active}
                        onMouseDown={(e) => {
                          e.preventDefault(); // keep focus on input
                          insertMention(role.key);
                        }}
                        onMouseEnter={() => setHoverIdx(idx)}
                        className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                          active ? 'bg-[#1E6A6A]/10' : 'hover:bg-gray-50'
                        }`}
                        data-testid={`mention-option-${role.key}`}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${role.color}1A` }}
                        >
                          <Icon size={14} style={{ color: role.color }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-gray-800">@{role.key}</div>
                          <div className="text-[11px] text-gray-500 truncate">
                            {t(`chat.mention${role.key.charAt(0).toUpperCase()}${role.key.slice(1)}`)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
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
  );
};

export default MessageInput;
