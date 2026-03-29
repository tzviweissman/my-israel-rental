import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Users, Home, Eye, MessageCircle, FileText } from 'lucide-react';

const AdminDashboard = () => {
  const { token } = useContext(AuthContext);
  const [dashboard, setDashboard] = useState(null);
  const [allChats, setAllChats] = useState([]);

  useEffect(() => {
    fetchDashboard();
    fetchAllChats();
  }, []);

  const fetchDashboard = async () => {
    try {
      const response = await axios.get(`${API}/admin/dashboard`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboard(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard', error);
    }
  };

  const fetchAllChats = async () => {
    try {
      const response = await axios.get(`${API}/admin/chats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllChats(response.data);
    } catch (error) {
      console.error('Failed to fetch chats', error);
    }
  };

  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-xl">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen" data-testid="admin-dashboard-page">
      <div className="max-w-7xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold mb-12" style={{ fontFamily: 'Playfair Display' }}>Admin Dashboard</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5]" data-testid="stat-active-listings">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#E5E5E5' }}>
                <Home size={24} style={{ color: '#000000' }} />
              </div>
              <div>
                <p className="text-3xl font-bold">{dashboard.active_listings}</p>
                <p className="text-sm text-gray-600">Active Listings</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5]" data-testid="stat-total-views">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#E5E5E5' }}>
                <Eye size={24} style={{ color: '#000000' }} />
              </div>
              <div>
                <p className="text-3xl font-bold">{dashboard.total_views}</p>
                <p className="text-sm text-gray-600">Total Views</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5]" data-testid="stat-total-inquiries">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#E5E5E5' }}>
                <FileText size={24} style={{ color: '#000000' }} />
              </div>
              <div>
                <p className="text-3xl font-bold">{dashboard.total_inquiries}</p>
                <p className="text-sm text-gray-600">Inquiries</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5]" data-testid="stat-total-users">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#E5E5E5' }}>
                <Users size={24} style={{ color: '#000000' }} />
              </div>
              <div>
                <p className="text-3xl font-bold">{dashboard.total_users}</p>
                <p className="text-sm text-gray-600">Total Users</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>Recent Properties</h2>
          <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Title</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Area</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Type</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Price</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Views</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.recent_properties.map((property) => (
                  <tr key={property.id} className="border-t border-[#E5E5E5]" data-testid={`property-row-${property.id}`}>
                    <td className="px-6 py-4 font-medium">{property.title}</td>
                    <td className="px-6 py-4">{property.area}</td>
                    <td className="px-6 py-4">
                      <span className="px-3 py-1 rounded-full text-sm" style={{ backgroundColor: '#E5E5E5', color: '#000000' }}>
                        {property.rental_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold" style={{ color: '#000000' }}>
                      ₪{property.monthly_price || property.nightly_price}
                    </td>
                    <td className="px-6 py-4">{property.views || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>All Chats</h2>
          <div className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Property ID</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Sender</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Receiver</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Message</th>
                  <th className="px-6 py-4 text-left text-sm font-medium text-gray-700">Time</th>
                </tr>
              </thead>
              <tbody>
                {allChats.slice(0, 20).map((chat) => (
                  <tr key={chat.id} className="border-t border-[#E5E5E5]" data-testid={`chat-row-${chat.id}`}>
                    <td className="px-6 py-4">{chat.property_id}</td>
                    <td className="px-6 py-4">{chat.sender_id}</td>
                    <td className="px-6 py-4">{chat.receiver_id}</td>
                    <td className="px-6 py-4 max-w-xs truncate">{chat.message}</td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {new Date(chat.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;