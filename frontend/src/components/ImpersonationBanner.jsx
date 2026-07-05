import React, { useContext } from 'react';
import { LogOut, AlertTriangle } from 'lucide-react';
import { AuthContext } from '../App';

/**
 * Sticky red banner rendered above everything else when the current
 * session is an admin impersonating another user. Gives the admin a
 * highly-visible, one-click "Return to admin" escape hatch so we don't
 * end up making changes under the wrong identity by accident.
 *
 * Data source is `sessionStorage.impersonate_admin_token`, which is set
 * by `AuthContext.impersonate()` and cleared by `endImpersonation()`.
 */
const ImpersonationBanner = () => {
  const { user, endImpersonation } = useContext(AuthContext);
  const stashed = typeof window !== 'undefined' && sessionStorage.getItem('impersonate_admin_token');
  if (!stashed || !user) return null;

  return (
    <div
      className="fixed top-0 inset-x-0 z-[100] bg-red-600 text-white shadow-lg"
      style={{ paddingTop: 'env(safe-area-inset-top, 0)' }}
      data-testid="impersonation-banner"
    >
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3 text-xs sm:text-sm">
        <div className="flex items-center gap-2 truncate">
          <AlertTriangle size={16} className="shrink-0" />
          <span className="truncate">
            <span className="font-bold">Impersonating:</span>{' '}
            <span className="font-medium truncate">
              {user.name || user.email}
            </span>{' '}
            <span className="opacity-80 hidden sm:inline">({user.role})</span>
          </span>
        </div>
        <button
          type="button"
          onClick={endImpersonation}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-red-700 font-bold text-xs hover:bg-red-50 shrink-0"
          data-testid="impersonation-end-btn"
        >
          <LogOut size={12} />
          Return to admin
        </button>
      </div>
    </div>
  );
};

export default ImpersonationBanner;
