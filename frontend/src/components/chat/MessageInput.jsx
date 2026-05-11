import React from 'react';
import { useTranslation } from 'react-i18next';
import { Send } from 'lucide-react';

/**
 * Sticky message input at the bottom of the chat. Owns nothing — the parent
 * holds `newMessage` because emitTyping is also wired to keystrokes.
 */
const MessageInput = ({ newMessage, setNewMessage, onSend, sending, onTyping }) => {
  const { t } = useTranslation();
  return (
    <div className="bg-white rounded-b-2xl border border-t-0 border-gray-200 shadow-sm flex-shrink-0">
      <form onSubmit={onSend} className="p-4" data-testid="chat-form">
        <div className="flex items-center gap-3">
          <div className="flex-1 relative">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => {
                setNewMessage(e.target.value);
                if (e.target.value.trim()) onTyping();
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
  );
};

export default MessageInput;
