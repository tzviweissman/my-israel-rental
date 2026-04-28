import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Plus, Edit, Trash2, Eye, MessageCircle, Upload, X, Image, Film, CalendarSync, Link2, Copy, Check, RefreshCw, FileText, KeyRound, EyeOff, Home, FileCheck, Sparkles, ClipboardList, ArrowRight, Send, Heart, MapPin, Bed, Bath, Loader2, Calendar, Filter, Move, Maximize2, Bell, Layers } from 'lucide-react';
import { toast } from 'sonner';
import ContractManager from '../components/ContractManager';
import { Calendar as CalendarComponent } from '../components/ui/calendar';
import { format } from 'date-fns';
import { Rnd } from 'react-rnd';
import BookingsList from '../components/dashboard/BookingsList';
import SettingsTab from '../components/dashboard/SettingsTab';
import SavedSearchesTab from '../components/dashboard/SavedSearchesTab';
import LikedTab from '../components/dashboard/LikedTab';
import SubleasesTab from '../components/dashboard/SubleasesTab';
import GovernmentServicesTab from '../components/dashboard/GovernmentServicesTab';
import PropertyList from '../components/dashboard/PropertyList';
import AddPropertyModal from '../components/dashboard/AddPropertyModal';
import BulkUploadModal from '../components/dashboard/BulkUploadModal';
import BulkManagerTab from '../components/dashboard/BulkManagerTab';

