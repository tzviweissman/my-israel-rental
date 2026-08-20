import React from 'react';
import { Trash2, ToggleLeft, ToggleRight, Loader2, CalendarX, CalendarCheck, Lock, Briefcase, Star, EyeOff, Undo2, ImageOff } from 'lucide-react';

// Backend already returns properties sorted by created_at desc, so the
// table reads newest-first. Helper used to render "5h ago" / "3d ago"
// strings on both desktop and mobile rows.
const relativeAdded = (iso) => {
  if (!iso) return '—';
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  if (Number.isNaN(d.getTime())) return '—';
  const mins = Math.floor((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
};
/**
 * Tiny cover-image thumbnail for each listing row. Falls back to a
 * placeholder tile when the property has no images so the admin can
 * still see at a glance "this listing needs photos". The image opens
 * in a new tab on click so the admin can sanity-check the full-size
 * shot without leaving the table.
 */
const CoverThumb = ({ property, size = 'md' }) => {
  const src = property.images?.[0];
  const dim = size === 'sm' ? 'w-12 h-12' : 'w-14 h-14';
  if (!src) {
    return (
      <div
        className={`${dim} rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400 shrink-0`}
        title="No photos yet"
        data-testid={`cover-thumb-empty-${property.id}`}
      >
        <ImageOff size={14} />
      </div>
    );
  }
  return (
    <a
      href={src}
      target="_blank"
      rel="noopener noreferrer"
      className={`${dim} rounded-md overflow-hidden border border-gray-200 shrink-0 block hover:ring-2 hover:ring-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/40 transition-shadow`}
      title="Open full-size cover image"
      data-testid={`cover-thumb-${property.id}`}
      onClick={(e) => e.stopPropagation()}
    >
      <img
        src={src}
        alt={property.title || 'Cover'}
        loading="lazy"
        className="w-full h-full object-cover"
      />
    </a>
  );
};

/**
 * The listings table itself — desktop table plus the mobile card list
 * (spec A7).
 *
 * Extracted verbatim from ListingsTab, along with the two helpers only
 * this table used: relativeAdded and CoverThumb. Both were module-level
 * in the old file and referenced nowhere else, so they belong here.
 *
 * Renders two layouts of the same rows rather than one responsive table:
 * a table collapses badly at 375px, and this pattern was already in the
 * original.
 */
export default function ListingsTable({
  t,
  filteredProperties,
  propertiesError,
  selectedPropIds,
  setSelectedPropIds,
  togglePropSelected,
  togglePropertyStatus,
  toggleAdminManaged,
  toggleFeatured,
  deleteProperty,
  openMarkBookedModal,
  unmarkBooked,
  handleRestoreSingle,
  restoringId,
}) {
  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] overflow-hidden">
      {/* Desktop table — hidden on small screens */}
      <table className="w-full hidden md:table">
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
            <th className="px-3 py-3 w-16"></th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colTitle')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colOwner')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colArea')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colType')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.colPrice')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Added</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.status')}</th>
            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">{t('admin.actions')}</th>
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
              <td className="px-3 py-2 w-16">
                <CoverThumb property={p} />
              </td>
              <td className="px-4 py-3 font-medium text-sm">
                <div className="flex items-center gap-2 flex-wrap">
                  <span>{p.title}</span>
                  {p.is_featured && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800"
                      title={t('admin.featuredOnHome', 'Featured on homepage')}
                      data-testid={`featured-badge-${p.id}`}
                    >
                      <Star size={10} fill="currentColor" /> {t('admin.featured', 'Featured')}
                    </span>
                  )}
                  {p.managed_by_admin && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 text-[var(--brand-primary)]"
                      title="Admin-managed for the owner"
                      data-testid={`managed-badge-${p.id}`}
                    >
                      <Briefcase size={10} /> Managing
                    </span>
                  )}
                  {p.admin_blocked_now && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800"
                      title={p.active_admin_block?.indefinite ? t('admin.adminBlockedIndefinite') : t('admin.adminBlockedRange', { start: p.active_admin_block?.start_date?.slice(0,10), end: p.active_admin_block?.end_date?.slice(0,10) })}
                      data-testid={`admin-blocked-badge-${p.id}`}
                    >
                      <Lock size={10} /> {t('admin.adminBlocked')}
                    </span>
                  )}
                  {p.is_hidden && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-100 text-rose-800"
                      title={
                        p.pricing_review_reason === 'zero_price'
                          ? `Hidden from public feed — no price set${p.pricing_review_at ? ` · ${new Date(p.pricing_review_at).toLocaleDateString()}` : ''}`
                          : p.pricing_review_reason === 'low_monthly'
                          ? `Hidden from public feed — monthly rent below plausibility floor${p.pricing_review_at ? ` · ${new Date(p.pricing_review_at).toLocaleDateString()}` : ''}`
                          : 'Hidden from public feed'
                      }
                      data-testid={`quarantine-badge-${p.id}`}
                    >
                      <EyeOff size={10} /> Quarantined
                      {p.pricing_review_reason ? ` · ${p.pricing_review_reason === 'zero_price' ? 'no price' : 'low rent'}` : ''}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {p.owner_name}<br />
                <span className="text-xs text-gray-400">{p.owner_email}</span>
              </td>
              <td className="px-4 py-3 text-sm">{p.area}</td>
              <td className="px-4 py-3"><span className="px-2 py-1 rounded-full text-xs bg-[#E5E5E5]">{p.rental_type}</span></td>
              <td className="px-4 py-3 font-bold text-sm">{p.currency === 'USD' ? '$' : '₪'}{p.monthly_price || p.nightly_price || 0}</td>
              <td className="px-4 py-3 text-xs text-gray-500" title={p.created_at ? new Date(p.created_at).toLocaleString() : ''}>
                {p.created_at ? relativeAdded(p.created_at) : '—'}
              </td>
              <td className="px-4 py-3">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                  {p.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => toggleFeatured(p.id)}
                    className={`p-1.5 rounded transition-colors ${p.is_featured ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'hover:bg-gray-100 text-gray-400'}`}
                    title={p.is_featured ? t('admin.removeFromFeatured', 'Remove from featured listings') : t('admin.addToFeatured', 'Add to featured listings')}
                    data-testid={`toggle-featured-${p.id}`}
                  >
                    <Star size={16} fill={p.is_featured ? 'currentColor' : 'none'} />
                  </button>
                  {p.admin_blocked_now ? (
                    <button
                      onClick={() => unmarkBooked(p)}
                      className="p-1.5 rounded hover:bg-green-50 text-green-600"
                      title={t('admin.removeAdminBlock')}
                      data-testid={`unmark-booked-${p.id}`}
                    >
                      <CalendarCheck size={18} />
                    </button>
                  ) : (
                    <button
                      onClick={() => openMarkBookedModal({ mode: 'single', id: p.id })}
                      className="p-1.5 rounded hover:bg-amber-50 text-amber-600"
                      title={t('admin.markAsBooked')}
                      data-testid={`mark-booked-${p.id}`}
                    >
                      <CalendarX size={18} />
                    </button>
                  )}
                  <button
                    onClick={() => toggleAdminManaged(p.id)}
                    className={`p-1.5 rounded transition-colors ${p.managed_by_admin ? 'bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 text-[var(--brand-primary)] hover:bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/15' : 'hover:bg-gray-100 text-gray-400'}`}
                    title={p.managed_by_admin ? 'Stop managing this property' : 'Start managing this property for the owner'}
                    data-testid={`toggle-managed-${p.id}`}
                  >
                    <Briefcase size={16} />
                  </button>
                  <button
                    onClick={() => togglePropertyStatus(p.id)}
                    className="p-1.5 rounded hover:bg-gray-100"
                    title={p.status === 'active' ? t('admin.deactivate') : t('admin.activate')}
                    data-testid={`toggle-property-${p.id}`}
                  >
                    {p.status === 'active'
                      ? <ToggleRight size={18} className="text-green-600" />
                      : <ToggleLeft size={18} className="text-gray-400" />}
                  </button>
                  <button
                    onClick={() => deleteProperty(p.id)}
                    className="p-1.5 rounded hover:bg-red-50 text-red-500"
                    title={t('admin.deleteTooltip')}
                    data-testid={`delete-property-${p.id}`}
                  >
                    <Trash2 size={16} />
                  </button>
                  {p.is_hidden && (
                    <button
                      onClick={() => handleRestoreSingle(p)}
                      disabled={restoringId === p.id}
                      className="p-1.5 rounded hover:bg-emerald-50 text-emerald-600 disabled:opacity-50"
                      title="Restore this listing to the public feed (lift quarantine)"
                      data-testid={`restore-quarantined-${p.id}`}
                    >
                      {restoringId === p.id ? <Loader2 size={16} className="animate-spin" /> : <Undo2 size={16} />}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile card list — visible on small screens only.
          Each card shows all the same info + actions in a stacked layout
          so admins can manage listings without a sideways-scrolling table. */}
      <div className="md:hidden">
        {filteredProperties.length > 0 && (
          <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-[#E5E5E5] text-xs font-medium text-gray-600">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={filteredProperties.every(p => selectedPropIds.has(p.id))}
                onChange={e => {
                  if (e.target.checked) setSelectedPropIds(new Set(filteredProperties.map(p => p.id)));
                  else setSelectedPropIds(new Set());
                }}
                data-testid="select-all-listings-mobile"
              />
              {t('admin.selectAllVisible', 'Select all visible')}
            </label>
            {selectedPropIds.size > 0 && (
              <span className="text-[var(--brand-primary)] font-semibold" data-testid="selected-count-mobile">
                {t('admin.selectedCount', { count: selectedPropIds.size })}
              </span>
            )}
          </div>
        )}
        <div className="divide-y divide-[#E5E5E5]">
        {filteredProperties.map(p => (
          <div key={p.id} className="p-3" data-testid={`listing-card-${p.id}`}>
            <div className="flex items-start gap-2 mb-2">
              <input
                type="checkbox"
                checked={selectedPropIds.has(p.id)}
                onChange={() => togglePropSelected(p.id)}
                className="mt-1 shrink-0"
                data-testid={`select-listing-mobile-${p.id}`}
              />
              <CoverThumb property={p} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="font-semibold text-sm break-words">{p.title || '—'}</p>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${p.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {p.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{p.owner_name} · {p.area}</p>
                <p className="text-xs text-gray-700 mt-0.5">
                  <span className="font-semibold">{p.currency === 'USD' ? '$' : '₪'}{p.monthly_price || p.nightly_price || 0}</span>
                  <span className="text-gray-400"> · {p.rental_type}</span>
                  {p.created_at && (
                    <span
                      className="text-gray-400"
                      title={new Date(p.created_at).toLocaleString()}
                    > · added {relativeAdded(p.created_at)}</span>
                  )}
                </p>
                <div className="flex items-center gap-1 flex-wrap mt-1.5">
                  {p.is_featured && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 text-amber-800">
                      <Star size={9} fill="currentColor" /> {t('admin.featured', 'Featured')}
                    </span>
                  )}
                  {p.managed_by_admin && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 text-[var(--brand-primary)]">
                      <Briefcase size={9} /> Managing
                    </span>
                  )}
                  {p.admin_blocked_now && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-amber-100 text-amber-800">
                      <Lock size={9} /> {t('admin.adminBlocked')}
                    </span>
                  )}
                  {p.is_hidden && (
                    <span
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-rose-100 text-rose-800"
                      data-testid={`quarantine-badge-mobile-${p.id}`}
                    >
                      <EyeOff size={9} /> Quarantined
                      {p.pricing_review_reason ? ` · ${p.pricing_review_reason === 'zero_price' ? 'no price' : 'low rent'}` : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {/* Actions row — full-width grid so every button is reachable
                on a small screen without horizontal scroll. */}
            <div className="grid grid-cols-5 gap-1 mt-2">
              <button
                onClick={() => toggleFeatured(p.id)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded text-[10px] font-medium transition-colors ${p.is_featured ? 'bg-amber-100 text-amber-700' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                data-testid={`toggle-featured-mobile-${p.id}`}
              >
                <Star size={16} fill={p.is_featured ? 'currentColor' : 'none'} />
                {p.is_featured ? t('admin.unfeature', 'Unfeature') : t('admin.feature', 'Feature')}
              </button>
              {p.admin_blocked_now ? (
                <button
                  onClick={() => unmarkBooked(p)}
                  className="flex flex-col items-center justify-center gap-0.5 py-2 rounded text-[10px] font-medium bg-green-50 text-green-700 hover:bg-green-100"
                  data-testid={`unmark-booked-mobile-${p.id}`}
                >
                  <CalendarCheck size={16} />
                  {t('admin.unblock', 'Unblock')}
                </button>
              ) : (
                <button
                  onClick={() => openMarkBookedModal({ mode: 'single', id: p.id })}
                  className="flex flex-col items-center justify-center gap-0.5 py-2 rounded text-[10px] font-medium bg-amber-50 text-amber-700 hover:bg-amber-100"
                  data-testid={`mark-booked-mobile-${p.id}`}
                >
                  <CalendarX size={16} />
                  {t('admin.block', 'Block')}
                </button>
              )}
              <button
                onClick={() => toggleAdminManaged(p.id)}
                className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded text-[10px] font-medium ${p.managed_by_admin ? 'bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 text-[var(--brand-primary)]' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}
                data-testid={`toggle-managed-mobile-${p.id}`}
              >
                <Briefcase size={16} />
                {p.managed_by_admin ? t('admin.unmanage', 'Unmanage') : t('admin.manage', 'Manage')}
              </button>
              <button
                onClick={() => togglePropertyStatus(p.id)}
                className="flex flex-col items-center justify-center gap-0.5 py-2 rounded text-[10px] font-medium bg-gray-50 text-gray-700 hover:bg-gray-100"
                data-testid={`toggle-property-mobile-${p.id}`}
              >
                {p.status === 'active'
                  ? <ToggleRight size={16} className="text-green-600" />
                  : <ToggleLeft size={16} className="text-gray-400" />}
                {p.status === 'active' ? t('admin.deactivate') : t('admin.activate')}
              </button>
              <button
                onClick={() => deleteProperty(p.id)}
                className="flex flex-col items-center justify-center gap-0.5 py-2 rounded text-[10px] font-medium bg-red-50 text-red-600 hover:bg-red-100"
                data-testid={`delete-property-mobile-${p.id}`}
              >
                <Trash2 size={14} />
                {t('admin.deleteAction', 'Delete')}
              </button>
            </div>
          </div>
        ))}
        </div>
      </div>

      {filteredProperties.length === 0 && (
        propertiesError ? (
          /* Never claim "no listings" when we simply failed to ask. The hook
             caches nothing on error and won't retry on its own, so an
             explicit retry is the only way out short of a page reload. */
          <div className="text-center py-8 px-4" data-testid="admin-listings-error">
            <p className="text-sm text-red-600 font-medium">
              {t('admin.listingsLoadFailed', "Couldn't load listings")}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {t(
                'admin.listingsLoadFailedHint',
                'Your listings are safe — the server just did not answer. This usually clears on its own right after a deploy.',
              )}
            </p>
            <button
              type="button"
              onClick={() => fetchProperties()}
              disabled={propertiesLoading}
              className="mt-3 px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              data-testid="admin-listings-retry"
            >
              {propertiesLoading
                ? t('admin.listingsRetrying', 'Retrying…')
                : t('admin.listingsRetry', 'Try again')}
            </button>
          </div>
        ) : (
          <p className="text-center text-gray-400 py-8 text-sm">{t('admin.noListings')}</p>
        )
      )}
    </div>
  );
}
