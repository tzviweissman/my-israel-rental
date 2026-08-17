import React, { useContext, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import { Plus, Home } from 'lucide-react';
import { toast } from 'sonner';
import { AuthContext } from '../../App';

import SubleaseForm from './sublease/SubleaseForm';
import SubleaseListItem from './sublease/SubleaseListItem';

const EMPTY_FORM = {
  property_id: '',
  manual: false,           // true when subleasing a property booked elsewhere
  // Manual-only fields (ignored when property_id is set)
  title: '',
  description: '',
  area: '',
  address: '',
  bedrooms: '',
  bathrooms: '',
  available_from: '',
  available_to: '',
  price: '',
  price_type: 'per_night',
  currency: 'ILS',
  bedrooms_available: '',
  notes: '',
  holiday_tags: [],
};

/**
 * Renter "My Subleases" dashboard tab.
 * Owns all state + API calls. Delegates the form panel + list rows to
 * dedicated sublease/ components.
 */
const SubleasesTab = ({ API, token }) => {
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [myBookings, setMyBookings] = useState([]);
  const [mySubleases, setMySubleases] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFor, setUploadingFor] = useState(null);
  const [copiedSignLink, setCopiedSignLink] = useState(null);
  // Single hidden file input rendered once outside the list. We track which
  // sublease triggered it so the onChange handler uploads to the correct row.
  const [uploadTargetId, setUploadTargetId] = useState(null);
  const fileRef = useRef(null);

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchMySubleases = async () => {
    try {
      const res = await axios.get(`${API}/my-subleases`, authHeaders);
      setMySubleases(res.data || []);
    } catch (err) {
      console.error('Failed to fetch subleases', err);
    }
  };

  const fetchRenterBookings = async () => {
    try {
      const res = await axios.get(`${API}/bookings`, authHeaders);
      // For the sublease picker we only want their OWN active rentals
      // (pending|confirmed), not cancelled/expired ones — mirroring the
      // backend's create_sublease guard.
      const eligible = (res.data || []).filter(
        (b) =>
          b.renter_id === user?.id &&
          !b.sublease_id &&
          (b.status === 'pending' || b.status === 'confirmed'),
      );
      const bookingsWithProps = await Promise.all(
        eligible.map(async (b) => {
          try {
            const propRes = await axios.get(`${API}/properties/${b.property_id}`);
            return { ...b, property: propRes.data };
          } catch {
            return { ...b, property: null };
          }
        }),
      );
      // De-duplicate by property — a renter who's stayed at the same place
      // multiple times only needs one row in the picker. Keep the most
      // recent booking so the dates feel current.
      const byProperty = new Map();
      for (const b of bookingsWithProps) {
        if (!b.property) continue;
        const existing = byProperty.get(b.property_id);
        if (!existing || (b.check_in || '') > (existing.check_in || '')) {
          byProperty.set(b.property_id, b);
        }
      }
      setMyBookings(Array.from(byProperty.values()));
    } catch (err) {
      console.error('Failed to fetch bookings', err);
    }
  };

  useEffect(() => {
    fetchMySubleases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => setForm(EMPTY_FORM);

  const openForm = () => {
    if (!showForm) fetchRenterBookings();
    setShowForm(!showForm);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    const isManual = form.manual === true;
    if (!form.available_from || !form.available_to || !form.price) {
      toast.error('Please fill in all required fields.');
      return;
    }
    if (!isManual && !form.property_id) {
      toast.error('Please select a property first.');
      return;
    }
    if (isManual && (!form.title?.trim() || !form.area?.trim())) {
      toast.error('Title and area are required for manual subleases.');
      return;
    }
    setSubmitting(true);
    try {
      // Only these fields are persisted by the create/update endpoints
      const payload = {
        available_from: form.available_from,
        available_to: form.available_to,
        price: parseFloat(form.price),
        price_type: form.price_type,
        currency: form.currency,
        holiday_tags: form.holiday_tags,
        bedrooms_available: form.bedrooms_available ? parseInt(form.bedrooms_available, 10) : null,
        notes: form.notes,
      };
      if (editingId) {
        await axios.put(`${API}/subleases/${editingId}`, payload, authHeaders);
        toast.success('Sublease updated!');
      } else if (isManual) {
        // Manual sublease — renter booked elsewhere, supply listing details
        await axios.post(
          `${API}/subleases`,
          {
            ...payload,
            title: form.title,
            description: form.description,
            area: form.area,
            address: form.address,
            bedrooms: form.bedrooms ? parseInt(form.bedrooms, 10) : null,
            bathrooms: form.bathrooms ? parseInt(form.bathrooms, 10) : null,
          },
          authHeaders,
        );
        toast.success('Sublease listed successfully!');
      } else {
        await axios.post(`${API}/subleases`, { ...payload, property_id: form.property_id }, authHeaders);
        toast.success('Sublease listed successfully!');
      }
      resetForm();
      setEditingId(null);
      setShowForm(false);
      fetchMySubleases();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save sublease.');
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (sub) => {
    setEditingId(sub.id);
    setForm({
      property_id: sub.property_id || sub.original_property_id || '',
      available_from: sub.available_from || '',
      available_to: sub.available_to || '',
      price: sub.price != null ? String(sub.price) : '',
      price_type: sub.price_type || 'per_night',
      currency: sub.currency || 'ILS',
      bedrooms_available: sub.bedrooms_available != null ? String(sub.bedrooms_available) : '',
      notes: sub.notes || '',
      holiday_tags: sub.holiday_tags || [],
    });
    setShowForm(true);
    setTimeout(() => {
      const el = document.querySelector('[data-testid="sublease-form-container"]');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const cancelEdit = () => {
    setEditingId(null);
    resetForm();
    setShowForm(false);
  };

  // sonner custom toast instead of window.confirm (blocked in iframe)
  const confirmDelete = (subleaseId) => {
    toast.custom(
      (tid) => (
        <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
          <p className="text-sm font-semibold text-gray-800 mb-1">{t('sublease.removeListing')}</p>
          <p className="text-xs text-gray-500 mb-3">{t('sublease.cannotUndo')}</p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => toast.dismiss(tid)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100"
            >
              {t('sublease.cancel')}
            </button>
            <button
              onClick={() => {
                toast.dismiss(tid);
                performDelete(subleaseId);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600"
              data-testid={`confirm-delete-sublease-${subleaseId}`}
            >
              {t('sublease.remove')}
            </button>
          </div>
        </div>
      ),
      { duration: 10000 },
    );
  };

  const performDelete = async (subleaseId) => {
    try {
      await axios.delete(`${API}/subleases/${subleaseId}`, authHeaders);
      toast.success('Sublease removed.');
      fetchMySubleases();
    } catch (err) {
      toast.error('Failed to remove sublease.');
    }
  };

  const toggleActive = async (subleaseId, currentActive) => {
    try {
      await axios.put(`${API}/subleases/${subleaseId}`, { active: !currentActive }, authHeaders);
      toast.success(!currentActive ? 'Sublease reactivated' : 'Sublease paused');
      fetchMySubleases();
    } catch (err) {
      toast.error('Failed to update sublease.');
    }
  };

  const handleContractUpload = async (subleaseId, file) => {
    if (!file) return;
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'image/jpeg',
      'image/png',
      'image/webp',
    ];
    if (!allowed.includes(file.type)) {
      toast.error('Please upload a PDF, DOCX, JPG, PNG, or WebP file.');
      return;
    }
    setUploadingFor(subleaseId);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await axios.post(`${API}/subleases/${subleaseId}/contract`, formData, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      toast.success('Contract uploaded! Share the signing link with your sublessee.');
      fetchMySubleases();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to upload contract.');
    } finally {
      setUploadingFor(null);
    }
  };

  const triggerUpload = (subleaseId) => {
    setUploadTargetId(subleaseId);
    fileRef.current?.click();
  };

  const copySignLink = (signToken) => {
    const link = `${window.location.origin}/sign/${signToken}`;
    navigator.clipboard.writeText(link);
    setCopiedSignLink(signToken);
    toast.success('Signing link copied to clipboard!');
    setTimeout(() => setCopiedSignLink(null), 3000);
  };

  const imageUrl = (images) => {
    const first = images?.[0];
    if (!first) return '';
    return first.startsWith('/api') ? `${API.replace('/api', '')}${first}` : first;
  };

  return (
    <div className="space-y-6" data-testid="subleases-tab">
      {/* Single shared file picker — triggered per row via uploadTargetId */}
      <input
        type="file"
        ref={fileRef}
        className="hidden"
        accept=".pdf,.docx,.jpg,.jpeg,.png,.webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadTargetId) handleContractUpload(uploadTargetId, file);
          e.target.value = '';
          setUploadTargetId(null);
        }}
      />
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-[var(--brand-primary)] to-[#267a7a] px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-sm">
                <Home size={24} className="text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Plus size={20} className="text-white" />
                  {editingId ? t('sublease.editYour') : t('sublease.subleaseYour')}
                </h3>
                <p className="text-white/80 text-sm">
                  {editingId
                    ? t('sublease.updateDetailsCta')
                    : t('sublease.postYourRentalCta')}
                </p>
              </div>
            </div>
            <button
              onClick={editingId ? cancelEdit : openForm}
              className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-sm font-medium transition-all backdrop-blur-sm"
              data-testid="create-sublease-btn"
            >
              {showForm ? t('sublease.cancel') : t('sublease.newSublease')}
            </button>
          </div>
        </div>

        <div className="p-6">
          {showForm && (
            <div className="mb-6 bg-gray-50 rounded-xl p-5">
              <SubleaseForm
                form={form}
                setForm={setForm}
                editingId={editingId}
                myBookings={myBookings}
                mySubleases={mySubleases}
                submitting={submitting}
                onSubmit={handleCreate}
                imageUrl={imageUrl}
              />
            </div>
          )}

          {mySubleases.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold text-gray-700">{t('sublease.listingsTitle')}</h4>
              {mySubleases.map((sub) => (
                <SubleaseListItem
                  key={sub.id}
                  sub={sub}
                  imageUrl={imageUrl}
                  uploadingFor={uploadingFor}
                  copiedSignLink={copiedSignLink}
                  onEdit={startEdit}
                  onToggleActive={toggleActive}
                  onConfirmDelete={confirmDelete}
                  onUpload={triggerUpload}
                  onCopySignLink={copySignLink}
                />
              ))}
            </div>
          ) : !showForm ? (
            <div className="text-center py-6">
              <Home size={32} className="mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 text-sm font-medium">{t('sublease.noActive')}</p>
              <p className="text-gray-400 text-xs mt-1">
                {t('sublease.clickNewToPost')}
              </p>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default SubleasesTab;
