/**
 * Admin UI for managing neighborhood aliases.
 *
 * An "alias" maps a user-typed area variant (street name, common typo,
 * colloquialism) to a canonical neighborhood — e.g. "Levi Eshkol" →
 * "Ramat Eshkol". Once added here, every property search (the public
 * filter dropdown, Smart Lists, saved-search alerts) will treat the
 * alias as the canonical neighborhood without a redeploy.
 *
 * Embedded inside SmartListsTab as a collapsible card — that's where
 * the admin will first notice missing entries in the location dropdown,
 * so fixing them happens in-context.
 */
import React, { useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Plus, Trash2, ArrowRight, Tags } from 'lucide-react';
import { API } from '../../App';
import { useApiSWR } from '../../hooks/useApiSWR';

const AreaAliasManager = ({ token }) => {
  const [alias, setAlias] = useState('');
  const [canonical, setCanonical] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);

  const { data: aliases = [], refresh } = useApiSWR(
    `${API}/admin/area-aliases`,
    token,
    { initial: [] },
  );

  const headers = { Authorization: `Bearer ${token}` };

  const addAlias = async (e) => {
    e?.preventDefault?.();
    if (!alias.trim() || !canonical.trim()) {
      toast.error('Both alias and canonical neighborhood are required');
      return;
    }
    setSaving(true);
    try {
      await axios.post(
        `${API}/admin/area-aliases`,
        { alias: alias.trim(), canonical: canonical.trim() },
        { headers },
      );
      toast.success('Alias added');
      setAlias('');
      setCanonical('');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add alias');
    } finally {
      setSaving(false);
    }
  };

  const removeAlias = async (id) => {
    if (!window.confirm('Delete this alias?')) return;
    try {
      await axios.delete(`${API}/admin/area-aliases/${id}`, { headers });
      toast.success('Alias deleted');
      refresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6" data-testid="area-alias-manager">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between gap-3 text-left"
        data-testid="area-alias-toggle"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#1E6A6A]/10 flex items-center justify-center shrink-0">
            <Tags size={16} className="text-[#1E6A6A]" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Neighborhood aliases</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Map street names, typos, and colloquial forms to the right neighborhood
              {aliases.length > 0 && ` · ${aliases.length} active`}
            </p>
          </div>
        </div>
        <span className="text-sm text-[#1E6A6A] font-semibold">
          {expanded ? 'Hide' : 'Manage'}
        </span>
      </button>

      {expanded && (
        <div className="mt-5 space-y-5">
          <form
            onSubmit={addAlias}
            className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr_auto] gap-3 md:items-end"
          >
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Alias (street name, typo, …)
              </label>
              <input
                type="text"
                value={alias}
                onChange={(e) => setAlias(e.target.value)}
                placeholder='e.g. "Levi Eshkol"'
                className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
                data-testid="area-alias-alias-input"
                disabled={saving}
              />
            </div>
            <div className="hidden md:flex items-end pb-3 text-gray-400">
              <ArrowRight size={18} />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Canonical neighborhood
              </label>
              <input
                type="text"
                value={canonical}
                onChange={(e) => setCanonical(e.target.value)}
                placeholder='e.g. "Ramat Eshkol" or "Jerusalem - Ramat Eshkol"'
                className="mt-2 w-full px-4 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-[#1E6A6A]/30 focus:border-[#1E6A6A] text-sm"
                data-testid="area-alias-canonical-input"
                disabled={saving}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#1E6A6A] text-white text-sm font-semibold hover:bg-[#175555] disabled:opacity-50 transition-colors"
              data-testid="area-alias-add-btn"
            >
              <Plus size={16} /> Add
            </button>
          </form>

          <div className="border-t border-gray-100 pt-4">
            {aliases.length === 0 ? (
              <p className="text-sm text-gray-500" data-testid="area-alias-empty">
                No custom aliases yet. The seed alias &ldquo;Levi Eshkol → Ramat Eshkol&rdquo; is
                always active — you can add more here.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100" data-testid="area-alias-list">
                {aliases.map((a) => (
                  <li
                    key={a.id}
                    className="py-3 flex items-center justify-between gap-3"
                    data-testid={`area-alias-row-${a.id}`}
                  >
                    <div className="flex items-center gap-3 text-sm min-w-0">
                      <span className="font-medium text-gray-900 truncate">{a.alias}</span>
                      <ArrowRight size={13} className="text-gray-300 shrink-0" />
                      <span className="text-[#1E6A6A] font-semibold truncate">{a.canonical}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAlias(a.id)}
                      className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors shrink-0"
                      aria-label="Delete alias"
                      data-testid={`area-alias-delete-${a.id}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AreaAliasManager;
