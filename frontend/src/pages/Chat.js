import React, { useState, useEffect, useContext } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Send } from 'lucide-react';
import { toast } from 'sonner';

const Chat = () => {
  const { propertyId } = useParams();
  const { user, token } = useContext(AuthContext);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [property, setProperty] = useState(null);
  const [otherUserId, setOtherUserId] = useState('');

  useEffect(() => {
    fetchProperty();
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [propertyId]);

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
    if (!newMessage.trim()) return;

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
    }
  };

  return (
    <div className="min-h-screen" data-testid="chat-page">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {property && (
          <div className="bg-white rounded-2xl p-6 border border-[#E5E5E5] mb-6">
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
              {property.title}
            </h2>
            <p className="text-gray-600">{property.area}</p>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-[#E5E5E5] flex flex-col h-[600px]">
          <div className="flex-1 overflow-y-auto p-6 space-y-4" data-testid="chat-messages">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.sender_id === user.id ? 'justify-end' : 'justify-start'}`}
                data-testid={`message-${msg.id}`}
              >
                <div
                  className={`max-w-xs px-4 py-3 rounded-2xl ${
                    msg.sender_id === user.id
                      ? 'bg-[#1E6A6A] text-white'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  <p>{msg.message}</p>
                  <p className={`text-xs mt-1 ${
                    msg.sender_id === user.id ? 'text-white/70' : 'text-gray-500'
                  }`}>
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <form onSubmit={sendMessage} className="p-6 border-t border-[#E5E5E5]" data-testid="chat-form">
            <div className="flex gap-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-3 rounded-full border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                data-testid="chat-input"
              />
              <button type="submit" className="primary-btn flex items-center gap-2" data-testid="send-message-button">
                <Send size={20} />
                Send
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;