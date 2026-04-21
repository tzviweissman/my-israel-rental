import React, { useState, useEffect, useContext, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Send, ArrowLeft, Home, User, Building2, Clock, MessageCircle, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

const Chat = () => {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const { user, token } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [property, setProperty] = useState(null);
  const [otherUserId, setOtherUserId] = useState('');
  const [sending, setSending] = useState(false);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  useEffect(() => {
    fetchProperty();
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

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
    try {
      const response = await axios.get(`${API}/properties/${propertyId}`);
      setProperty(response.data);
      setOtherUserId(response.data.owner_id);
    } catch (error) {
      console.error('Failed to fetch property', error);
    }
  };

  const fetchMessages = async () => {
    try {
      const response = await axios.get(`${API}/chat/messages/${propertyId}`, {
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
              Back
            </button>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white/80 text-xs font-medium">Live Chat</span>
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 text-white text-sm font-medium transition-all backdrop-blur-sm"
              data-testid="return-dashboard-btn"
            >
              <Home size={14} />
              Dashboard
            </button>
          </div>

          {/* Property info bar */}
          {property && (
            <div className="flex items-center gap-3 px-5 py-3 border-b border-gray-100">
              <div className="w-11 h-11 rounded-xl bg-[#1E6A6A]/10 flex items-center justify-center shrink-0">
                <Building2 size={20} className="text-[#1E6A6A]" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm font-bold text-gray-800 truncate">{property.title}</h3>
                <p className="text-xs text-gray-500 flex items-center gap-1">
                  <span>{property.area}</span>
                  {property.monthly_price && (
                    <>
                      <span className="text-gray-300 mx-1">•</span>
                      <span className="font-medium" style={{ color: '#D4AF37' }}>
                        {property.currency === 'USD' ? '$' : '₪'}{property.monthly_price?.toLocaleString()}/mo
                      </span>
                    </>
                  )}
                </p>
              </div>
              <div className="text-right shrink-0">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-[#1E6A6A]/10 text-[#1E6A6A] uppercase tracking-wider">
                  {property.rental_type?.replace('-', ' ')}
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
                <p className="text-gray-500 font-medium text-sm">No messages yet</p>
                <p className="text-gray-400 text-xs mt-1 max-w-[260px]">
                  Start the conversation about this property. Your messages are private between you and the owner.
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
                        className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'} ${isLast ? 'mb-3' : 'mb-0.5'}`}
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

                        {/* Message bubble */}
                        <div
                          className={`max-w-[70%] px-4 py-2.5 ${
                            isMe
                              ? `bg-gradient-to-br from-[#1E6A6A] to-[#1a5e5e] text-white ${isLast ? 'rounded-2xl rounded-br-md' : 'rounded-2xl'}`
                              : `bg-white border border-gray-200 text-gray-800 shadow-sm ${isLast ? 'rounded-2xl rounded-bl-md' : 'rounded-2xl'}`
                          }`}
                        >
                          <p className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">{msg.message}</p>
                          <div className={`flex items-center gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <Clock size={10} className={isMe ? 'text-white/50' : 'text-gray-400'} />
                            <span className={`text-[10px] ${isMe ? 'text-white/50' : 'text-gray-400'}`}>
                              {formatTime(msg.created_at)}
                            </span>
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
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
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
            <p className="text-[10px] text-gray-400 text-center mt-2">
              Messages are private between you and the property owner
            </p>
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
            Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default Chat;
