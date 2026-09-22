import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Ban, CheckCircle, Trash2, LogIn, Mail, RotateCcw } from 'lucide-react';
import { API, AuthContext } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';

export const UsersTab = ({ token, onStatsChange, prefilter }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { impersonate } = React.useContext(AuthContext);
  const headers = { Authorization: `Bearer ${token}` };

  const { data: users, refresh: fetchUsers } = useApiSWR(
    `${API}/admin/users`, token, { initial: [] }
  );
  // Tab is conditionally mounted in AdminDashboard, so any deep-linked
  // `prefilter` (e.g. from the Quick Add Owner shortcut) takes effect via
  // the initial-state argument — no useEffect needed.
  const [searchTerm, setSearchTerm] = useState(prefilter || '');
  // Deleted accounts can come back (routes/admin/core.py keeps a snapshot).
  // Listed here because the Undo on the toast lasts seconds, and the
  // realisation that it was the wrong account can take a day.
  const { data: deletedData, refresh: fetchDeleted } = useApiSWR(
    `${API}/admin/users/deleted`, token, { initial: { deleted: [] } }
  );
  const deleted = deletedData?.deleted || [];
  const [restoringId, setRestoringId] = useState('');

  const restoreUser = async (snapshotId) => {
    setRestoringId(snapshotId);
    try {
      const res = await axios.post(`${API}/admin/users/deleted/${snapshotId}/restore`, {}, { headers });
      const n = Object.values(res.data?.restored || {}).reduce((a, b) => a + b, 0);
      toast.success(t('admin.userRestored', 'The account is back, with {{count}} of their records. They sign in with Google or use Forgot password.', { count: n }), { duration: 10000 });
      fetchUsers();
      fetchDeleted();
      notifyStatsChange();
    } catch (e) {
      toast.error(e.response?.data?.detail || t('admin.restoreFailed', 'Could not restore this account'));
    } finally {
      setRestoringId('');
    }
  };

  const notifyStatsChange = () => { if (onStatsChange) onStatsChange(); };

  const toggleUserStatus = async (userId) => {
    try {
      const res = await axios.put(`${API}/admin/users/${userId}/status`, {}, { headers });
      toast.success(res.data.message);
      fetchUsers();
      notifyStatsChange();
    } catch (e) { toast.error('Failed to update user'); }
  };

  const deleteUser = (userId) => {
    toast.custom((tid) => (
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-4 w-80">
        <p className="text-sm font-semibold text-gray-800 mb-1">{t('admin.deleteUserTitle')}</p>
        <p className="text-xs text-gray-500 mb-3">{t('admin.deleteUserDesc')}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => toast.dismiss(tid)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-100">
            {t('admin.cancel')}
          </button>
          <button
            onClick={async () => {
              toast.dismiss(tid);
              try {
                const res = await axios.delete(`${API}/admin/users/${userId}`, { headers });
                const snap = res.data?.snapshot_id;
                toast.success(t('admin.userDeletedKept', 'Account deleted. Bookings, contracts, orders, reviews and chats with other people were kept.'), {
                  duration: 15000,
                  action: snap ? { label: t('admin.undo', 'Undo'), onClick: () => restoreUser(snap) } : undefined,
                });
                fetchUsers();
                fetchDeleted();
                notifyStatsChange();
              } catch (e) { toast.error(e.response?.data?.detail || 'Failed to delete user'); }
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-500 hover:bg-red-600"
            data-testid={`confirm-delete-user-${userId}`}
          >
            {t('admin.deleteAction')}
          </button>
        </div>
      </div>
    ), { duration: 10000 });
  };

  const filteredUsers = users.filter(u =>
    !searchTerm || u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const impersonateUser = async (u) => {
    try {
      const res = await axios.post(`${API}/admin/users/${u.id}/impersonate`, {}, { headers });
      // impersonate() stashes the current admin token so the banner can
      // offer a one-click "Return to admin". Then we jump to /dashboard —
      // exactly what the target user would see after their own login.
      impersonate(res.data.token, res.data.user);
      toast.success(`Now viewing as ${u.name || u.email}`);
      navigate('/dashboard');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Impersonation failed');
    }
  };

  // Re-send the "Set your password" email to an imported owner who
  // hasn't finished onboarding. Backend refuses if the owner already
  // set their password, so this button is safe even without extra
  // client-side gating — but we still hide it in the row render below
  // to keep the UI honest.
  const [resendingId, setResendingId] = useState('');
  const resendSetPassword = async (u) => {
    setResendingId(u.id);
    try {
      const res = await axios.post(`${API}/admin/users/${u.id}/resend-set-password`, {}, { headers });
      toast.success(res.data.message || 'Email re-sent');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to re-send email');
    } finally {
      setResendingId('');
    }
  };

  return (
    <div data-testid="admin-users-section">
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder={t('admin.searchUsers')}
            className="w-full ps-9 pe-4 py-2 rounded-lg border border-[#E5E5E5] text-sm focus:outline-none focus:ring-2 focus:ring-black/20"
            data-testid="users-search-input"
          />
        </div>
        <span className="text-sm text-gray-500">{t('admin.usersCount', { count: filteredUsers.length })}</span>
      </div>
      <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colName')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colEmail')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colRole')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.status')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colJoined')}</th>
              <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.actions')}</th>
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
                      <button onClick={() => impersonateUser(u)} className="p-1.5 rounded hover:bg-blue-50 text-blue-600" title={t('admin.impersonate', 'Log in as this user')} data-testid={`impersonate-user-${u.id}`}>
                        <LogIn size={16} />
                      </button>
                      {/* Resend "Set your password" email — only visible
                          for admin-imported owners who haven't yet
                          completed onboarding. Keeps the row compact for
                          the 95%+ of users this doesn't apply to. */}
                      {u.admin_imported && !u.password_set_at && (
                        <button
                          onClick={() => resendSetPassword(u)}
                          disabled={resendingId === u.id}
                          className="p-1.5 rounded hover:bg-amber-50 text-amber-600 disabled:opacity-50"
                          title={t('admin.resendSetPassword', 'Re-send set-password email')}
                          data-testid={`resend-setpwd-${u.id}`}
                        >
                          <Mail size={16} />
                        </button>
                      )}
                      <button onClick={() => toggleUserStatus(u.id)} className="p-1.5 rounded hover:bg-gray-100" title={(u.status || 'active') === 'active' ? t('admin.block') : t('admin.unblock')} data-testid={`toggle-user-${u.id}`}>
                        {(u.status || 'active') === 'active' ? <Ban size={16} className="text-orange-500" /> : <CheckCircle size={16} className="text-green-500" />}
                      </button>
                      <button onClick={() => deleteUser(u.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title={t('admin.deleteTooltip')} data-testid={`delete-user-${u.id}`}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                  {u.role === 'admin' && <span className="text-xs text-gray-400">{t('admin.protected')}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && <p className="text-center text-gray-400 py-8 text-sm">{t('admin.noUsers')}</p>}
      </div>

      {deleted.length > 0 && (
        <section className="mt-8" data-testid="deleted-users">
          <h3 className="text-sm font-semibold text-gray-800 mb-1">{t('admin.recentlyDeleted', 'Recently deleted')}</h3>
          <p className="text-xs text-gray-500 mb-3">
            {t('admin.recentlyDeletedDesc', 'Restoring brings back the account and everything that was only theirs. They sign in with Google or use Forgot password; uploaded contract files do not come back.')}
          </p>
          <div className="bg-white rounded-xl border border-[var(--brand-border)] divide-y divide-[var(--brand-border)]">
            {deleted.map((d) => (
              <div key={d.id} className="flex items-center gap-3 px-5 py-3 flex-wrap" data-testid={`deleted-user-${d.id}`}>
                <div className="flex-1 min-w-[200px]">
                  <div className="text-sm font-medium" dir="auto">{d.name || d.email}</div>
                  <div className="text-xs text-gray-500">
                    {d.email} · {t('admin.deletedOn', 'deleted {{date}}', { date: d.deleted_at ? new Date(d.deleted_at).toLocaleString() : '' })} · {t('admin.recordsCount', '{{count}} records', { count: d.records })}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => restoreUser(d.id)}
                  disabled={restoringId === d.id}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--brand-border)] hover:bg-gray-50 disabled:opacity-50"
                  data-testid={`restore-user-${d.id}`}
                >
                  <RotateCcw size={13} /> {t('admin.restore', 'Restore')}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default UsersTab;
