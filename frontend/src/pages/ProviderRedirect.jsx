/**
 * /businesses/provider/:userId — the old per-person page (spec M4).
 *
 * There is no person page any more, but this URL is linked from existing
 * listings and may be indexed, so it must keep working. It resolves to
 * that person's first active business and replaces itself with the
 * business page.
 *
 * `replace`, not a push: the old URL should not sit in the back stack,
 * or Back returns here and bounces the visitor forward again.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { API } from '../App';

const ProviderRedirect = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [gone, setGone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/marketplace/providers/${userId}/default-business`);
        if (!cancelled) navigate(`/business/${data.slug || data.id}`, { replace: true });
      } catch {
        if (!cancelled) setGone(true);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6 text-center">
      {gone ? (
        <div>
          <p style={{ color: 'var(--brand-muted)' }}>
            {t('businessPage.gone', 'This business is no longer listed')}
          </p>
          <button type="button" onClick={() => navigate('/businesses')}
            className="mt-3 text-sm font-semibold" style={{ color: 'var(--brand-primary)' }}>
            {t('businessPage.browse', 'Browse businesses')}
          </button>
        </div>
      ) : (
        <Loader2 className="animate-spin" size={20} style={{ color: 'var(--brand-muted)' }} />
      )}
    </div>
  );
};

export default ProviderRedirect;