// Parse a 'YYYY-MM-DD' string as a LOCAL date. `new Date('2026-06-02')` parses
// as UTC midnight, which shifts back a day when rendered in timezones east of
// UTC (e.g. Israel). Use this helper whenever we display or pre-select a
// date-only string from the backend.
const parseLocalDate = (dateStr) => {
  if (!dateStr) return undefined;
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

const Dashboard = () => {
  const { t } = useTranslation();
  const { user, token } = useContext(AuthContext);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [properties, setProperties] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [editingProperty, setEditingProperty] = useState(null);
  const [businessLogo, setBusinessLogo] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('properties');

  // Cancellation modal states
  const [cancelModal, setCancelModal] = useState({ show: false, bookingId: null, type: '' });
  const [cancelReason, setCancelReason] = useState('');
  const [customCancelReason, setCustomCancelReason] = useState('');
  const [processingCancel, setProcessingCancel] = useState(false);
  // Accept booking confirmation modal
  const [acceptModal, setAcceptModal] = useState({ show: false, bookingId: null });
  // Contract signing modal for renters
  const [showContractSignModal, setShowContractSignModal] = useState(false);
  const [contractBookingId, setContractBookingId] = useState(null);
  const [signatureData, setSignatureData] = useState('');
  const [signatureMethod, setSignatureMethod] = useState('draw');
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [contractPreviewUrl, setContractPreviewUrl] = useState('');
  const [signaturePosition, setSignaturePosition] = useState({ x: 50, y: 100 });
  const [signatureSize, setSignatureSize] = useState({ width: 200, height: 100 });
  const [showContractPreview, setShowContractPreview] = useState(false);
  // Bookings filter state
  const [bookingsFilter, setBookingsFilter] = useState('');


  useEffect(() => {
    if (user) {
      fetchProperties();
      fetchBookings();
      fetchBusinessLogo();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Intentional: fetchers only need to re-run when user identity changes
  
  // Handle tab query parameter from notifications
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  // Refetch bookings whenever the user lands on / re-enters the Bookings tab,
  // and whenever a notification deep-links here with a `highlight=` param.
  // The notification feed updates instantly via SSE, but the bookings list
  // is fetched on mount only — without this hook the booking that just
  // triggered the notification wouldn't appear when the user clicks through.
  const highlightBookingId = searchParams.get('highlight');
  useEffect(() => {
    if (!user) return;
    if (activeTab === 'bookings') {
      fetchBookings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, highlightBookingId, user]);

  // Same idea for the Properties + Bulk-Manager tabs: keep them live whenever
  // the user re-enters either view, so admin/manager edits made elsewhere
  // (mark-as-booked, bulk-edit, photo top-up) appear without a hard reload.
  // Also pulls fresh data when a deep-link notification flips the tab.
  useEffect(() => {
    if (!user) return;
    if (activeTab === 'properties' || activeTab === 'bulk-manager') {
      fetchProperties();
      // Bookings drives the "Booked" / "Currently Booked" bubble counts on
      // PropertyList, so refresh both together.
      fetchBookings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, user]);

  // Refetch when the user returns to the tab (visibilitychange) — covers the
  // "edited on another browser tab / phone, came back to this one" case.
  useEffect(() => {
    if (!user) return;
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        fetchProperties();
        fetchBookings();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const fetchBusinessLogo = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.business_logo) {
        setBusinessLogo(response.data.business_logo);
      }
    } catch (error) {
      console.error('Failed to fetch user data', error);
    }
  };

  const fetchProperties = async () => {
    try {
      const response = await axios.get(`${API}/properties?owner_id=${user.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProperties(response.data);
    } catch (error) {
      console.error('Failed to fetch properties', error);
    }
  };

  const fetchBookings = async () => {
    try {
      const response = await axios.get(`${API}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings', error);
    }
  };

  // Cancellation functions
  const handleCancelBooking = async (bookingId) => {
    setCancelModal({ show: true, bookingId, type: 'cancel' });
  };

  const handleRequestCancel = async (bookingId) => {
    setCancelModal({ show: true, bookingId, type: 'request' });
  };

  const handleAcceptBooking = async (bookingId) => {
    // Show custom modal instead of window.confirm (which is blocked in preview)
    setAcceptModal({ show: true, bookingId });
  };

  const confirmAcceptBooking = async () => {
    const bookingId = acceptModal.bookingId;
    setAcceptModal({ show: false, bookingId: null });
    
    try {
      await axios.post(`${API}/bookings/${bookingId}/accept`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Booking accepted successfully!');
      await fetchBookings();
    } catch (error) {
      console.error('Accept booking error:', error);
      toast.error(error.response?.data?.detail || 'Failed to accept booking');
    }
  };

  // Contract signing functions
  const openContractSignModal = async (bookingId) => {
    setContractBookingId(bookingId);
    setShowContractSignModal(true);
    setSignatureData('');
    setSignatureMethod('draw');
    setShowContractPreview(false);
    setSignaturePosition({ x: 50, y: 100 });
    setSignatureSize({ width: 200, height: 100 });
    
    // Fetch the booking to get property contract
    try {
      const booking = bookings.find(b => b.id === bookingId);
      if (booking) {
        const propertyRes = await axios.get(`${API}/properties/${booking.property_id}/contract`);
        if (propertyRes.data.has_contract && propertyRes.data.contract_url) {
          const fullContractUrl = `${API.replace('/api', '')}${propertyRes.data.contract_url}`;
          setContractPreviewUrl(fullContractUrl);
        }
      }
    } catch (error) {
      console.error('Failed to fetch contract:', error);
    }
  };

  const startDrawing = (e) => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext('2d');
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
      setSignatureData(canvasRef.current.toDataURL());
    }
  };

  const clearSignature = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setSignatureData('');
  };

  const handleSignatureUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignatureData(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const submitContractSignature = async () => {
    if (!signatureData) {
      toast.error('Please provide a signature');
      return;
    }

    try {
      await axios.post(`${API}/bookings/${contractBookingId}/sign-contract`, {
        signature_data: signatureData,
        signature_x: signaturePosition.x,
        signature_y: signaturePosition.y,
        signature_width: signatureSize.width,
        signature_height: signatureSize.height
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Contract signed successfully!');
      setShowContractSignModal(false);
      setShowContractPreview(false);
      setContractBookingId(null);
      setSignatureData('');
      await fetchBookings();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to sign contract');
    }
  };

  const handleDenyCancel = async (bookingId) => {
    setCancelModal({ show: true, bookingId, type: 'deny' });
  };

  const submitCancellation = async () => {
    // For request type, check if reason is selected
    if (cancelModal.type === 'request' && !cancelReason) {
      toast.error('Please select a cancellation reason');
      return;
    }
    
    // If "Other" is selected, require custom reason
    if (cancelModal.type === 'request' && cancelReason === 'Other' && !customCancelReason.trim()) {
      toast.error('Please provide a detailed reason');
      return;
    }
    
    // For other types, require text reason
    if (cancelModal.type !== 'request' && !cancelReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    
    setProcessingCancel(true);
    try {
      const { bookingId, type } = cancelModal;
      // Use custom reason if "Other" selected, otherwise use dropdown value
      const finalReason = cancelReason === 'Other' ? customCancelReason : cancelReason;
      
      if (type === 'cancel') {
        await axios.post(`${API}/bookings/${bookingId}/cancel`, { reason: finalReason }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Booking cancelled');
      } else if (type === 'request') {
        await axios.post(`${API}/bookings/${bookingId}/request-cancel`, { reason: finalReason }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Cancellation request submitted');
      } else if (type === 'deny') {
        await axios.post(`${API}/bookings/${bookingId}/deny-cancel`, { denial_reason: finalReason }, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Cancellation request denied');
      }
      setCancelModal({ show: false, bookingId: null, type: '' });
      setCancelReason('');
      setCustomCancelReason('');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to process cancellation');
    } finally {
      setProcessingCancel(false);
    }
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`${API}/user/logo`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setBusinessLogo(response.data.logo_url);
      toast.success('Business logo uploaded!');
    } catch (error) {
      toast.error('Failed to upload logo');
    }
    setLogoUploading(false);
  };

  const handleLogoRemove = async () => {
    try {
      await axios.delete(`${API}/user/logo`, { headers: { Authorization: `Bearer ${token}` } });
      setBusinessLogo(null);
      toast.success('Logo removed');
    } catch (error) {
      toast.error('Failed to remove logo');
    }
  };

  const getShareableLink = () => `${window.location.origin}/manager/${user.id}`;

  const copyShareableLink = async () => {
    const link = getShareableLink();
    try {
      await navigator.clipboard.writeText(link);
      toast.success('Link copied to clipboard!');
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = link;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      toast.success('Link copied to clipboard!');
    }
  };



  return (
    <div className="min-h-screen" data-testid="dashboard-page">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'Playfair Display' }}>Dashboard</h1>
          {user && user.role !== 'renter' && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowBulkUpload(true)}
                className="secondary-btn flex items-center gap-2"
                data-testid="bulk-upload-button"
              >
                <Upload size={18} />
                Bulk Upload
              </button>
              <button onClick={() => { setEditingProperty(null); setShowAddProperty(true); }} className="primary-btn flex items-center gap-2" data-testid="add-property-button">
                <Plus size={20} />
                {t('dashboard.addProperty')}
              </button>
            </div>
          )}
          {user && user.role === 'renter' && (
            <button onClick={() => { setActiveTab('subleases'); }} className="primary-btn flex items-center gap-2" data-testid="sublease-property-button">
              <Home size={20} />
              Sublease Property
            </button>
          )}
        </div>

        {user && user.role !== 'renter' && (
          <div className="bg-white p-6 rounded-2xl border border-[#E5E5E5] mb-8" data-testid="manager-page-section">
            <h2 className="text-xl font-bold mb-4">Your Manager Page</h2>
            
            {/* Business Logo Upload */}
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Business Logo</label>
              <div className="flex items-center gap-4">
                {businessLogo ? (
                  <div className="relative">
                    <img
                      src={businessLogo.startsWith('/api') ? `${API.replace('/api', '')}${businessLogo}` : businessLogo}
                      alt="Business Logo"
                      className="w-20 h-20 rounded-xl object-cover border-2 border-[#D4AF37]"
                      data-testid="business-logo-preview"
                    />
                    <button
                      onClick={handleLogoRemove}
                      className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600"
                      data-testid="remove-logo-button"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="w-20 h-20 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400">
                    <Image size={24} />
                  </div>
                )}
                <div>
                  <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ backgroundColor: '#1E6A6A', color: '#D4AF37' }} data-testid="upload-logo-button">
                    <Upload size={16} />
                    {logoUploading ? 'Uploading...' : businessLogo ? 'Change Logo' : 'Upload Logo'}
                    <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" disabled={logoUploading} />
                  </label>
                  <p className="text-xs text-gray-500 mt-1">Appears on your public manager page</p>
                </div>
              </div>
            </div>

            <p className="text-gray-600 mb-4">Share this link with potential renters to show all your properties:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={getShareableLink()}
                readOnly
                className="flex-1 px-4 py-2 rounded-lg border border-[#E5E5E5] bg-gray-50"
                data-testid="shareable-link"
              />
              <button onClick={copyShareableLink} className="secondary-btn" data-testid="copy-link-button">
                Copy Link
              </button>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="relative">
          {/* Scroll indicator - left fade */}
          <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-gray-100 to-transparent pointer-events-none z-10 md:hidden"></div>
          {/* Scroll indicator - right fade */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-gray-100 to-transparent pointer-events-none z-10 md:hidden"></div>
          
          <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 overflow-x-auto scrollbar-hide" data-testid="dashboard-tabs">
            <button
              onClick={() => setActiveTab('properties')}
              className={`flex-shrink-0 py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'properties' ? 'bg-white text-[#1E6A6A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              data-testid="tab-properties"
            >
              {t('dashboard.myProperties')}
            </button>
            {user && user.role !== 'renter' && (
              <button
                onClick={() => setActiveTab('bulk-manager')}
                className={`flex-shrink-0 py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'bulk-manager' ? 'bg-white text-[#1E6A6A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                data-testid="tab-bulk-manager"
              >
                <Layers size={14} />
                Bulk Manager
              </button>
            )}
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex-shrink-0 py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'bookings' ? 'bg-white text-[#1E6A6A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              data-testid="tab-bookings"
            >
              {t('dashboard.myBookings')}
            </button>
            {user && user.role !== 'renter' && false && (
              <button
                onClick={() => setActiveTab('contracts')}
                className={`flex-shrink-0 py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'contracts' ? 'bg-white text-[#1E6A6A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                data-testid="tab-contracts"
              >
                <FileText size={14} />
                Contracts
              </button>
            )}
            {user && user.role === 'renter' && (
              <button
                onClick={() => { setActiveTab('subleases'); }}
                className={`flex-shrink-0 py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'subleases' ? 'bg-white text-[#1E6A6A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                data-testid="tab-subleases"
              >
                <Home size={14} />
                Subleases
              </button>
            )}
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-shrink-0 py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'settings' ? 'bg-white text-[#1E6A6A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              data-testid="tab-settings"
            >
              <KeyRound size={14} />
              Settings
            </button>
            {user && user.role === 'renter' && (
              <button
                onClick={() => { setActiveTab('services'); }}
                className={`flex-shrink-0 py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'services' ? 'bg-white text-[#D4AF37] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                data-testid="tab-services"
              >
                <Sparkles size={14} />
                Services
              </button>
            )}
            {user && user.role === 'renter' && (
              <button
                onClick={() => { setActiveTab('alerts'); }}
                className={`flex-shrink-0 py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'alerts' ? 'bg-white text-[#D4AF37] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                data-testid="tab-alerts"
              >
                <Bell size={14} />
                Alerts
              </button>
            )}
            <button
              onClick={() => { setActiveTab('liked'); }}
              className={`flex-shrink-0 py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all flex items-center justify-center gap-1.5 whitespace-nowrap ${activeTab === 'liked' ? 'bg-white text-red-500 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              data-testid="tab-liked"
            >
              <Heart size={14} />
              Liked
            </button>
          </div>
        </div>

        {/* Contracts Tab */}
        {activeTab === 'contracts' && user && user.role !== 'renter' && (
          <ContractManager properties={properties} />
        )}

        {/* Settings Tab */}
        {activeTab === 'settings' && (
          <SettingsTab 
            user={user}
            token={token}
            API={API}
          />
        )}


        {/* Alerts (Saved Searches) Tab */}
        {activeTab === 'alerts' && user && user.role === 'renter' && (
          <SavedSearchesTab API={API} token={token} />
        )}


        {/* Liked Properties Tab */}
        {activeTab === 'liked' && (
          <LikedTab API={API} token={token} />
        )}

        {/* My Subleases Tab */}
        {activeTab === 'subleases' && user && user.role === 'renter' && (
          <SubleasesTab API={API} token={token} />
        )}

        {/* Services Tab */}
        {activeTab === 'services' && user && user.role === 'renter' && (
          <GovernmentServicesTab API={API} token={token} />
        )}

        {activeTab === 'properties' && user && user.role !== 'renter' && (
          <>
            <AddPropertyModal
              isOpen={showAddProperty}
              onClose={() => { setShowAddProperty(false); setEditingProperty(null); }}
              editingProperty={editingProperty}
              onSaved={fetchProperties}
              API={API}
              token={token}
            />
            <BulkUploadModal
              isOpen={showBulkUpload}
              onClose={() => setShowBulkUpload(false)}
              onDone={fetchProperties}
              API={API}
              token={token}
            />
            <PropertyList
              properties={properties}
              bookings={bookings}
              onEdit={(p) => { setEditingProperty(p); setShowAddProperty(true); }}
              onRefresh={fetchProperties}
              API={API}
              token={token}
            />
          </>
        )}

        {activeTab === 'bulk-manager' && user && user.role !== 'renter' && (
          <BulkManagerTab
            properties={properties}
            onRefresh={fetchProperties}
            API={API}
            token={token}
          />
        )}

        {activeTab === 'bookings' && (
          <BookingsList 
            bookings={bookings}
            onUpdate={fetchBookings}
            user={user}
            token={token}
            API={API}
          />
        )}

      </div>
    </div>
  );
};

export default Dashboard;