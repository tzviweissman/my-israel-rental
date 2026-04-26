import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Search, Ban, CheckCircle, Trash2 } from 'lucide-react';
import { API } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';

/**
 * Super Admin → Users tab.
 * Owns its own state: users list, search, row actions.
 * Calls onStatsChange after mutations so the Overview tab counts refresh.
 */
export const UsersTab = ({ token, onStatsChange }) => {
  const headers = { Authorization: `Bearer ${token}` };

  const { data: users, refresh: fetchUsers } = useApiSWR(
    `${API}/admin/users`, token, { initial: [] }
  );
  const [searchTerm, setSearchTerm] = useState('');

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
                notifyStatsChange();
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

  const filteredUsers = users.filter(u =>
    !searchTerm || u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
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
  );
};

export default UsersTab;
