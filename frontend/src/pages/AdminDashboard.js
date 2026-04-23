import React, { useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Users, Home, Eye, MessageCircle, FileText, Settings, Trash2, Ban, CheckCircle, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Search, X, Mail, AlertTriangle, CalendarX, CalendarCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';

const TABS = [
  { key: 'overview', label: 'Overview', icon: Eye },
  { key: 'listings', label: 'Listings', icon: Home },
  { key: 'users', label: 'Users', icon: Users },
  { key: 'chats', label: 'Chats', icon: MessageCircle },
  { key: 'services', label: 'Document Services', icon: FileText },
  { key: 'settings', label: 'Site Settings', icon: Settings },
];

const AdminDashboard = () => {
  const { token } = useContext(AuthContext);
  const [activeTab, setActiveTab] = useState('overview');
  const [dashboard, setDashboard] = useState(null);
  const [properties, setProperties] = useState([]);
  const [users, setUsers] = useState([]);
  const [chats, setChats] = useState([]);
  const [services, setServices] = useState([]);
  const [siteSettings, setSiteSettings] = useState({ whatsapp_number: '', contact_email: '', contact_phone: '', featured_property_ids: [] });
  const [expandedChat, setExpandedChat] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [emailHealth, setEmailHealth] = useState(null);
  // --- Mark-as-booked state ---
  const [selectedPropIds, setSelectedPropIds] = useState(new Set());
  const [bookedModalOpen, setBookedModalOpen] = useState(false);
  // bookedTarget: either { mode: 'single', id: '...' } or { mode: 'bulk' }
  const [bookedTarget, setBookedTarget] = useState(null);
  const [blockStart, setBlockStart] = useState('');
  const [blockEnd, setBlockEnd] = useState('');
  const [blockIndefinite, setBlockIndefinite] = useState(false);
  const [blockSaving, setBlockSaving] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchDashboard();
    fetchEmailHealth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeTab === 'listings' && properties.length === 0) fetchProperties();
    if (activeTab === 'users' && users.length === 0) fetchUsers();
    if (activeTab === 'chats' && chats.length === 0) fetchChats();
    if (activeTab === 'services' && services.length === 0) fetchServices();
    if (activeTab === 'settings') fetchSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const fetchDashboard = async () => {
    try {
      const res = await axios.get(`${API}/admin/dashboard`, { headers });
      setDashboard(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchEmailHealth = async () => {
    try {
      const res = await axios.get(`${API}/admin/email-health`, { headers });
      setEmailHealth(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchProperties = async () => {
    try {
      const res = await axios.get(`${API}/admin/properties`, { headers });
      setProperties(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API}/admin/users`, { headers });
      setUsers(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchChats = async () => {
    try {
      const res = await axios.get(`${API}/admin/chats`, { headers });
      setChats(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchServices = async () => {
    try {
      const res = await axios.get(`${API}/admin/document-services`, { headers });
      setServices(res.data);
    } catch (e) { console.error(e); }
  };

  const fetchSettings = async () => {
    try {
      const res = await axios.get(`${API}/admin/settings`, { headers });
      setSiteSettings(res.data);
    } catch (e) { console.error(e); }
  };

  const toggleUserStatus = async (userId) => {
    try {
      const res = await axios.put(`${API}/admin/users/${userId}/status`, {}, { headers });
      toast.success(res.data.message);
      fetchUsers();
      fetchDashboard();
    } catch (e) { toast.error('Failed to update user'); }
  };

  const deleteUser = (userId) => {
    toast.custom((tid) => (
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
        <p className="text-sm font-semibold text-gray-800 mb-1">Delete this user?</p>
        <p className="text-xs text-gray-500 mb-3">All of their properties will be deleted too. This cannot be undone.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(tid);
              try {
                await axios.delete(`${API}/admin/users/${userId}`, { headers });
                toast.success('User deleted');
                fetchUsers();
                fetchProperties();
                fetchDashboard();
              } catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete user'); }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600"
            data-testid={`confirm-delete-user-${userId}`}
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const togglePropertyStatus = async (propertyId) => {
    try {
      const res = await axios.put(`${API}/admin/properties/${propertyId}/status`, {}, { headers });
      toast.success(res.data.message);
      fetchProperties();
      fetchDashboard();
    } catch (e) { toast.error('Failed to update property'); }
  };

  const deleteProperty = (propertyId) => {
    toast.custom((tid) => (
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
        <p className="text-sm font-semibold text-gray-800 mb-1">Delete this listing?</p>
        <p className="text-xs text-gray-500 mb-3">Permanently removes the property. This cannot be undone.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(tid);
              try {
                await axios.delete(`${API}/properties/${propertyId}`, { headers });
                toast.success('Property deleted');
                fetchProperties();
                fetchDashboard();
              } catch (e) { toast.error('Failed to delete property'); }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600"
            data-testid={`confirm-delete-listing-${propertyId}`}
          >
            Delete
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  // --- Mark-as-booked (admin manual block) ---
  const openMarkBookedModal = (target) => {
    setBookedTarget(target);
    setBlockStart('');
    setBlockEnd('');
    setBlockIndefinite(false);
    setBookedModalOpen(true);
  };

  const closeMarkBookedModal = () => {
    setBookedModalOpen(false);
    setBookedTarget(null);
  };

  const submitMarkBooked = async () => {
    if (!bookedTarget) return;
    if (!blockIndefinite) {
      if (!blockStart || !blockEnd) {
        toast.error('Pick start & end dates, or tick "Block indefinitely".');
        return;
      }
      if (blockEnd <= blockStart) {
        toast.error('End date must be after start date.');
        return;
      }
    }
    const body = {
      start_date: blockIndefinite ? null : blockStart,
      end_date: blockIndefinite ? null : blockEnd,
      indefinite: blockIndefinite,
    };
    setBlockSaving(true);
    try {
      if (bookedTarget.mode === 'single') {
        await axios.post(`${API}/admin/properties/${bookedTarget.id}/mark-booked`, body, { headers });
        toast.success('Property marked as booked');
      } else {
        const ids = Array.from(selectedPropIds);
        if (ids.length === 0) {
          toast.error('No properties selected');
          setBlockSaving(false);
          return;
        }
        const res = await axios.post(`${API}/admin/properties/bulk-mark-booked`, { ...body, property_ids: ids }, { headers });
        toast.success(res.data.message || `${ids.length} properties marked as booked`);
        setSelectedPropIds(new Set());
      }
      closeMarkBookedModal();
      fetchProperties();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to mark as booked');
    } finally {
      setBlockSaving(false);
    }
  };

  const unmarkBooked = (property) => {
    const block = property.active_admin_block;
    if (!block) return;
    toast.custom((tid) => (
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
        <p className="text-sm font-semibold text-gray-800 mb-1">Remove admin block?</p>
        <p className="text-xs text-gray-500 mb-3">The property will become available for renters again{block.indefinite ? '' : ` during ${block.start_date?.slice(0, 10)} → ${block.end_date?.slice(0, 10)}`}.</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
            Cancel
          </button>
          <button
            onClick={async () => {
              toast.dismiss(tid);
              try {
                await axios.delete(`${API}/admin/properties/blocks/${block.id}`, { headers });
                toast.success('Admin block removed');
                fetchProperties();
              } catch (e) { toast.error('Failed to remove block'); }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-black hover:bg-gray-800"
            data-testid={`confirm-unblock-${property.id}`}
          >
            Remove block
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const togglePropSelected = (id) => {
    setSelectedPropIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const updateServiceStatus = async (serviceId, status) => {
    try {
      await axios.put(`${API}/admin/document-services/${serviceId}/status?status=${status}`, {}, { headers });
      toast.success(`Status updated to ${status}`);
      fetchServices();
      fetchDashboard();
    } catch (e) { toast.error('Failed to update status'); }
  };

  const saveSettings = async () => {
    try {
      await axios.put(`${API}/admin/settings`, siteSettings, { headers });
      toast.success('Settings saved');
    } catch (e) { toast.error('Failed to save settings'); }
  };

  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const filteredProperties = properties.filter(p =>
    !searchTerm || p.title?.toLowerCase().includes(searchTerm.toLowerCase()) || p.area?.toLowerCase().includes(searchTerm.toLowerCase()) || p.owner_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(u =>
    !searchTerm || u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#fafafa]" data-testid="admin-dashboard-page">
      <div className="max-w-7xl mx-auto px-6 pt-20 pb-8">
        <h1 className="text-4xl font-bold mb-8" style={{ fontFamily: 'Playfair Display' }} data-testid="admin-title">Super Admin Dashboard</h1>

        {/* Tab Navigation */}
        <div className="flex flex-wrap gap-2 mb-8 border-b border-[#E5E5E5] pb-4" data-testid="admin-tabs">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setSearchTerm(''); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key ? 'bg-black text-[#D4AF37]' : 'bg-white text-gray-700 border border-[#E5E5E5] hover:bg-gray-50'}`}
                data-testid={`admin-tab-${tab.key}`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div data-testid="admin-overview-section">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-10">
              {[
                { label: 'Active Listings', value: dashboard.active_listings, icon: Home },
                { label: 'Total Views', value: dashboard.total_views, icon: Eye },
                { label: 'Inquiries', value: dashboard.total_inquiries, icon: FileText },
                { label: 'Total Users', value: dashboard.total_users, icon: Users },
                { label: 'Pending Services', value: dashboard.pending_services || 0, icon: MessageCircle },
              ].map(stat => {
                const Icon = stat.icon;
                return (
                  <div key={stat.label} className="bg-white p-5 rounded-xl border border-[#E5E5E5]" data-testid={`stat-${stat.label.toLowerCase().replace(/\s/g, '-')}`}>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg" style={{ backgroundColor: '#1E6A6A' }}>
                        <Icon size={18} color="#D4AF37" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold">{stat.value}</p>
                        <p className="text-xs text-gray-500">{stat.label}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <h2 className="text-xl font-bold mb-4" style={{ fontFamily: 'Playfair Display' }}>Recent Listings</h2>
            <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Title</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Area</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Price</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recent_properties.map(p => (
                    <tr key={p.id} className="border-t border-[#E5E5E5] hover:bg-gray-50" data-testid={`overview-property-${p.id}`}>
                      <td className="px-5 py-3 font-medium text-sm">{p.title}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{p.area}</td>
                      <td className="px-5 py-3"><span className="px-2 py-1 rounded-full text-xs bg-[#E5E5E5]">{p.rental_type}</span></td>
                      <td className="px-5 py-3 font-bold text-sm">{p.currency === 'USD' ? '$' : '₪'}{p.monthly_price || p.nightly_price || 0}</td>
                      <td className="px-5 py-3 text-sm">{p.views || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Email Deliverability Health */}
            {emailHealth && (
              <div className="mt-10" data-testid="admin-email-health">
                <div className="flex items-center gap-2 mb-4">
                  <Mail size={18} className="text-[#1E6A6A]" />
                  <h2 className="text-xl font-bold" style={{ fontFamily: 'Playfair Display' }}>
                    Email Deliverability <span className="text-sm font-normal text-gray-500">(last {emailHealth.window_days} days)</span>
                  </h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]" data-testid="email-delivered">
                    <div className="flex items-center gap-2 mb-1">
                      <CheckCircle size={14} className="text-green-600" />
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Delivered</span>
                    </div>
                    <p className="text-2xl font-bold">{emailHealth.delivered}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]" data-testid="email-bounced">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle size={14} className="text-amber-600" />
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Bounced</span>
                    </div>
                    <p className="text-2xl font-bold">{emailHealth.bounced}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]" data-testid="email-complained">
                    <div className="flex items-center gap-2 mb-1">
                      <Ban size={14} className="text-red-600" />
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Spam complaints</span>
                    </div>
                    <p className="text-2xl font-bold">{emailHealth.complained}</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl border border-[#E5E5E5]" data-testid="email-delivery-rate">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-gray-500 uppercase tracking-wide">Delivery rate</span>
                    </div>
                    <p className="text-2xl font-bold">
                      {emailHealth.delivery_rate_pct !== null ? `${emailHealth.delivery_rate_pct}%` : '—'}
                    </p>
                    {emailHealth.suppressed_users > 0 && (
                      <p className="text-xs text-red-500 mt-1">{emailHealth.suppressed_users} user(s) suppressed</p>
                    )}
                  </div>
                </div>

                {emailHealth.recent_events?.length > 0 && (
                  <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
                    <div className="px-5 py-3 border-b border-[#E5E5E5] bg-gray-50">
                      <p className="text-xs font-semibold text-gray-600 uppercase">Recent events</p>
                    </div>
                    <div className="divide-y divide-[#E5E5E5] max-h-80 overflow-y-auto">
                      {emailHealth.recent_events.slice(0, 15).map(ev => {
                        const badgeColor =
                          ev.record_type === 'Delivery' ? 'bg-green-100 text-green-700' :
                          ev.record_type === 'Bounce' ? 'bg-amber-100 text-amber-700' :
                          ev.record_type === 'SpamComplaint' ? 'bg-red-100 text-red-700' :
                          'bg-gray-100 text-gray-700';
                        return (
                          <div key={ev.id} className="px-5 py-3 flex items-center justify-between gap-3 text-sm" data-testid={`email-event-${ev.id}`}>
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badgeColor}`}>
                                {ev.record_type}{ev.bounce_type ? ` · ${ev.bounce_type}` : ''}
                              </span>
                              <span className="truncate text-gray-700">{ev.email || '—'}</span>
                              {ev.tag && <span className="text-xs text-gray-400 shrink-0">#{ev.tag}</span>}
                            </div>
                            <span className="text-xs text-gray-400 shrink-0">
                              {new Date(ev.received_at).toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* LISTINGS TAB */}
        {activeTab === 'listings' && (
          <div data-testid="admin-listings-section">
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search listings by title, area, or owner..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  data-testid="listings-search-input"
                />
              </div>
              <span className="text-sm text-gray-500">{filteredProperties.length} listings</span>
              {selectedPropIds.size > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <span className="text-xs font-medium text-gray-700" data-testid="selected-count">{selectedPropIds.size} selected</span>
                  <button
                    onClick={() => openMarkBookedModal({ mode: 'bulk' })}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black text-white text-xs font-semibold hover:bg-gray-800"
                    data-testid="bulk-mark-booked-btn"
                  >
                    <CalendarX size={14} /> Mark selected as booked
                  </button>
                  <button
                    onClick={() => setSelectedPropIds(new Set())}
                    className="px-2 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
                    data-testid="clear-selection-btn"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 w-8">
                      <input
                        type="checkbox"
                        checked={filteredProperties.length > 0 && filteredProperties.every(p => selectedPropIds.has(p.id))}
                        onChange={e => {
                          if (e.target.checked) {
                            setSelectedPropIds(new Set(filteredProperties.map(p => p.id)));
                          } else {
                            setSelectedPropIds(new Set());
                          }
                        }}
                        data-testid="select-all-listings"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Title</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Area</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Price</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProperties.map(p => (
                    <tr key={p.id} className="border-t border-[#E5E5E5] hover:bg-gray-50" data-testid={`listing-row-${p.id}`}>
                      <td className="px-3 py-3">
                        <input
                          type="checkbox"
                          checked={selectedPropIds.has(p.id)}
                          onChange={() => togglePropSelected(p.id)}
                          data-testid={`select-listing-${p.id}`}
                        />
                      </td>
                      <td className="px-4 py-3 font-medium text-sm">
                        <div className="flex items-center gap-2">
                          <span>{p.title}</span>
                          {p.admin_blocked_now && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800"
                              title={p.active_admin_block?.indefinite ? 'Blocked indefinitely by admin' : `Blocked ${p.active_admin_block?.start_date?.slice(0,10)} → ${p.active_admin_block?.end_date?.slice(0,10)}`}
                              data-testid={`admin-blocked-badge-${p.id}`}
                            >
                              <Lock size={10} /> Admin blocked
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{p.owner_name}<br/><span className="text-xs text-gray-400">{p.owner_email}</span></td>
                      <td className="px-4 py-3 text-sm">{p.area}</td>
                      <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs bg-[#E5E5E5]">{p.rental_type}</span></td>
                      <td className="px-4 py-3 font-bold text-sm">{p.currency === 'USD' ? '$' : '₪'}{p.monthly_price || p.nightly_price || 0}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {p.admin_blocked_now ? (
                            <button
                              onClick={() => unmarkBooked(p)}
                              className="p-1.5 rounded hover:bg-green-50 text-green-600"
                              title="Remove admin block"
                              data-testid={`unmark-booked-${p.id}`}
                            >
                              <CalendarCheck size={18} />
                            </button>
                          ) : (
                            <button
                              onClick={() => openMarkBookedModal({ mode: 'single', id: p.id })}
                              className="p-1.5 rounded hover:bg-amber-50 text-amber-600"
                              title="Mark as booked"
                              data-testid={`mark-booked-${p.id}`}
                            >
                              <CalendarX size={18} />
                            </button>
                          )}
                          <button onClick={() => togglePropertyStatus(p.id)} className="p-1.5 rounded hover:bg-gray-100" title={p.status === 'active' ? 'Deactivate' : 'Activate'} data-testid={`toggle-property-${p.id}`}>
                            {p.status === 'active' ? <ToggleRight size={18} className="text-green-600" /> : <ToggleLeft size={18} className="text-gray-400" />}
                          </button>
                          <button onClick={() => deleteProperty(p.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete" data-testid={`delete-property-${p.id}`}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredProperties.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No listings found</p>}
            </div>
          </div>
        )}

        {/* USERS TAB */}
        {activeTab === 'users' && (
          <div data-testid="admin-users-section">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative flex-1 max-w-md">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search users by name or email..."
                  className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                  data-testid="users-search-input"
                />
              </div>
              <span className="text-sm text-gray-500">{filteredUsers.length} users</span>
            </div>
            <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Name</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Email</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Role</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Joined</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map(u => (
                    <tr key={u.id} className="border-t border-[#E5E5E5] hover:bg-gray-50" data-testid={`user-row-${u.id}`}>
                      <td className="px-5 py-3 font-medium text-sm">{u.name}</td>
                      <td className="px-5 py-3 text-sm text-gray-600">{u.email}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${u.role === 'admin' ? 'bg-yellow-100 text-yellow-800' : u.role === 'owner' || u.role === 'manager' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${(u.status || 'active') === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {u.status || 'active'}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-sm text-gray-500">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                      <td className="px-5 py-3">
                        {u.role !== 'admin' && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => toggleUserStatus(u.id)} className="p-1.5 rounded hover:bg-gray-100" title={(u.status || 'active') === 'active' ? 'Block' : 'Unblock'} data-testid={`toggle-user-${u.id}`}>
                              {(u.status || 'active') === 'active' ? <Ban size={16} className="text-orange-500" /> : <CheckCircle size={16} className="text-green-500" />}
                            </button>
                            <button onClick={() => deleteUser(u.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Delete" data-testid={`delete-user-${u.id}`}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        )}
                        {u.role === 'admin' && <span className="text-xs text-gray-400">Protected</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredUsers.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No users found</p>}
            </div>
          </div>
        )}

        {/* CHATS TAB */}
        {activeTab === 'chats' && (
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
        )}

        {/* DOCUMENT SERVICES TAB */}
        {activeTab === 'services' && (
          <div data-testid="admin-services-section">
            <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Service</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Requested By</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Address</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Tenant</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Date</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {services.map(svc => (
                    <tr key={svc.id} className="border-t border-[#E5E5E5] hover:bg-gray-50" data-testid={`service-row-${svc.id}`}>
                      <td className="px-5 py-3 font-medium text-sm capitalize">{svc.service_type?.replace(/_/g, ' ')}</td>
                      <td className="px-5 py-3 text-sm">{svc.user_name}<br/><span className="text-xs text-gray-400">{svc.user_email}</span></td>
                      <td className="px-5 py-3 text-sm">{svc.property_address}</td>
                      <td className="px-5 py-3 text-sm">{svc.tenant_name}</td>
                      <td className="px-5 py-3 text-sm text-gray-500">{svc.created_at ? new Date(svc.created_at).toLocaleDateString() : '-'}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${svc.status === 'completed' ? 'bg-green-100 text-green-700' : svc.status === 'in_progress' ? 'bg-blue-100 text-blue-700' : svc.status === 'rejected' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {svc.status?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <select
                          value={svc.status}
                          onChange={e => updateServiceStatus(svc.id, e.target.value)}
                          className="text-xs px-2 py-1 rounded border border-[#E5E5E5] focus:outline-none"
                          data-testid={`service-status-${svc.id}`}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                          <option value="rejected">Rejected</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {services.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">No document service requests</p>}
            </div>
          </div>
        )}

        {/* SITE SETTINGS TAB */}
        {activeTab === 'settings' && (
          <div data-testid="admin-settings-section">
            <div className="bg-white rounded-xl border border-[#E5E5E5] p-6 max-w-2xl">
              <h2 className="text-xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>Site Settings</h2>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1">WhatsApp Number</label>
                  <input
                    type="text"
                    value={siteSettings.whatsapp_number || ''}
                    onChange={e => setSiteSettings({ ...siteSettings, whatsapp_number: e.target.value })}
                    placeholder="+972-XX-XXX-XXXX"
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    data-testid="settings-whatsapp"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Email</label>
                  <input
                    type="email"
                    value={siteSettings.contact_email || ''}
                    onChange={e => setSiteSettings({ ...siteSettings, contact_email: e.target.value })}
                    placeholder="contact@myisraelrental.com"
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    data-testid="settings-email"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Contact Phone</label>
                  <input
                    type="text"
                    value={siteSettings.contact_phone || ''}
                    onChange={e => setSiteSettings({ ...siteSettings, contact_phone: e.target.value })}
                    placeholder="+972-XX-XXX-XXXX"
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    data-testid="settings-phone"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Featured Property IDs</label>
                  <p className="text-xs text-gray-500 mb-2">Comma-separated property IDs to feature on the homepage</p>
                  <input
                    type="text"
                    value={(siteSettings.featured_property_ids || []).join(', ')}
                    onChange={e => setSiteSettings({ ...siteSettings, featured_property_ids: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                    placeholder="property-id-1, property-id-2"
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
                    data-testid="settings-featured"
                  />
                </div>
                <button onClick={saveSettings} className="primary-btn" data-testid="save-settings-button">
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mark as Booked modal */}
      {bookedModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          data-testid="mark-booked-modal"
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
            <button
              onClick={closeMarkBookedModal}
              className="absolute top-3 right-3 p-1 rounded-lg hover:bg-gray-100"
              data-testid="close-mark-booked-modal"
            >
              <X size={18} />
            </button>
            <div className="flex items-center gap-2 mb-1">
              <CalendarX size={20} className="text-amber-600" />
              <h2 className="text-lg font-bold">Mark as booked</h2>
            </div>
            <p className="text-xs text-gray-500 mb-5">
              {bookedTarget?.mode === 'bulk'
                ? `Block ${selectedPropIds.size} selected propert${selectedPropIds.size === 1 ? 'y' : 'ies'} from appearing in renter date searches.`
                : 'Block this property from appearing in renter date searches. Existing bookings are kept unchanged.'}
            </p>

            <label className="flex items-center gap-2 mb-4 cursor-pointer">
              <input
                type="checkbox"
                checked={blockIndefinite}
                onChange={e => setBlockIndefinite(e.target.checked)}
                data-testid="block-indefinite-checkbox"
              />
              <span className="text-sm font-medium">Block indefinitely (until removed)</span>
            </label>

            <div className={`grid grid-cols-2 gap-3 mb-5 ${blockIndefinite ? 'opacity-40' : ''}`}>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Start date</label>
                <input
                  type="date"
                  value={blockStart}
                  onChange={e => setBlockStart(e.target.value)}
                  disabled={blockIndefinite}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20 disabled:cursor-not-allowed"
                  data-testid="block-start-date"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">End date</label>
                <input
                  type="date"
                  value={blockEnd}
                  onChange={e => setBlockEnd(e.target.value)}
                  disabled={blockIndefinite}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20 disabled:cursor-not-allowed"
                  data-testid="block-end-date"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={closeMarkBookedModal}
                className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                data-testid="cancel-mark-booked-btn"
              >
                Cancel
              </button>
              <button
                onClick={submitMarkBooked}
                disabled={blockSaving}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white bg-black hover:bg-gray-800 disabled:opacity-50"
                data-testid="confirm-mark-booked-btn"
              >
                {blockSaving ? 'Saving…' : 'Mark as booked'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
