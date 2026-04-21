import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { Plus, Edit, Trash2, Eye, MessageCircle, Upload, X, Image, Film, CalendarSync, Link2, Copy, Check, RefreshCw, FileText, KeyRound, EyeOff, Home, FileCheck, Sparkles, ClipboardList, ArrowRight, Send, Heart, MapPin, Bed, Bath, Loader2, Calendar, Filter, Move, Maximize2 } from 'lucide-react';
import { toast } from 'sonner';
import ContractManager from '../components/ContractManager';
import { Calendar as CalendarComponent } from '../components/ui/calendar';
import { format } from 'date-fns';
import { Rnd } from 'react-rnd';
import BookingsList from '../components/dashboard/BookingsList';
import SettingsTab from '../components/dashboard/SettingsTab';
import ServicesTab from '../components/dashboard/ServicesTab';

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
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [editingPropertyId, setEditingPropertyId] = useState(null);
  const [icalPanel, setIcalPanel] = useState(null);
  const [icalUrl, setIcalUrl] = useState('');
  const [icalSyncing, setIcalSyncing] = useState(false);
  const [icalData, setIcalData] = useState({});
  const [copiedExport, setCopiedExport] = useState(false);
  const [businessLogo, setBusinessLogo] = useState(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [activeTab, setActiveTab] = useState('properties');
  // Change password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  // Service request states
  const [subleaseForm, setSubleaseForm] = useState({ property_id: '', available_from: '', available_to: '', price: '', price_type: 'per_night', bedrooms_available: '', notes: '' });
  const [arnonaForm, setArnonaForm] = useState({ full_name: '', id_number: '', address: '', service_type: 'arnona_discount', notes: '' });
  const [submittingService, setSubmittingService] = useState(false);
  const [mySubleases, setMySubleases] = useState([]);
  const [loadingSubleases, setLoadingSubleases] = useState(false);
  const [showSubleaseForm, setShowSubleaseForm] = useState(false);
  const [myBookings, setMyBookings] = useState([]);
  const [uploadingContractFor, setUploadingContractFor] = useState(null);
  const [copiedSignLink, setCopiedSignLink] = useState(null);
  const subleaseFileRef = useRef(null);
  const [likedProperties, setLikedProperties] = useState([]);
  const [loadingLiked, setLoadingLiked] = useState(false);
  const [propertyForm, setPropertyForm] = useState({
    title: '',
    description: '',
    rental_type: 'long-term',
    property_type: 'apartment',
    bedrooms: 1,
    bathrooms: 1,
    area: '',
    address: '',
    square_meters: '',
    porch_square_meters: '',
    floor: 1,
    has_elevator: false,
    is_shabbat_elevator: false,
    is_tama: false,
    has_agent_fee: false,
    agent_fee_price: '',
    agent_fee_currency: 'ILS',
    porches: 0,
    sukkah_compatible: false,
    condition: 'good',
    furniture_option: 'no_furniture',
    amenities: [],
    monthly_price: '',
    nightly_price: '',
    currency: 'ILS',
    images: [],
    cancellation_policy: 'flexible',
    custom_cancellation_policy: '',
    available_from: '',
    starting_date: '',
    minimum_booking_days: ''
  });
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
  // Location search states
  const [locationSearch, setLocationSearch] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const locationDropdownRef = useRef(null);
  // Calendar states for date picker
  const [showStartingDateCalendar, setShowStartingDateCalendar] = useState(false);
  const [showAvailableFromCalendar, setShowAvailableFromCalendar] = useState(false);
  // Bookings filter state
  const [bookingsFilter, setBookingsFilter] = useState('');


  useEffect(() => {
    if (user) {
      fetchProperties();
      fetchBookings();
      fetchBusinessLogo();
      fetchLikedProperties();
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

  // Close location dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (locationDropdownRef.current && !locationDropdownRef.current.contains(event.target)) {
        setShowLocationDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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

  const fetchLikedProperties = async () => {
    setLoadingLiked(true);
    try {
      const res = await axios.get(`${API}/liked-properties`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLikedProperties(res.data);
    } catch (error) {
      console.error('Failed to fetch liked properties', error);
    } finally {
      setLoadingLiked(false);
    }
  };

  const unlikeProperty = async (propertyId) => {
    try {
      await axios.post(`${API}/properties/${propertyId}/like`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setLikedProperties(prev => prev.filter(p => p.id !== propertyId));
      toast.success('Removed from favorites');
    } catch (err) {
      toast.error('Failed to remove');
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

  const handleApproveCancel = async (bookingId) => {
    if (!window.confirm('Approve this cancellation request?')) return;
    try {
      await axios.post(`${API}/bookings/${bookingId}/approve-cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Cancellation approved');
      fetchBookings();
    } catch (error) {
      toast.error('Failed to approve cancellation');
    }
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

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    setUploadProgress(0);
    const uploaded = [];
    
    for (let i = 0; i < files.length; i++) {
      const formData = new FormData();
      formData.append('file', files[i]);
      try {
        const res = await axios.post(`${API}/upload`, formData, {
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
        });
        uploaded.push({ ...res.data, original_name: files[i].name });
      } catch (err) {
        toast.error(`Failed to upload ${files[i].name}: ${err.response?.data?.detail || 'Error'}`);
      }
      setUploadProgress(Math.round(((i + 1) / files.length) * 100));
    }

    const newImages = uploaded.filter(f => f.file_type === 'image').map(f => f.url);
    const newVideos = uploaded.filter(f => f.file_type === 'video').map(f => f.url);
    setUploadedFiles(prev => [...prev, ...uploaded]);
    setPropertyForm(prev => ({
      ...prev,
      images: [...prev.images, ...newImages],
      videos: [...(prev.videos || []), ...newVideos]
    }));
    setUploading(false);
    if (uploaded.length > 0) toast.success(`${uploaded.length} file(s) uploaded`);
  };

  const removeUploadedFile = async (fileToRemove) => {
    try {
      await axios.delete(`${API}/upload/${fileToRemove.filename}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (e) {
      console.error('Failed to delete file from server:', e);
      // Continue with local removal even if server deletion fails
    }
    setUploadedFiles(prev => prev.filter(f => f.filename !== fileToRemove.filename));
    setPropertyForm(prev => ({
      ...prev,
      images: prev.images.filter(url => url !== fileToRemove.url),
      videos: (prev.videos || []).filter(url => url !== fileToRemove.url)
    }));
  };

  const startEditProperty = (property) => {
    setPropertyForm({
      title: property.title || '',
      description: property.description || '',
      rental_type: property.rental_type || 'long-term',
      property_type: property.property_type || 'apartment',
      bedrooms: property.bedrooms || 1,
      bathrooms: property.bathrooms || 1,
      area: property.area || '',
      address: property.address || '',
      square_meters: property.square_meters || '',
      porch_square_meters: property.porch_square_meters || '',
      floor: property.floor || 1,
      has_elevator: property.has_elevator || false,
      is_shabbat_elevator: property.is_shabbat_elevator || false,
      is_tama: property.is_tama || false,
      has_agent_fee: property.has_agent_fee || false,
      agent_fee_price: property.agent_fee_price || '',
      agent_fee_currency: property.agent_fee_currency || 'ILS',
      porches: property.porches || 0,
      sukkah_compatible: property.sukkah_compatible || false,
      condition: property.condition || 'good',
      furniture_option: property.furniture_option || 'no_furniture',
      amenities: property.amenities || [],
      monthly_price: property.monthly_price || '',
      nightly_price: property.nightly_price || '',
      currency: property.currency || 'ILS',
      images: property.images || [],
      videos: property.videos || [],
      cancellation_policy: property.cancellation_policy || 'flexible',
      custom_cancellation_policy: property.custom_cancellation_policy || '',
      available_from: property.available_from || '',
      starting_date: property.starting_date || '',
      minimum_booking_days: property.minimum_booking_days ? String(property.minimum_booking_days) : ''
    });
    setUploadedFiles((property.images || []).map((url, i) => ({
      url, file_type: 'image', filename: url.split('/').pop(), original_name: `Image ${i + 1}`
    })).concat((property.videos || []).map((url, i) => ({
      url, file_type: 'video', filename: url.split('/').pop(), original_name: `Video ${i + 1}`
    }))));
    setEditingPropertyId(property.id);
    setShowAddProperty(true);
  };

  const handleAddProperty = async (e) => {
    e.preventDefault();
    try {
      // Convert empty strings to null for optional numeric fields
      const toNumOrNull = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
      const toIntOrNull = (v) => {
        if (v === '' || v === null || v === undefined) return null;
        const n = parseInt(v, 10);
        return Number.isNaN(n) ? null : n;
      };
      const cleanedForm = {
        ...propertyForm,
        square_meters: toNumOrNull(propertyForm.square_meters),
        porch_square_meters: toNumOrNull(propertyForm.porch_square_meters),
        agent_fee_price: toNumOrNull(propertyForm.agent_fee_price),
        monthly_price: toNumOrNull(propertyForm.monthly_price),
        nightly_price: toNumOrNull(propertyForm.nightly_price),
        bedrooms: toNumOrNull(propertyForm.bedrooms),
        bathrooms: toNumOrNull(propertyForm.bathrooms),
        floor: toNumOrNull(propertyForm.floor),
        porches: toIntOrNull(propertyForm.porches) ?? 0,
        minimum_booking_days: toIntOrNull(propertyForm.minimum_booking_days),
      };
      if (editingPropertyId) {
        await axios.put(`${API}/properties/${editingPropertyId}`, cleanedForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Property updated successfully!');
      } else {
        await axios.post(`${API}/properties`, cleanedForm, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Property added successfully!');
      }
      setShowAddProperty(false);
      setEditingPropertyId(null);
      fetchProperties();
      setPropertyForm({
        title: '',
        description: '',
        rental_type: 'long-term',
        property_type: 'apartment',
        bedrooms: 1,
        bathrooms: 1,
        area: '',
        address: '',
        square_meters: '',
    porch_square_meters: '',
        floor: 1,
        has_elevator: false,
        is_shabbat_elevator: false,
        is_tama: false,
        has_agent_fee: false,
        agent_fee_price: '',
        agent_fee_currency: 'ILS',
        porches: 0,
        sukkah_compatible: false,
        condition: 'good',
        furniture_option: 'no_furniture',
        amenities: [],
        monthly_price: '',
        nightly_price: '',
        currency: 'ILS',
        images: [],
        videos: [],
        cancellation_policy: 'flexible',
        custom_cancellation_policy: ''
      });
      setUploadedFiles([]);
    } catch (error) {
      // Surface the real backend validation error instead of a generic message
      const detail = error?.response?.data?.detail;
      let msg = editingPropertyId ? 'Failed to update property' : 'Failed to add property';
      if (Array.isArray(detail) && detail[0]?.msg) {
        msg = `${msg}: ${detail[0].loc?.slice(1).join('.') || 'field'} — ${detail[0].msg}`;
      } else if (typeof detail === 'string') {
        msg = `${msg}: ${detail}`;
      }
      console.error('Property save error:', error?.response?.data || error);
      toast.error(msg);
    }
  };

  const handleDeleteProperty = async (propertyId) => {
    if (!window.confirm('Are you sure you want to delete this property?')) return;

    try {
      await axios.delete(`${API}/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Property deleted successfully!');
      fetchProperties();
    } catch (error) {
      toast.error('Failed to delete property');
    }
  };

  const handleContractUpload = async (propertyId, file, inputEl) => {
    if (!file) return;
    
    // Allow PDF and image formats
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/heic',
      'image/heif'
    ];
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF and image files (JPG, PNG, WEBP, HEIC) are allowed');
      if (inputEl) inputEl.value = '';
      return;
    }
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      await axios.post(`${API}/properties/${propertyId}/contract`, formData, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      
      toast.success('Contract uploaded successfully!');
      await fetchProperties();
    } catch (error) {
      console.error('Upload contract error:', error?.response?.data || error);
      toast.error(error.response?.data?.detail || 'Failed to upload contract');
    } finally {
      // Reset the input so uploading the SAME file again still triggers onChange.
      if (inputEl) inputEl.value = '';
    }
  };

  const handleDeleteContract = async (propertyId) => {
    if (!window.confirm('Are you sure you want to delete this contract?')) return;

    try {
      await axios.delete(`${API}/properties/${propertyId}/contract`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Contract deleted successfully!');
      await fetchProperties();
    } catch (error) {
      console.error('Delete contract error:', error?.response?.data || error);
      toast.error(error?.response?.data?.detail || 'Failed to delete contract');
    }
  };

  const getShareableLink = () => {
    return `${window.location.origin}/manager/${user.id}`;
  };

  const handleLogoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLogoUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await axios.post(`${API}/user/logo`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
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
      await axios.delete(`${API}/user/logo`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBusinessLogo(null);
      toast.success('Logo removed');
    } catch (error) {
      toast.error('Failed to remove logo');
    }
  };

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

  const openIcalPanel = async (propertyId) => {
    setIcalPanel(icalPanel === propertyId ? null : propertyId);
    setIcalUrl('');
    setCopiedExport(false);
    if (icalPanel !== propertyId) {
      try {
        const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
        setIcalData(prev => ({ ...prev, [propertyId]: res.data }));
      } catch (e) {
        console.error('Failed to fetch blocked dates:', e);
        toast.error('Could not load calendar data');
      }
    }
  };

  const addIcalUrl = async (propertyId) => {
    if (!icalUrl.trim()) return;
    setIcalSyncing(true);
    try {
      await axios.post(`${API}/properties/${propertyId}/ical`, { url: icalUrl.trim() }, { headers: { Authorization: `Bearer ${token}` } });
      toast.success(t('property.ical.copied') || 'iCal feed added!');
      setIcalUrl('');
      const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
      setIcalData(prev => ({ ...prev, [propertyId]: res.data }));
      fetchProperties();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add iCal feed');
    }
    setIcalSyncing(false);
  };

  const removeIcalUrl = async (propertyId, url) => {
    try {
      await axios.delete(`${API}/properties/${propertyId}/ical`, { data: { url }, headers: { Authorization: `Bearer ${token}` } });
      toast.success('iCal feed removed');
      const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
      setIcalData(prev => ({ ...prev, [propertyId]: res.data }));
      fetchProperties();
    } catch (e) {
      toast.error('Failed to remove iCal feed');
    }
  };

  const manualSync = async (propertyId) => {
    setIcalSyncing(true);
    try {
      await axios.post(`${API}/properties/${propertyId}/ical-sync`, {}, { headers: { Authorization: `Bearer ${token}` } });
      const res = await axios.get(`${API}/properties/${propertyId}/blocked-dates`);
      setIcalData(prev => ({ ...prev, [propertyId]: res.data }));
      toast.success('Sync complete');
    } catch (e) {
      toast.error('Sync failed');
    }
    setIcalSyncing(false);
  };

  const copyExportUrl = async (propertyId) => {
    const url = `${API.replace('/api', '')}/api/properties/${propertyId}/ical-export`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2000);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('New passwords do not match.');
      return;
    }
    setChangingPassword(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: currentPassword,
        new_password: newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Password changed successfully!');
      setShowChangePassword(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to change password.');
    } finally {
      setChangingPassword(false);
    }
  };

  const handleServiceRequest = async (serviceType, formDataObj) => {
    setSubmittingService(true);
    try {
      await axios.post(`${API}/service-requests`, {
        service_type: serviceType,
        ...formDataObj
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Service request submitted! We will contact you shortly.');
      setArnonaForm({ full_name: '', id_number: '', address: '', service_type: 'arnona_discount', notes: '' });
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit request.');
    } finally {
      setSubmittingService(false);
    }
  };

  const fetchMySubleases = async () => {
    setLoadingSubleases(true);
    try {
      const res = await axios.get(`${API}/my-subleases`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMySubleases(res.data);
    } catch (err) {
      console.error('Failed to fetch subleases', err);
    } finally {
      setLoadingSubleases(false);
    }
  };

  const fetchRenterBookings = async () => {
    try {
      const res = await axios.get(`${API}/bookings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      // Get full property details for each booking
      const bookingsWithProps = await Promise.all(
        res.data.map(async (b) => {
          try {
            const propRes = await axios.get(`${API}/properties/${b.property_id}`);
            return { ...b, property: propRes.data };
          } catch {
            return { ...b, property: null };
          }
        })
      );
      setMyBookings(bookingsWithProps.filter(b => b.property));
    } catch (err) {
      console.error('Failed to fetch bookings', err);
    }
  };

  const handleCreateSublease = async (e) => {
    e.preventDefault();
    if (!subleaseForm.property_id || !subleaseForm.available_from || !subleaseForm.available_to || !subleaseForm.price) {
      toast.error('Please fill in all required fields.');
      return;
    }
    setSubmittingService(true);
    try {
      await axios.post(`${API}/subleases`, {
        property_id: subleaseForm.property_id,
        available_from: subleaseForm.available_from,
        available_to: subleaseForm.available_to,
        price: parseFloat(subleaseForm.price),
        price_type: subleaseForm.price_type,
        bedrooms_available: subleaseForm.bedrooms_available ? parseInt(subleaseForm.bedrooms_available) : null,
        notes: subleaseForm.notes
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Sublease listed successfully!');
      setSubleaseForm({ property_id: '', available_from: '', available_to: '', price: '', price_type: 'per_night', bedrooms_available: '', notes: '' });
      setShowSubleaseForm(false);
      fetchMySubleases();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to create sublease.');
    } finally {
      setSubmittingService(false);
    }
  };

  const deleteSublease = async (subleaseId) => {
    if (!window.confirm('Remove this sublease listing?')) return;
    try {
      await axios.delete(`${API}/subleases/${subleaseId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Sublease removed.');
      fetchMySubleases();
    } catch (err) {
      toast.error('Failed to remove sublease.');
    }
  };

  const toggleSubleaseActive = async (subleaseId, currentActive) => {
    try {
      await axios.put(`${API}/subleases/${subleaseId}`, { active: !currentActive }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success(!currentActive ? 'Sublease reactivated' : 'Sublease paused');
      fetchMySubleases();
    } catch (err) {
      toast.error('Failed to update sublease.');
    }
  };

  const selectPropertyForSublease = (booking) => {
    setSubleaseForm({
      ...subleaseForm,
      property_id: booking.property_id,
      bedrooms_available: booking.property?.bedrooms?.toString() || ''
    });
    setShowSubleaseForm(true);
  };

  const handleSubleaseContractUpload = async (subleaseId, file) => {
    if (!file) return;
    const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a PDF, DOCX, JPG, PNG, or WebP file.');
      return;
    }
    setUploadingContractFor(subleaseId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`${API}/subleases/${subleaseId}/contract`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Contract uploaded! Share the signing link with your sublessee.');
      fetchMySubleases();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload contract.');
    } finally {
      setUploadingContractFor(null);
    }
  };

  const copySignLink = (signToken) => {
    const origin = window.location.origin;
    const link = `${origin}/sign/${signToken}`;
    navigator.clipboard.writeText(link);
    setCopiedSignLink(signToken);
    toast.success('Signing link copied to clipboard!');
    setTimeout(() => setCopiedSignLink(null), 3000);
  };

  // Location options data
  const locationOptions = [
    { city: 'Jerusalem', neighborhoods: ['Abu Tor','American Colony','Arnona','Arzei HaBira','Baka','Bayit VeGan','Beit HaKerem','Beit Yisrael','Bukharan Quarter','East Talpiot','Ein Kerem','French Hill','Geula','German Colony','Gilo','Givat HaMivtar','Givat Massuah','Givat Mordechai','Givat Ram','Givat Shaul','Greek Colony','Har Nof','Holyland','Jewish Quarter','Katamon','Kerem Avraham','Kiryat HaYovel','Kiryat Menachem','Kiryat Moshe','Kiryat Shmuel','Maalot Dafna','Mahane Yehuda','Malha','Mamilla','Mea Shearim','Mekor Baruch','Mekor Chaim','Mishkenot Shaananim','Musrara','Nachlaot','Neve Yaakov','Old City','Pat','Pisgat Zeev','Ramat Beit HaKerem','Ramat Denya','Ramat Eshkol','Ramat Shlomo','Ramot','Rassco','Rehavia','Romema','Sanhedria','Sanhedria Murhevet','Shaare Hesed','Shmuel HaNavi','Talbiya','Talpiot','Yemin Moshe'] },
    { city: 'Tel Aviv', neighborhoods: ['Afeka','Bavli','City Center (Lev Ha\'Ir)','Florentin','HaTikva','Jaffa (Yafo)','Kerem HaTeimanim','Kikar HaMedina','Kiryat Shalom','Lev Ha\'Ir','Nahalat Binyamin','Neve Ofer','Neve Sha\'anan','Neve Tzedek','New North','Nordau','Old North','Old Jaffa','Park Tzameret','Ramat Aviv','Ramat HaHayal','Ramat HaTayasim','Sarona','Shapira','Tel Baruch','White City','Yad Eliyahu'] },
    { city: 'Haifa', neighborhoods: ['Ahuza','Bat Galim','Carmel Center','Carmeliya','Denia','French Carmel','German Colony','Hadar HaCarmel','Halisa','Kababir','Kiryat Eliezer','Kiryat Haim','Kiryat Shmuel','Neve David','Neve Sha\'anan','Ramat Almogi','Ramat Eshkol','Romema','Stella Maris','Wadi Nisnas','Western Carmel'] },
    { city: 'Beersheba', neighborhoods: ['City Center','Dalet','Gimmel','Hey','Nahal Beka','Neve Menachem','Neve Noy','Neve Zeev','Old City','Ramot','Ramot Bet','Tet','Vav'] },
    { city: 'Netanya', neighborhoods: ['City Center','Galei Yam','HaAgamim','Ir Yamim','Kiryat Hasharon','Kiryat Nordau','Neve Itamar','Neve Oz','North Netanya','Poleg','Ramat Chen','Ramat Herzl','South Netanya','Umm Khalid'] },
    { city: 'Ashdod', neighborhoods: ['Alef','Bet','City Center','Dalet','Gimmel','Hey','Marina','Tet','Vav','Yud','Yud Alef','Yud Bet','Yud Zayin','Zayin'] },
    { city: 'Ashkelon', neighborhoods: ['Afridar','Barnea','City Center','HaGiborim','Migdalei HaYam','Neve Dekalim','Neve Ilan','Samson Quarter','Shimshon','South Beach','Zion Hills'] },
    { city: 'Petah Tikva', neighborhoods: ['Am Israel Hai','City Center','Ein Ganim','Hadar Ganim','Kfar Avraham','Kfar Ganim','Kiryat Aryeh','Kiryat Matalon','Neve Oz','Ramat Siv','Yad Labanim'] },
    { city: 'Rishon LeZion', neighborhoods: ['City Center','HaHadasha','HaMizrah','Kiryat Rishon','Maarav','Nahalat Yehuda','Neve Dekalim','Neve Hof','Neve Ilan','Old Rishon','Ramat Eliyahu','Ramat Ilan','Superland Area'] },
    { city: 'Ramat Gan', neighborhoods: ['City Center','Diamond Exchange','Givat Geula','Kiryat Borochov','Kiryat Krinitzi','Neve Yehoshua','Ramat Chen','Ramat Efal','Ramat Shikma','Tel Binyamin'] },
    { city: 'Herzliya', neighborhoods: ['City Center','Herzliya HaTzeira','Herzliya Pituah','Neve Amal','Neve Oved','Nof Yam','Ramat HaSharon'] },
    { city: 'Raanana', neighborhoods: ['City Center','Neve Zemer','North Raanana','Ramat Raanana','South Raanana','West Raanana'] },
    { city: 'Kfar Saba', neighborhoods: ['City Center','Green Kfar Saba','Neve Issar','North Kfar Saba','Old Kfar Saba','South Kfar Saba','Yoseftal'] },
    { city: 'Modiin', neighborhoods: ['Avnei Hen','Buchman','City Center','Hahashmonaim','Moriah','Neve Ilan','Reut'] },
    { city: 'Beit Shemesh', neighborhoods: ['City Center','Givat Sharett','Nofei HaShemesh','Old Beit Shemesh','Ramat Beit Shemesh Alef','Ramat Beit Shemesh Bet','Ramat Beit Shemesh Gimmel','Sheinfeld'] },
    { city: 'Eilat', neighborhoods: ['Arava','City Center','HaDekel','HaSharon','North Beach','North Eilat','Shahamon','South Eilat','Tourist Center'] },
    { city: 'Other Cities', neighborhoods: ['Acre (Akko)','Arad','Ariel','Bat Yam','Bnei Brak','Caesarea','Dimona','Gedera','Givat Shmuel','Givatayim','Hadera','Harish','Hod HaSharon','Holon','Kiryat Ata','Kiryat Gat','Kiryat Ono','Kiryat Yam','Lod','Maale Adumim','Nahariya','Nazareth','Nes Ziona','Nesher','Netivot','Or Yehuda','Rahat','Ramla','Rehovot','Rosh HaAyin','Safed (Tzfat)','Sderot','Shoham','Tiberias','Yavne','Yokneam','Zichron Yaakov'] }
  ];

  // Filter locations based on search
  const filteredLocations = locationOptions.flatMap(cityGroup => 
    cityGroup.neighborhoods
      .filter(neighborhood => {
        // If no search term, show all locations
        if (!locationSearch || locationSearch.trim() === '') return true;
        
        const searchLower = locationSearch.toLowerCase();
        const neighborhoodLower = neighborhood.toLowerCase();
        const cityLower = cityGroup.city.toLowerCase();
        const fullLocation = `${cityGroup.city} - ${neighborhood}`.toLowerCase();
        return neighborhoodLower.includes(searchLower) || 
               cityLower.includes(searchLower) || 
               fullLocation.includes(searchLower);
      })
      .map(neighborhood => ({
        city: cityGroup.city,
        neighborhood,
        value: cityGroup.city === 'Other Cities' ? neighborhood : `${cityGroup.city} - ${neighborhood}`
      }))
  );

  return (
    <div className="min-h-screen" data-testid="dashboard-page">
      <div className="max-w-7xl mx-auto px-6 pt-28 pb-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold" style={{ fontFamily: 'Playfair Display' }}>Dashboard</h1>
          {user && user.role !== 'renter' && (
            <button onClick={() => { setEditingPropertyId(null); setUploadedFiles([]); setPropertyForm({ title: '', description: '', rental_type: 'long-term', property_type: 'apartment', bedrooms: 1, bathrooms: 1, area: '', address: '', square_meters: '', floor: 1, has_elevator: false, is_shabbat_elevator: false, is_tama: false, has_agent_fee: false, agent_fee_price: '', agent_fee_currency: 'ILS', porches: 0, sukkah_compatible: false, condition: 'good', furniture_option: 'no_furniture', amenities: [], monthly_price: '', nightly_price: '', currency: 'ILS', images: [], videos: [], cancellation_policy: 'flexible', custom_cancellation_policy: '', available_from: '', starting_date: '', minimum_booking_days: '' }); setShowAddProperty(true); }} className="primary-btn flex items-center gap-2" data-testid="add-property-button">
              <Plus size={20} />
              {t('dashboard.addProperty')}
            </button>
          )}
          {user && user.role === 'renter' && (
            <button onClick={() => { setShowSubleaseForm(!showSubleaseForm); if (!showSubleaseForm) fetchRenterBookings(); setActiveTab('subleases'); }} className="primary-btn flex items-center gap-2" data-testid="sublease-property-button">
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
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex-shrink-0 py-2.5 px-3 md:px-4 rounded-lg text-xs md:text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'bookings' ? 'bg-white text-[#1E6A6A] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              data-testid="tab-bookings"
            >
              {t('dashboard.myBookings')}
            </button>
            {user && user.role !== 'renter' && (
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
                onClick={() => { setActiveTab('subleases'); fetchMySubleases(); }}
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
            <button
              onClick={() => { setActiveTab('liked'); fetchLikedProperties(); }}
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


        {/* Liked Properties Tab */}
        {activeTab === 'liked' && (
          <div className="space-y-6" data-testid="liked-tab">
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>Liked Properties</h2>

            {loadingLiked ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-3 border-[#1E6A6A] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : likedProperties.length === 0 ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
                <Heart size={48} className="mx-auto mb-4 text-gray-300" />
                <p className="text-gray-500 text-lg font-medium">No saved properties yet</p>
                <p className="text-gray-400 text-sm mt-1 mb-5">Browse listings and tap the heart to save your favorites.</p>
                <button
                  onClick={() => navigate('/properties/all')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium transition-all hover:shadow-md"
                  style={{ backgroundColor: '#1E6A6A' }}
                >
                  Browse Properties
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {likedProperties.map((property) => (
                  <div
                    key={property.id}
                    className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
                    data-testid={`liked-property-${property.id}`}
                  >
                    <div
                      className="h-44 bg-gray-200 relative"
                      style={{
                        backgroundImage: `url(${property.images?.[0] ? (property.images[0].startsWith('/api') ? `${API.replace('/api', '')}${property.images[0]}` : property.images[0]) : 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                      onClick={() => navigate(`/property/${property.id}`)}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); unlikeProperty(property.id); }}
                        className="absolute top-3 right-3 w-10 h-10 rounded-full bg-white/90 hover:bg-white flex items-center justify-center shadow-md transition-all hover:scale-110 active:scale-95 z-10"
                        data-testid={`unlike-btn-${property.id}`}
                      >
                        <Heart size={18} className="fill-red-500 text-red-500" />
                      </button>
                      <div className="absolute bottom-3 left-3">
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-white/90 text-gray-700 backdrop-blur-sm">
                          {property.rental_type?.replace('-', ' ')}
                        </span>
                      </div>
                    </div>
                    <div className="p-4" onClick={() => navigate(`/property/${property.id}`)}>
                      <h3 className="text-base font-bold text-gray-900 mb-1 truncate">{property.title}</h3>
                      <div className="flex items-center gap-1.5 text-gray-500 text-sm mb-3">
                        <MapPin size={14} />
                        <span className="truncate">{property.area}</span>
                      </div>
                      <div className="flex items-center gap-3 mb-3 text-xs text-gray-600">
                        {property.bedrooms > 0 && (
                          <span className="flex items-center gap-1"><Bed size={13} /> {property.bedrooms} bed</span>
                        )}
                        {property.bathrooms > 0 && (
                          <span className="flex items-center gap-1"><Bath size={13} /> {property.bathrooms} bath</span>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold" style={{ color: '#D4AF37' }}>
                          {property.currency === 'USD' ? '$' : '₪'}{(property.monthly_price || property.nightly_price || 0).toLocaleString()}
                          <span className="text-xs font-normal text-gray-500">
                            {property.rental_type === 'vacation' ? '/night' : '/mo'}
                          </span>
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); navigate(`/property/${property.id}`); }}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
                          style={{ color: '#1E6A6A', backgroundColor: '#1E6A6A10' }}
                        >
                          View →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Subleases Tab */}
        {activeTab === 'subleases' && user && user.role === 'renter' && (
          <div className="space-y-6" data-testid="subleases-tab">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-[#1E6A6A] to-[#267a7a] px-6 py-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                      <Home size={24} className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Plus size={20} className="text-white" />
                        Sublease Your Property
                      </h3>
                      <p className="text-white/80 text-sm">Post your rental for others in just a few clicks</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setShowSubleaseForm(!showSubleaseForm); if (!showSubleaseForm) fetchRenterBookings(); }}
                    className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-all backdrop-blur-sm"
                    data-testid="create-sublease-btn"
                  >
                    {showSubleaseForm ? 'Cancel' : '+ New Sublease'}
                  </button>
                </div>
              </div>

              <div className="p-6">
                {showSubleaseForm && (
                  <div className="mb-6 bg-gray-50 rounded-xl p-5" data-testid="sublease-form-section">
                    {/* Step 1: Select Property */}
                    {!subleaseForm.property_id ? (
                      <div>
                        <h4 className="text-sm font-bold text-gray-800 mb-3">Step 1: Select the property you're renting</h4>
                        {myBookings.length === 0 ? (
                          <div className="text-center py-6">
                            <p className="text-gray-500 text-sm">You don't have any active bookings to sublease.</p>
                            <p className="text-gray-400 text-xs mt-1">Book a property first, then you can sublease it here.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {myBookings.map(b => (
                              <button
                                key={b.id}
                                onClick={() => selectPropertyForSublease(b)}
                                className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:border-[#1E6A6A] hover:bg-white transition-all text-left"
                                data-testid={`select-booking-${b.id}`}
                              >
                                <div
                                  className="w-14 h-14 rounded-lg bg-gray-200 shrink-0"
                                  style={{
                                    backgroundImage: `url(${b.property?.images?.[0] ? (b.property.images[0].startsWith('/api') ? `${API.replace('/api', '')}${b.property.images[0]}` : b.property.images[0]) : ''})`,
                                    backgroundSize: 'cover', backgroundPosition: 'center'
                                  }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-gray-800 truncate">{b.property?.title}</p>
                                  <p className="text-xs text-gray-500">{b.property?.area} • {b.property?.bedrooms} bed • {b.property?.bathrooms} bath</p>
                                </div>
                                <span className="text-xs font-medium text-[#1E6A6A]">Select →</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Step 2: Set sublease details */
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-sm font-bold text-gray-800">Step 2: Set your sublease details</h4>
                          <button
                            onClick={() => setSubleaseForm({ ...subleaseForm, property_id: '' })}
                            className="text-xs text-gray-500 hover:text-[#1E6A6A]"
                          >
                            ← Change property
                          </button>
                        </div>

                        {/* Selected property preview */}
                        {(() => {
                          const selectedBooking = myBookings.find(b => b.property_id === subleaseForm.property_id);
                          return selectedBooking?.property ? (
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#1E6A6A]/20 mb-4">
                              <div
                                className="w-12 h-12 rounded-lg bg-gray-200 shrink-0"
                                style={{
                                  backgroundImage: `url(${selectedBooking.property.images?.[0] ? (selectedBooking.property.images[0].startsWith('/api') ? `${API.replace('/api', '')}${selectedBooking.property.images[0]}` : selectedBooking.property.images[0]) : ''})`,
                                  backgroundSize: 'cover', backgroundPosition: 'center'
                                }}
                              />
                              <div>
                                <p className="text-sm font-semibold text-gray-800">{selectedBooking.property.title}</p>
                                <p className="text-xs text-gray-500">{selectedBooking.property.area}</p>
                              </div>
                              <Check size={18} className="text-[#1E6A6A] ml-auto" />
                            </div>
                          ) : null;
                        })()}

                        <form onSubmit={handleCreateSublease} className="space-y-4" data-testid="sublease-form">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1.5">Available From</label>
                              <input
                                type="date"
                                value={subleaseForm.available_from}
                                onChange={(e) => setSubleaseForm({ ...subleaseForm, available_from: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
                                required
                                data-testid="sublease-from-date"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1.5">Available To</label>
                              <input
                                type="date"
                                value={subleaseForm.available_to}
                                onChange={(e) => setSubleaseForm({ ...subleaseForm, available_to: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
                                required
                                data-testid="sublease-to-date"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1.5">Price (₪)</label>
                              <input
                                type="number"
                                value={subleaseForm.price}
                                onChange={(e) => setSubleaseForm({ ...subleaseForm, price: e.target.value })}
                                placeholder="e.g. 200"
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
                                required
                                min="1"
                                data-testid="sublease-price"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1.5">Price Type</label>
                              <select
                                value={subleaseForm.price_type}
                                onChange={(e) => setSubleaseForm({ ...subleaseForm, price_type: e.target.value })}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
                                data-testid="sublease-price-type"
                              >
                                <option value="per_night">Per Night</option>
                                <option value="flat">Flat Rate (Total)</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">
                              Bedrooms Available <span className="text-gray-400">(leave blank for all rooms)</span>
                            </label>
                            <input
                              type="number"
                              value={subleaseForm.bedrooms_available}
                              onChange={(e) => setSubleaseForm({ ...subleaseForm, bedrooms_available: e.target.value })}
                              placeholder="All rooms"
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
                              min="1"
                              data-testid="sublease-bedrooms"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1.5">Notes for Sublessee</label>
                            <textarea
                              value={subleaseForm.notes}
                              onChange={(e) => setSubleaseForm({ ...subleaseForm, notes: e.target.value })}
                              placeholder="e.g. Furnished, utilities included, no pets..."
                              rows={2}
                              className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm resize-none"
                              data-testid="sublease-notes"
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={submittingService}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-all hover:shadow-md"
                            style={{ backgroundColor: '#1E6A6A' }}
                            data-testid="sublease-submit-btn"
                          >
                            <Send size={16} />
                            {submittingService ? 'Posting...' : 'Post Sublease Listing'}
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                )}

                {/* My Active Subleases */}
                {mySubleases.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-700">Your Sublease Listings</h4>
                    {mySubleases.map(sub => (
                      <div key={sub.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden" data-testid={`sublease-${sub.id}`}>
                        <div className="flex items-center gap-4 p-4">
                          <div
                            className="w-16 h-16 rounded-lg bg-gray-200 shrink-0"
                            style={{
                              backgroundImage: `url(${sub.images?.[0] ? (sub.images[0].startsWith('/api') ? `${API.replace('/api', '')}${sub.images[0]}` : sub.images[0]) : ''})`,
                              backgroundSize: 'cover', backgroundPosition: 'center'
                            }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-800 truncate">{sub.title}</p>
                            <p className="text-xs text-gray-500">{sub.area} • {sub.bedrooms_available} bed</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {new Date(sub.available_from).toLocaleDateString()} — {new Date(sub.available_to).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-base font-bold" style={{ color: '#D4AF37' }}>
                              ₪{sub.price?.toLocaleString()}
                              <span className="text-[10px] font-normal text-gray-500">
                                {sub.price_type === 'per_night' ? '/night' : ' total'}
                              </span>
                            </p>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${sub.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                              {sub.active ? 'Active' : 'Paused'}
                            </span>
                          </div>
                          <div className="flex flex-col gap-1 shrink-0">
                            <button
                              onClick={() => toggleSubleaseActive(sub.id, sub.active)}
                              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:border-[#1E6A6A] hover:text-[#1E6A6A] transition-colors"
                            >
                              {sub.active ? 'Pause' : 'Activate'}
                            </button>
                            <button
                              onClick={() => deleteSublease(sub.id)}
                              className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 hover:border-red-400 hover:text-red-500 transition-colors"
                            >
                              Remove
                            </button>
                          </div>
                        </div>

                        {/* Contract Section */}
                        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                          {sub.contract_id && sub.sign_token ? (
                            <div className="flex items-center gap-3 flex-wrap">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FileText size={16} className="text-[#1E6A6A] shrink-0" />
                                <span className="text-xs font-medium text-gray-700 truncate">Contract uploaded</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${sub.contract_signed ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                  {sub.contract_signed ? 'Signed' : 'Awaiting signature'}
                                </span>
                              </div>
                              <button
                                onClick={() => copySignLink(sub.sign_token)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[#1E6A6A]/20 text-[#1E6A6A] hover:bg-[#1E6A6A]/5 transition-colors shrink-0"
                                data-testid={`copy-sign-link-${sub.id}`}
                              >
                                {copiedSignLink === sub.sign_token ? (
                                  <><Check size={12} /> Copied!</>
                                ) : (
                                  <><Copy size={12} /> Copy Signing Link</>
                                )}
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <input
                                type="file"
                                ref={subleaseFileRef}
                                className="hidden"
                                accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
                                onChange={(e) => { if (e.target.files?.[0]) handleSubleaseContractUpload(sub.id, e.target.files[0]); e.target.value = ''; }}
                              />
                              <button
                                onClick={() => subleaseFileRef.current?.click()}
                                disabled={uploadingContractFor === sub.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-dashed border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/5 transition-colors disabled:opacity-50"
                                data-testid={`upload-contract-${sub.id}`}
                              >
                                {uploadingContractFor === sub.id ? (
                                  <><Loader2 size={12} className="animate-spin" /> Uploading...</>
                                ) : (
                                  <><Upload size={12} /> Upload Contract for Sublessee to Sign</>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !showSubleaseForm ? (
                  <div className="text-center py-6">
                    <Home size={32} className="mx-auto mb-3 text-gray-300" />
                    <p className="text-gray-500 text-sm font-medium">No active subleases</p>
                    <p className="text-gray-400 text-xs mt-1">Click "+ New Sublease" to post your rental for others.</p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && user && user.role === 'renter' && (
          <div className="space-y-6" data-testid="services-tab">
            <h2 className="text-2xl font-bold" style={{ fontFamily: 'Playfair Display' }}>Our Services</h2>

            {/* Government Document Services Card */}
            <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="bg-gradient-to-r from-[#D4AF37] to-[#c4a030] px-6 py-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <FileCheck size={24} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Government Document Services</h3>
                    <p className="text-white/80 text-sm">Let us handle the hassle for you</p>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <p className="text-gray-600 text-sm mb-4 leading-relaxed">
                  We take care of all government documents, your <strong className="text-[#1E6A6A]">Arnona discount</strong>, and the <strong className="text-[#1E6A6A]">property name change</strong> — quickly and professionally.
                </p>

                {/* Service badges */}
                <div className="flex flex-wrap gap-2 mb-5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#1E6A6A]/10 text-[#1E6A6A] text-xs font-medium">
                    <Check size={12} /> Arnona Discount
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#D4AF37]/10 text-[#D4AF37] text-xs font-medium">
                    <Check size={12} /> Property Name Change
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gray-100 text-gray-600 text-xs font-medium">
                    <Check size={12} /> Government Forms
                  </span>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleServiceRequest('government', arnonaForm); }} className="space-y-4" data-testid="government-service-form">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Full Legal Name</label>
                      <input
                        type="text"
                        value={arnonaForm.full_name}
                        onChange={(e) => setArnonaForm({ ...arnonaForm, full_name: e.target.value })}
                        placeholder="As it appears on your ID"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] text-sm"
                        required
                        data-testid="gov-fullname-input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">ID / Passport Number</label>
                      <input
                        type="text"
                        value={arnonaForm.id_number}
                        onChange={(e) => setArnonaForm({ ...arnonaForm, id_number: e.target.value })}
                        placeholder="ID or Teudat Zehut number"
                        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] text-sm"
                        required
                        data-testid="gov-id-input"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Property Address</label>
                    <input
                      type="text"
                      value={arnonaForm.address}
                      onChange={(e) => setArnonaForm({ ...arnonaForm, address: e.target.value })}
                      placeholder="Full property address"
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] text-sm"
                      required
                      data-testid="gov-address-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Service Needed</label>
                    <select
                      value={arnonaForm.service_type}
                      onChange={(e) => setArnonaForm({ ...arnonaForm, service_type: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] text-sm"
                      required
                      data-testid="gov-service-type-select"
                    >
                      <option value="arnona_discount">Arnona Discount Application</option>
                      <option value="name_change">Property Name Change</option>
                      <option value="both">Both — Arnona Discount + Name Change</option>
                      <option value="other">Other Government Documents</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Additional Notes</label>
                    <textarea
                      value={arnonaForm.notes}
                      onChange={(e) => setArnonaForm({ ...arnonaForm, notes: e.target.value })}
                      placeholder="Any specific details about your request"
                      rows={3}
                      className="w-full px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]/30 focus:border-[#D4AF37] text-sm resize-none"
                      data-testid="gov-notes-input"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={submittingService}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium disabled:opacity-50 transition-all hover:shadow-md"
                    style={{ backgroundColor: '#D4AF37' }}
                    data-testid="gov-submit-btn"
                  >
                    <Send size={16} />
                    {submittingService ? 'Submitting...' : 'Submit Request'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'properties' && (
        <>
        {showAddProperty && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" data-testid="add-property-modal">
            <div className="bg-white rounded-2xl p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <h2 className="text-3xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>{editingPropertyId ? t('dashboard.editProperty') : t('dashboard.addNewProperty')}</h2>
              <form onSubmit={handleAddProperty} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Title</label>
                  <input
                    type="text"
                    value={propertyForm.title}
                    onChange={(e) => setPropertyForm({ ...propertyForm, title: e.target.value })}
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                    required
                    data-testid="property-title-input"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Description</label>
                  <textarea
                    value={propertyForm.description}
                    onChange={(e) => setPropertyForm({ ...propertyForm, description: e.target.value })}
                    rows="4"
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                    data-testid="property-description-input"
                  ></textarea>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.rentalType')}</label>
                    <select
                      value={propertyForm.rental_type}
                      onChange={(e) => setPropertyForm({ ...propertyForm, rental_type: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-rental-type-select"
                    >
                      <option value="long-term">{t('property.longTerm')}</option>
                      <option value="short-term">{t('property.shortTerm')}</option>
                      <option value="vacation">{t('property.vacationType')}</option>
                      <option value="storage">{t('property.storageType')}</option>
                    </select>
                  </div>
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.propertyType')}</label>
                    <select
                      value={propertyForm.property_type}
                      onChange={(e) => setPropertyForm({ ...propertyForm, property_type: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-type-select"
                    >
                      <option value="apartment">{t('property.apartment')}</option>
                      <option value="house">{t('property.house')}</option>
                      <option value="villa">Villa</option>
                    </select>
                  </div>
                  )}
                  <div className="relative" ref={locationDropdownRef}>
                    <label className="block text-sm font-medium mb-2">{t('property.propertyLocation')}</label>
                    <input
                      type="text"
                      value={showLocationDropdown ? locationSearch : (propertyForm.area || '')}
                      onChange={(e) => {
                        setLocationSearch(e.target.value);
                        if (e.target.value === '') {
                          setPropertyForm({ ...propertyForm, area: '' });
                        }
                        setShowLocationDropdown(true);
                      }}
                      onFocus={() => {
                        setLocationSearch('');
                        setShowLocationDropdown(true);
                      }}
                      onBlur={() => {
                        // If no selection was made and field is empty, keep it empty
                        if (!propertyForm.area && locationSearch === '') {
                          setLocationSearch('');
                        }
                      }}
                      placeholder="Type to search location..."
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      required={!propertyForm.area}
                      data-testid="property-area-input"
                    />
                    {showLocationDropdown && (
                      <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {filteredLocations.length === 0 ? (
                          <div className="px-4 py-3 text-sm text-gray-500">No locations found</div>
                        ) : (
                          filteredLocations.map((location) => (
                            <div
                              key={location.value}
                              onClick={() => {
                                setPropertyForm({ ...propertyForm, area: location.value });
                                setLocationSearch('');
                                setShowLocationDropdown(false);
                              }}
                              className="px-4 py-2 hover:bg-[#1E6A6A]/10 cursor-pointer text-sm transition-colors"
                            >
                              <span className="font-medium text-gray-700">{location.neighborhood}</span>
                              <span className="text-gray-500 text-xs ml-2">({location.city})</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.address')}</label>
                    <input
                      type="text"
                      value={propertyForm.address}
                      onChange={(e) => setPropertyForm({ ...propertyForm, address: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-address-input"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.sqm')}</label>
                    <input
                      type="number"
                      value={propertyForm.square_meters}
                      onChange={(e) => setPropertyForm({ ...propertyForm, square_meters: parseFloat(e.target.value) || '' })}
                      min="0"
                      step="0.1"
                      placeholder="Total apartment size"
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-sqm-input"
                    />
                  </div>
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.bedrooms')}</label>
                    <select
                      value={propertyForm.bedrooms}
                      onChange={(e) => setPropertyForm({ ...propertyForm, bedrooms: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-bedrooms-input"
                    >
                      <option value="0">Studio</option>
                      <option value="1">1</option>
                      <option value="1.5">1.5</option>
                      <option value="2">2</option>
                      <option value="2.5">2.5</option>
                      <option value="3">3</option>
                      <option value="3.5">3.5</option>
                      <option value="4">4</option>
                      <option value="4.5">4.5</option>
                      <option value="5">5</option>
                      <option value="5.5">5.5</option>
                      <option value="6">6</option>
                      <option value="6.5">6.5</option>
                      <option value="7">7</option>
                      <option value="8">8+</option>
                    </select>
                  </div>
                  )}
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.bathrooms')}</label>
                    <select
                      value={propertyForm.bathrooms}
                      onChange={(e) => setPropertyForm({ ...propertyForm, bathrooms: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-bathrooms-input"
                    >
                      <option value="1">1</option>
                      <option value="1.5">1.5</option>
                      <option value="2">2</option>
                      <option value="2.5">2.5</option>
                      <option value="3">3</option>
                      <option value="3.5">3.5</option>
                      <option value="4">4</option>
                      <option value="4.5">4.5</option>
                      <option value="5">5</option>
                      <option value="5.5">5.5</option>
                      <option value="6">6+</option>
                    </select>
                  </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.floor')}</label>
                    <select
                      value={propertyForm.floor}
                      onChange={(e) => setPropertyForm({ ...propertyForm, floor: parseFloat(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-floor-input"
                    >
                      <option value="-2">Basement 2</option>
                      <option value="-1">Basement 1</option>
                      <option value="0">{t('property.groundFloor')}</option>
                      <option value="1">1</option>
                      <option value="1.5">1.5</option>
                      <option value="2">2</option>
                      <option value="2.5">2.5</option>
                      <option value="3">3</option>
                      <option value="3.5">3.5</option>
                      <option value="4">4</option>
                      <option value="4.5">4.5</option>
                      <option value="5">5</option>
                      <option value="5.5">5.5</option>
                      <option value="6">6</option>
                      <option value="6.5">6.5</option>
                      <option value="7">7</option>
                      <option value="7.5">7.5</option>
                      <option value="8">8</option>
                      <option value="8.5">8.5</option>
                      <option value="9">9</option>
                      <option value="9.5">9.5</option>
                      <option value="10">10</option>
                      <option value="11">11</option>
                      <option value="12">12</option>
                      <option value="13">13</option>
                      <option value="14">14</option>
                      <option value="15">15</option>
                      <option value="20">20+</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2">Price {propertyForm.rental_type === 'vacation' ? '(per night)' : '(monthly)'}</label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={propertyForm.rental_type === 'vacation' ? propertyForm.nightly_price : propertyForm.monthly_price}
                        onChange={(e) => {
                          if (propertyForm.rental_type === 'vacation') {
                            setPropertyForm({ ...propertyForm, nightly_price: parseFloat(e.target.value) });
                          } else {
                            setPropertyForm({ ...propertyForm, monthly_price: parseFloat(e.target.value) });
                          }
                        }}
                        min="0"
                        className="flex-1 px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                        required
                        data-testid="property-price-input"
                      />
                      <select
                        value={propertyForm.currency}
                        onChange={(e) => setPropertyForm({ ...propertyForm, currency: e.target.value })}
                        className="px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                        data-testid="property-currency-select"
                      >
                        <option value="ILS">₪ ILS</option>
                        <option value="USD">$ USD</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Starting Date (Long-term only) OR Date Available (Others) */}
                {propertyForm.rental_type === 'long-term' ? (
                  <div className="relative">
                    <label className="block text-sm font-medium mb-3 flex items-center gap-2 text-gray-700">
                      <div className="p-2 bg-[#1E6A6A]/10 rounded-lg">
                        <Calendar size={18} style={{ color: '#1E6A6A' }} />
                      </div>
                      <span className="font-semibold">Starting Date *</span>
                    </label>
                    <div 
                      className="relative cursor-pointer"
                      onClick={() => setShowStartingDateCalendar(!showStartingDateCalendar)}
                    >
                      <div className="w-full px-5 py-4 rounded-xl border-2 border-[#1E6A6A]/20 bg-white hover:border-[#1E6A6A]/40 hover:shadow-md transition-all duration-200 flex items-center justify-between group">
                        <span className={`text-base font-medium ${propertyForm.starting_date ? 'text-gray-700' : 'text-gray-400'}`}>
                          {propertyForm.starting_date ? format(parseLocalDate(propertyForm.starting_date), 'MMMM d, yyyy') : 'Select starting date'}
                        </span>
                        <Calendar size={20} className="text-[#1E6A6A]/40 group-hover:text-[#1E6A6A]/60 transition-colors" />
                      </div>
                    </div>
                    
                    {showStartingDateCalendar && (
                      <div className="absolute top-full mt-2 bg-white rounded-xl border-2 border-[#1E6A6A] shadow-2xl p-4 z-[100] w-[320px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowStartingDateCalendar(false);
                          }}
                          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 z-[110]"
                        >
                          <X size={14} />
                        </button>
                        <CalendarComponent
                          mode="single"
                          selected={parseLocalDate(propertyForm.starting_date)}
                          onSelect={(date) => {
                            if (date) {
                              setPropertyForm({ ...propertyForm, starting_date: format(date, 'yyyy-MM-dd') });
                              setShowStartingDateCalendar(false);
                            }
                          }}
                          disabled={[{ before: new Date() }]}
                          initialFocus
                        />
                      </div>
                    )}
                    
                    <div className="mt-3 p-3 bg-[#1E6A6A]/5 rounded-lg border border-[#1E6A6A]/10">
                      <p className="text-xs text-[#1E6A6A] flex items-start gap-2">
                        <span className="text-base">📌</span>
                        <span className="font-medium">Fixed start date for this long-term rental (cannot be changed by renters)</span>
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <label className="block text-sm font-medium mb-3 flex items-center gap-2 text-gray-700">
                      <div className="p-2 bg-[#D4AF37]/10 rounded-lg">
                        <Calendar size={18} style={{ color: '#D4AF37' }} />
                      </div>
                      <span className="font-semibold">Date Available</span>
                    </label>
                    <div 
                      className="relative cursor-pointer"
                      onClick={() => setShowAvailableFromCalendar(!showAvailableFromCalendar)}
                    >
                      <div className="w-full px-5 py-4 rounded-xl border-2 border-[#D4AF37]/20 bg-white hover:border-[#D4AF37]/40 hover:shadow-md transition-all duration-200 flex items-center justify-between group">
                        <span className={`text-base font-medium ${propertyForm.available_from ? 'text-gray-700' : 'text-gray-400'}`}>
                          {propertyForm.available_from ? format(parseLocalDate(propertyForm.available_from), 'MMMM d, yyyy') : 'Select available date'}
                        </span>
                        <Calendar size={20} className="text-[#D4AF37]/40 group-hover:text-[#D4AF37]/60 transition-colors" />
                      </div>
                    </div>
                    
                    {showAvailableFromCalendar && (
                      <div className="absolute top-full mt-2 bg-white rounded-xl border-2 border-[#D4AF37] shadow-2xl p-4 z-[100] w-[320px]">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setShowAvailableFromCalendar(false);
                          }}
                          className="absolute top-2 right-2 p-1 rounded-full hover:bg-gray-100 z-[110]"
                        >
                          <X size={14} />
                        </button>
                        <CalendarComponent
                          mode="single"
                          selected={parseLocalDate(propertyForm.available_from)}
                          onSelect={(date) => {
                            if (date) {
                              setPropertyForm({ ...propertyForm, available_from: format(date, 'yyyy-MM-dd') });
                              setShowAvailableFromCalendar(false);
                            }
                          }}
                          disabled={[{ before: new Date() }]}
                          initialFocus
                        />
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-500 mt-3 flex items-center gap-2">
                      <span className="text-sm">ℹ️</span>
                      <span>The earliest date this property can be booked from</span>
                    </p>
                  </div>
                )}

                {/* Minimum Booking Length */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    {propertyForm.rental_type === 'vacation' 
                      ? 'Minimum Booking Length (Days)' 
                      : 'Minimum Booking Length (Months)'}
                  </label>
                  <input
                    type="number"
                    value={propertyForm.minimum_booking_days}
                    onChange={(e) => setPropertyForm({ ...propertyForm, minimum_booking_days: e.target.value })}
                    placeholder={propertyForm.rental_type === 'vacation' ? '7' : '12'}
                    className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                    min="1"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    {propertyForm.rental_type === 'vacation'
                      ? 'Minimum number of days a renter must book (e.g., 3, 7, 14 days)'
                      : 'Minimum number of months a renter must book (e.g., 6, 12, 24 months)'}
                  </p>
                </div>

                {/* Cancellation Policy - Vacation Rentals Only */}
                {propertyForm.rental_type === 'vacation' && (
                  <div className="border-t border-gray-200 pt-6">
                    <h3 className="text-lg font-bold mb-4">Cancellation Policy</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Policy Type</label>
                        <select
                          value={propertyForm.cancellation_policy}
                          onChange={(e) => setPropertyForm({ ...propertyForm, cancellation_policy: e.target.value })}
                          className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                        >
                          <option value="flexible">Flexible - Full refund 7+ days before check-in</option>
                          <option value="moderate">Moderate - 50% refund 14+ days before check-in</option>
                          <option value="strict">Strict - No refunds after booking</option>
                          <option value="custom">Custom - Write your own policy</option>
                        </select>
                      </div>
                      {propertyForm.cancellation_policy === 'custom' && (
                        <div>
                          <label className="block text-sm font-medium mb-2">Custom Cancellation Policy</label>
                          <textarea
                            value={propertyForm.custom_cancellation_policy}
                            onChange={(e) => setPropertyForm({ ...propertyForm, custom_cancellation_policy: e.target.value })}
                            placeholder="Describe your cancellation policy in detail..."
                            rows={3}
                            className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.condition')}</label>
                    <select
                      value={propertyForm.condition}
                      onChange={(e) => setPropertyForm({ ...propertyForm, condition: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-condition-select"
                    >
                      <option value="renovated">{t('property.renovated')}</option>
                      <option value="partially_renovated">{t('property.partiallyRenovated')}</option>
                      <option value="good">{t('property.goodCondition')}</option>
                    </select>
                  </div>
                  )}
                  {propertyForm.rental_type !== 'storage' && (
                  <div>
                    <label className="block text-sm font-medium mb-2">{t('property.numberOfPorches')}</label>
                    <input
                      type="number"
                      value={propertyForm.porches}
                      onChange={(e) => setPropertyForm({ ...propertyForm, porches: parseInt(e.target.value) || 0, sukkah_compatible: (parseInt(e.target.value) || 0) > 0 ? propertyForm.sukkah_compatible : false })}
                      min="0"
                      className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                      data-testid="property-porches-input"
                    />
                    {propertyForm.porches > 0 && (
                      <>
                        <div className="ml-2 mt-2">
                          <label className="block text-sm text-gray-600 mb-1">{t('property.parchSqm')}</label>
                          <input
                            type="number"
                            value={propertyForm.porch_square_meters}
                            onChange={(e) => setPropertyForm({ ...propertyForm, porch_square_meters: parseFloat(e.target.value) || '' })}
                            min="0"
                            step="0.1"
                            className="w-full px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                            data-testid="property-porch-sqm-input"
                          />
                        </div>
                        <label className="flex items-center gap-2 ml-2 mt-2">
                          <input
                            type="checkbox"
                            checked={propertyForm.sukkah_compatible}
                            onChange={(e) => setPropertyForm({ ...propertyForm, sukkah_compatible: e.target.checked })}
                            className="w-4 h-4 rounded border-[#E5E5E5]"
                            data-testid="property-sukkah-checkbox"
                          />
                          <span className="text-sm text-gray-600">{t('property.sukkah')}</span>
                        </label>
                      </>
                    )}
                  </div>
                  )}
                  {propertyForm.rental_type === 'long-term' && (
                    <div>
                      <label className="block text-sm font-medium mb-2">{t('property.furnitureOption')}</label>
                      <select
                        value={propertyForm.furniture_option}
                        onChange={(e) => setPropertyForm({ ...propertyForm, furniture_option: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50"
                        data-testid="property-furniture-select"
                      >
                        <option value="no_furniture">{t('property.noFurniture')}</option>
                        <option value="furniture_package">{t('property.furniturePackage')}</option>
                        <option value="furniture_free">{t('property.furnitureFree')}</option>
                      </select>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={propertyForm.has_elevator}
                        onChange={(e) => setPropertyForm({ ...propertyForm, has_elevator: e.target.checked, is_shabbat_elevator: e.target.checked ? propertyForm.is_shabbat_elevator : false })}
                        className="w-5 h-5 rounded border-[#E5E5E5]"
                        data-testid="property-elevator-checkbox"
                      />
                      <span>{t('property.elevator')}</span>
                    </label>
                    {propertyForm.has_elevator && (
                      <label className="flex items-center gap-2 ml-7">
                        <input
                          type="checkbox"
                          checked={propertyForm.is_shabbat_elevator}
                          onChange={(e) => setPropertyForm({ ...propertyForm, is_shabbat_elevator: e.target.checked })}
                          className="w-4 h-4 rounded border-[#E5E5E5]"
                          data-testid="property-shabbat-elevator-checkbox"
                        />
                        <span className="text-sm text-gray-600">{t('property.shabbatElevator')}</span>
                      </label>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={propertyForm.is_tama}
                        onChange={(e) => setPropertyForm({ ...propertyForm, is_tama: e.target.checked })}
                        className="w-5 h-5 rounded border-[#E5E5E5]"
                        data-testid="property-tama-checkbox"
                      />
                      <span>Tama (Under Construction)</span>
                    </label>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={propertyForm.has_agent_fee}
                        onChange={(e) => setPropertyForm({ ...propertyForm, has_agent_fee: e.target.checked, agent_fee_price: e.target.checked ? propertyForm.agent_fee_price : '' })}
                        className="w-5 h-5 rounded border-[#E5E5E5]"
                        data-testid="property-agent-fee-checkbox"
                      />
                      <span>{t('property.agentFee')}</span>
                    </label>
                    {propertyForm.has_agent_fee && (
                      <div className="ml-7">
                        <div className="flex gap-2">
                          <input
                            type="number"
                            value={propertyForm.agent_fee_price}
                            onChange={(e) => setPropertyForm({ ...propertyForm, agent_fee_price: parseFloat(e.target.value) })}
                            placeholder="Fee amount"
                            min="0"
                            className="flex-1 px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                            data-testid="property-agent-fee-input"
                          />
                          <select
                            value={propertyForm.agent_fee_currency}
                            onChange={(e) => setPropertyForm({ ...propertyForm, agent_fee_currency: e.target.value })}
                            className="px-3 py-2 rounded-lg border border-[#E5E5E5] focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/50 text-sm"
                            data-testid="property-agent-fee-currency-select"
                          >
                            <option value="ILS">₪</option>
                            <option value="USD">$</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {propertyForm.rental_type !== 'storage' && (
                <div>
                  <label className="block text-sm font-medium mb-4">{t('property.amenities')}</label>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      'Central AC / Heating',
                      'In-unit washer and dryer',
                      'Dishwasher',
                      'Walk in Closets',
                      'High Ceilings',
                      'Ensuite Bathroom',
                      'Storage Space',
                      'Heated Floors',
                      'Gym / Fitness center',
                      'Swimming pool (indoor or outdoor)',
                      'Hot tub / Spa',
                      'On-site parking (garage or lot)',
                      'Wi-Fi included'
                    ].map((amenity) => (
                      <label key={amenity} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={propertyForm.amenities.includes(amenity)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPropertyForm({
                                ...propertyForm,
                                amenities: [...propertyForm.amenities, amenity]
                              });
                            } else {
                              setPropertyForm({
                                ...propertyForm,
                                amenities: propertyForm.amenities.filter(a => a !== amenity)
                              });
                            }
                          }}
                          className="w-4 h-4 rounded border-[#E5E5E5]"
                        />
                        <span className="text-sm">{amenity}</span>
                      </label>
                    ))}
                  </div>
                </div>
                )}

                {/* File Upload Section */}
                <div data-testid="file-upload-section">
                  <label className="block text-sm font-medium mb-2">{t('property.photosVideos')}</label>
                  <div
                    className="border-2 border-dashed border-[#E5E5E5] rounded-xl p-6 text-center hover:border-black/30 transition-colors cursor-pointer"
                    onClick={() => document.getElementById('file-upload-input').click()}
                    onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-black/40', 'bg-gray-50'); }}
                    onDragLeave={(e) => { e.preventDefault(); e.currentTarget.classList.remove('border-black/40', 'bg-gray-50'); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('border-black/40', 'bg-gray-50');
                      const dt = new DataTransfer();
                      Array.from(e.dataTransfer.files).forEach(f => dt.items.add(f));
                      const input = document.getElementById('file-upload-input');
                      input.files = dt.files;
                      input.dispatchEvent(new Event('change', { bubbles: true }));
                    }}
                    data-testid="file-drop-zone"
                  >
                    <Upload size={32} className="mx-auto mb-2 text-gray-400" />
                    <p className="text-sm text-gray-600 mb-1">{t('property.dragDrop')}</p>
                    <p className="text-xs text-gray-400">{t('property.fileTypes')}</p>
                    <input
                      id="file-upload-input"
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                      className="hidden"
                      onChange={handleFileUpload}
                      data-testid="file-upload-input"
                    />
                  </div>

                  {uploading && (
                    <div className="mt-3" data-testid="upload-progress">
                      <div className="flex items-center gap-2 text-sm text-gray-600 mb-1">
                        <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
                        {t('property.uploading')} {uploadProgress}%
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-black transition-all" style={{ width: `${uploadProgress}%` }}></div>
                      </div>
                    </div>
                  )}

                  {uploadedFiles.length > 0 && (
                    <div className="mt-4 grid grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3" data-testid="uploaded-files-grid">
                      {uploadedFiles.map((file) => (
                        <div key={file.filename} className="relative group rounded-lg overflow-hidden border border-[#E5E5E5]" data-testid={`uploaded-file-${file.filename}`}>
                          {file.file_type === 'image' ? (
                            <img src={`${API.replace('/api', '')}${file.url}`} alt={file.original_name} className="w-full h-20 object-cover" />
                          ) : (
                            <div className="w-full h-20 bg-gray-900 flex items-center justify-center">
                              <Film size={24} className="text-white" />
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeUploadedFile(file)}
                            className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                            data-testid={`remove-file-${file.filename}`}
                          >
                            <X size={14} />
                          </button>
                          <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-1 py-0.5">
                            <div className="flex items-center gap-1">
                              {file.file_type === 'image' ? <Image size={10} className="text-white" /> : <Film size={10} className="text-white" />}
                              <span className="text-[10px] text-white truncate">{file.original_name}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <button type="submit" className="flex-1 primary-btn" data-testid="submit-property-button">
                    {editingPropertyId ? t('dashboard.saveChanges') : t('dashboard.addProperty')}
                  </button>
                  <button type="button" onClick={() => { setShowAddProperty(false); setEditingPropertyId(null); }} className="flex-1 secondary-btn" data-testid="cancel-add-property-button">
                    {t('dashboard.cancel')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {user && user.role !== 'renter' && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold mb-6" style={{ fontFamily: 'Playfair Display' }}>{t('dashboard.myProperties')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property) => (
                <div key={property.id} className="bg-white rounded-2xl border border-[#E5E5E5] overflow-hidden" data-testid={`dashboard-property-${property.id}`}>
                  <div className="h-48 bg-gray-200" style={{
                    backgroundImage: `url(${property.images?.[0] ? (property.images[0].startsWith('/api') ? `${API.replace('/api', '')}${property.images[0]}` : property.images[0]) : 'https://images.pexels.com/photos/1669799/pexels-photo-1669799.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940'})`,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                  }}></div>
                  <div className="p-4">
                    <h3 className="text-lg font-bold mb-2">{property.title}</h3>
                    <p className="text-gray-600 text-sm mb-4">{property.area}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-xl font-bold" style={{ color: '#1E6A6A' }}>
                        {property.currency === 'USD' ? '$' : '₪'}{property.monthly_price || property.nightly_price}
                      </span>
                      <div className="flex gap-2">
                        <button onClick={() => startEditProperty(property)} className="p-2 hover:bg-gray-100 rounded-lg" data-testid={`edit-property-${property.id}`}>
                          <Edit size={18} />
                        </button>
                        <button onClick={() => navigate(`/property/${property.id}`)} className="p-2 hover:bg-gray-100 rounded-lg" data-testid={`view-property-${property.id}`}>
                          <Eye size={18} />
                        </button>
                        <button onClick={() => handleDeleteProperty(property.id)} className="p-2 hover:bg-red-50 rounded-lg text-red-600" data-testid={`delete-property-${property.id}`}>
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                    {/* Contract Upload for Long-Term/Short-Term */}
                    {(property.rental_type === 'long-term' || property.rental_type === 'short-term') && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-700">Property Contract</span>
                          {property.contract_url && (
                            <a
                              href={`${API.replace('/api', '')}${property.contract_url}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-[#1E6A6A] hover:text-[#D4AF37] flex items-center gap-1"
                            >
                              <FileText size={12} /> View
                            </a>
                          )}
                        </div>
                        <label className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all border border-dashed"
                          style={{ borderColor: property.contract_url ? '#D4AF37' : '#ccc', backgroundColor: property.contract_url ? '#f5f5f0' : 'transparent', color: property.contract_url ? '#1E6A6A' : '#666' }}
                        >
                          <Upload size={14} />
                          {property.contract_url ? 'Replace Contract' : 'Upload Contract'}
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                            className="hidden"
                            onChange={(e) => handleContractUpload(property.id, e.target.files[0], e.target)}
                            data-testid={`upload-contract-${property.id}`}
                          />
                        </label>
                        {property.contract_url && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleDeleteContract(property.id);
                            }}
                            className="w-full mt-2 text-xs text-red-500 hover:text-red-700 py-2 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                            data-testid={`delete-contract-${property.id}`}
                          >
                            Delete Contract
                          </button>
                        )}
                      </div>
                    )}
                    {/* iCal Sync for Vacation Properties */}
                    {property.rental_type === 'vacation' && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <button
                          onClick={() => openIcalPanel(property.id)}
                          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all"
                          style={{ backgroundColor: icalPanel === property.id ? '#1E6A6A' : '#f5f5f0', color: icalPanel === property.id ? '#D4AF37' : '#1E6A6A' }}
                          data-testid={`ical-toggle-${property.id}`}
                        >
                          <CalendarSync size={15} />
                          {t('property.ical.title')}
                          {property.ical_urls?.length > 0 && <span className="w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold bg-[#D4AF37] text-white">{property.ical_urls.length}</span>}
                        </button>

                        {icalPanel === property.id && (
                          <div className="mt-3 space-y-3" data-testid={`ical-panel-${property.id}`}>
                            <p className="text-xs text-gray-500">{t('property.ical.subtitle')}</p>

                            {/* Add URL */}
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={icalUrl}
                                onChange={(e) => setIcalUrl(e.target.value)}
                                placeholder={t('property.ical.urlPlaceholder')}
                                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]"
                                data-testid={`ical-url-input-${property.id}`}
                              />
                              <button
                                onClick={() => addIcalUrl(property.id)}
                                disabled={icalSyncing || !icalUrl.trim()}
                                className="px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
                                style={{ backgroundColor: '#1E6A6A' }}
                                data-testid={`ical-add-btn-${property.id}`}
                              >
                                {icalSyncing ? t('property.ical.syncing') : t('property.ical.add')}
                              </button>
                            </div>

                            {/* Connected Calendars */}
                            {property.ical_urls?.length > 0 ? (
                              <div className="space-y-1.5">
                                {property.ical_urls.map((url, i) => (
                                  <div key={url} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 text-xs">
                                    <Link2 size={12} className="text-[#D4AF37] shrink-0" />
                                    <span className="flex-1 truncate text-gray-600">{url}</span>
                                    <button onClick={() => removeIcalUrl(property.id, url)} className="text-red-400 hover:text-red-600 shrink-0" data-testid={`ical-remove-${i}`}>
                                      <X size={14} />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 text-center py-2">{t('property.ical.noUrls')}</p>
                            )}

                            {/* Sync Status */}
                            {icalData[property.id] && (
                              <div className="flex items-center justify-between text-xs text-gray-500">
                                <span>{icalData[property.id].external?.length || 0} {t('property.ical.blockedDates')}</span>
                                <button onClick={() => manualSync(property.id)} disabled={icalSyncing} className="flex items-center gap-1 text-[#D4AF37] hover:underline disabled:opacity-40" data-testid={`ical-sync-btn-${property.id}`}>
                                  <RefreshCw size={12} className={icalSyncing ? 'animate-spin' : ''} />
                                  {t('property.ical.autoSync')}
                                </button>
                              </div>
                            )}

                            {/* Export */}
                            <div className="pt-2 border-t border-gray-100">
                              <p className="text-xs font-medium text-gray-700 mb-1">{t('property.ical.exportTitle')}</p>
                              <p className="text-[11px] text-gray-400 mb-2">{t('property.ical.exportDesc')}</p>
                              <button
                                onClick={() => copyExportUrl(property.id)}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm hover:border-[#D4AF37] transition-colors"
                                data-testid={`ical-export-btn-${property.id}`}
                              >
                                {copiedExport ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-gray-500" />}
                                <span className="text-gray-700">{copiedExport ? t('property.ical.copied') : t('property.ical.copyUrl')}</span>
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
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