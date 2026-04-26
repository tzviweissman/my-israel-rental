import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { ChevronDown, ChevronUp, MessageCircle } from 'lucide-react';
import { API } from '../../App';

/**
 * Super Admin → Chats tab.
 * Read-only conversation explorer. Owns its own fetch and expand/collapse state.
 */
export const ChatsTab = ({ token }) => {
  const headers = { Authorization: `Bearer ${token}` };

  const [chats, setChats] = useState([]);
  const [expandedChat, setExpandedChat] = useState(null);

  const fetchChats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/chats`, { headers });
      setChats(res.data);
    } catch (e) { console.error(e); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => { fetchChats(); }, [fetchChats]);

  return (
    <div data-testid="admin-chats-section">
      {chats.length === 0 && <p className="text-center text-gray-400 py-12 text-sm">No conversations yet</p>}
      <div className="space-y-3">
        {chats.map((conv, idx) => (
          <div key={conv.property_id || conv.property_title || idx} className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden" data-testid={`chat-conv-${idx}`}>
            <button
              onClick={() => setExpandedChat(expandedChat === idx ? null : idx)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              data-testid={`chat-toggle-${idx}`}
            >
              <div className="flex items-center gap-4 text-left">
                <div className="p-2 rounded-lg" style={{ backgroundColor: '#1E6A6A' }}>
                  <MessageCircle size={16} color="#D4AF37" />
                </div>
                <div>
                  <p className="font-medium text-sm">{conv.property_title}</p>
                  <p className="text-xs text-gray-500">
                    {conv.participants?.map(p => `${p.name} (${p.role})`).join(' & ')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-400">{conv.messages?.length || 0} messages</span>
                {expandedChat === idx ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>
            {expandedChat === idx && (
              <div className="border-t border-[#E5E5E5] px-5 py-4 max-h-80 overflow-y-auto bg-gray-50">
                {conv.messages?.map((msg, mIdx) => {
                  const sender = conv.participants?.find(p => p.id === msg.sender_id);
                  return (
                    <div key={mIdx} className="mb-3" data-testid={`chat-message-${idx}-${mIdx}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold">{sender?.name || 'Unknown'}</span>
                        <span className="text-xs text-gray-400">{new Date(msg.created_at).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-700 bg-white rounded-lg px-3 py-2 border border-[#E5E5E5] inline-block">{msg.message}</p>
                    </div>
                  );
                })}
                {(!conv.messages || conv.messages.length === 0) && <p className="text-sm text-gray-400">No messages</p>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChatsTab;
