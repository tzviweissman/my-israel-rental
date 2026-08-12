/**
 * MyRequestsTab — the seeker's own posts on the Requests board.
 *
 * Every status, not just open: an expired request is renewable and a
 * found one is history worth keeping, so hiding either would make the
 * board feel like it had eaten them.
 *
 * `contact_count` is surfaced here and nowhere else. It is the one number
 * that tells a seeker their post is working — chats opened about it —
 * before anyone has actually written.
 */
import React, { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  Loader2, Plus, RefreshCw, CheckCircle2, Trash2, MessageCircle, Clock, Home, Wrench,
} from 'lucide-react';

const STATUS_PILL = {
  open: { bg: '#E3F3EA', fg: '#1F8A50' },
  found: { bg: '#F3F4F6', fg: '#6B7280' },
  expired: { bg: '#FEF3C7', fg: '#A16207' },
  closed: { bg: '#F3F4F6', fg: '#6B7280' },
};

const daysUntil = (iso) => {
  if (!iso) return null;
  const ms = new Date(iso) - new Date();
  return Number.isNaN(ms) ? null : Math.max(0, Math.ceil(ms / 86400000));
};

const MyRequestsTab = ({ API, token }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    axios.get(`${API}/marketplace/my-requests`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setRequests(r.data || []))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  }, [API, token]);

  useEffect(load, [load]);

  const act = async (id, path, msg) => {
    setBusyId(id);
    try {
      await axios.post(`${API}/marketplace/requests/${id}/${path}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(msg);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('requests.actionFailed', 'That did not work'));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id) => {
    // Deleting is the one irreversible action here, and the request may
    // already have chats attached to it, so it asks first.
    if (!window.confirm(t('requests.confirmDelete', 'Delete this request? This cannot be undone.'))) return;
    setBusyId(id);
    try {
      await axios.delete(`${API}/marketplace/requests/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success(t('requests.deleted', 'Request deleted'));
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || t('requests.actionFailed', 'That did not work'));
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" data-testid="my-requests-loading">
        <Loader2 className="animate-spin" size={26} style={{ color: 'var(--brand-primary)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="my-requests-tab">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white border border-gray-200 rounded-2xl p-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">{t('requests.myTitle', 'My requests')}</h2>
          <p className="text-xs text-gray-500 mt-1">
            {t('requests.myCount', '{{n}} posted', { n: requests.length })}
          </p>
        </div>
        <button
          onClick={() => navigate('/requests/post')}
          className="btn-blue-solid inline-flex items-center gap-1.5 !py-2.5 !px-4 !text-sm"
          data-testid="my-requests-new"
        >
          <Plus size={14} />{t('requests.postCta', 'Post a request')}
        </button>
      </div>

      {requests.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center" data-testid="my-requests-empty">
          <p className="text-gray-700 font-semibold mb-2">
            {t('requests.myEmptyTitle', "You haven't posted a request yet")}
          </p>
          <p className="text-gray-500 text-sm mb-5">
            {t('requests.myEmptyBody', 'Tell owners and pros what you are looking for, and let them come to you.')}
          </p>
          <button onClick={() => navigate('/requests/post')} className="btn-blue-solid" data-testid="my-requests-empty-cta">
            {t('requests.postCta', 'Post a request')}
          </button>
        </div>
      ) : (
        requests.map((r) => {
          const pill = STATUS_PILL[r.status] || STATUS_PILL.closed;
          const expiresIn = daysUntil(r.expires_at);
          const isRental = r.request_type === 'rental';
          return (
            <div
              key={r.id}
              className="bg-white border border-gray-200 rounded-2xl p-5"
              data-testid={`my-request-${r.id}`}
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`rc-badge ${isRental ? 'rc-badge-rental' : 'rc-badge-service'}`}>
                  {isRental ? <Home size={11} /> : <Wrench size={11} />}
                  {isRental ? t('requests.rental', 'Rental') : t('requests.service', 'Service')}
                </span>
                <span
                  className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase"
                  style={{ background: pill.bg, color: pill.fg }}
                  data-testid={`my-request-status-${r.id}`}
                >
                  {t(`requests.status_${r.status}`, r.status)}
                </span>
                {r.status === 'open' && expiresIn != null && (
                  <span className="text-xs text-gray-500 inline-flex items-center gap-1">
                    <Clock size={12} />
                    {t('requests.expiresIn', 'expires in {{n}} days', { n: expiresIn })}
                  </span>
                )}
                {r.renewed_count > 0 && (
                  <span className="text-xs text-gray-400">
                    {t('requests.renewedTimes', 'renewed {{n}}x', { n: r.renewed_count })}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={() => navigate(`/requests/${r.id}`)}
                className="text-start block"
                data-testid={`my-request-open-${r.id}`}
              >
                <h3 className="font-bold text-gray-900 hover:underline">{r.title}</h3>
              </button>
              <p className="text-sm text-gray-500 mt-1">{r.area}</p>

              <div className="flex items-center gap-1.5 text-sm text-gray-700 mt-3">
                <MessageCircle size={14} style={{ color: 'var(--brand-primary)' }} />
                <b>{r.contact_count || 0}</b>
                <span className="text-gray-500">
                  {t('requests.chatsOpened', 'chats opened about this')}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-100">
                {r.status !== 'found' && (
                  <button
                    onClick={() => act(r.id, 'found', t('requests.markedFound', 'Marked as found'))}
                    disabled={busyId === r.id}
                    className="px-3 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60 inline-flex items-center gap-1.5"
                    style={{ background: 'var(--brand-primary)' }}
                    data-testid={`my-request-found-${r.id}`}
                  >
                    <CheckCircle2 size={13} />{t('requests.markFound', 'I found it')}
                  </button>
                )}
                {r.status !== 'found' && (
                  <button
                    onClick={() => act(r.id, 'renew', t('requests.renewed', 'Renewed for another 30 days'))}
                    disabled={busyId === r.id}
                    className="px-3 py-2 rounded-lg text-xs font-semibold border border-gray-300 text-gray-700 disabled:opacity-60 inline-flex items-center gap-1.5"
                    data-testid={`my-request-renew-${r.id}`}
                  >
                    <RefreshCw size={13} />{t('requests.renew', 'Renew')}
                  </button>
                )}
                <button
                  onClick={() => remove(r.id)}
                  disabled={busyId === r.id}
                  className="ms-auto px-3 py-2 rounded-lg text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-60 inline-flex items-center gap-1.5"
                  data-testid={`my-request-delete-${r.id}`}
                >
                  <Trash2 size={13} />{t('common.delete', 'Delete')}
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
};

export default MyRequestsTab;
