import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { X, Copy, AlertTriangle, Trash2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Admin-only modal that surfaces groups of duplicate listings.
 *
 * The backend defines a duplicate as `(owner_id, normalized address, rental_type)` —
 * cross-rental-type copies of the same flat are intentionally allowed.
 *
 * This screen exists for the one-time cleanup of dupes that landed in
 * the DB *before* we shipped the dedupe gate. Going forward the create
 * endpoint hard-blocks 409 on the same key.
 */
const DuplicatesModal = ({ token, onClose, onDeleted }) => {
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);

  const fetchGroups = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/admin/duplicates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGroups(res.data.groups || []);
    } catch (e) {
      toast.error('Failed to load duplicates');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { fetchGroups(); /* eslint-disable-next-line */ }, []);

  const deleteOne = async (propertyId) => {
    if (!window.confirm('Delete this listing? This cannot be undone.')) return;
    try {
      await axios.delete(`${API}/properties/${propertyId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Listing deleted');
      onDeleted?.();
      fetchGroups();
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/60 flex items-start justify-center p-4 overflow-y-auto" data-testid="duplicates-modal">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-xl my-8">
        <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-200 px-5 py-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-amber-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg leading-tight">Duplicate listings</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Same owner + address + rental type. Cross-type copies (long-term + vacation) are intentionally allowed.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-100"
            data-testid="duplicates-close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {loading ? (
            <p className="text-sm text-gray-500 text-center py-8">Loading…</p>
          ) : groups.length === 0 ? (
            <div className="text-center py-10">
              <Copy size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-semibold text-gray-700">No duplicates found</p>
              <p className="text-xs text-gray-500 mt-1">Every owner has unique address + rental_type combinations.</p>
            </div>
          ) : (
            groups.map((g, gi) => (
              <div key={gi} className="border border-amber-200 rounded-xl overflow-hidden" data-testid={`dup-group-${gi}`}>
                <div className="bg-amber-50 px-4 py-2.5 border-b border-amber-200">
                  <p className="text-sm font-semibold text-gray-800 truncate">
                    {g.owner_name} <span className="text-gray-400 font-normal">·</span>{' '}
                    <span className="text-gray-600">{g.owner_email}</span>
                  </p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    <span className="font-medium">{g.rental_type}</span> · {g.address}
                  </p>
                </div>
                <div className="divide-y divide-gray-100">
                  {g.properties.map((p) => (
                    <div key={p.id} className="px-4 py-2.5 flex items-center gap-3" data-testid={`dup-listing-${p.id}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.title || '—'}</p>
                        <p className="text-[11px] text-gray-500">
                          ID: <span className="font-mono">{p.id.slice(0, 8)}</span>
                          {p.created_at && ` · created ${p.created_at.slice(0, 10)}`}
                        </p>
                      </div>
                      <a
                        href={`/property/${p.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-[#1E6A6A] hover:underline"
                      >
                        view
                      </a>
                      <button
                        onClick={() => deleteOne(p.id)}
                        className="p-1.5 rounded text-red-500 hover:bg-red-50"
                        title="Delete this listing"
                        data-testid={`dup-delete-${p.id}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DuplicatesModal;
