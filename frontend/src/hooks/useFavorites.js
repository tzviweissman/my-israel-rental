/**
 * useFavorites — shared hook that exposes the renter's "liked" property
 * IDs and a toggle. Wraps the existing /api/liked-property-ids +
 * /api/properties/{id}/like endpoints so any card (Stays, Properties,
 * PropertyDetail) can opt in without duplicating fetch/toggle logic.
 *
 * Signed-out users: `likedIds` stays empty and `toggleLike` shows a
 * sign-in toast instead of calling the API.
 */
import { useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { API, AuthContext } from '../App';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

export default function useFavorites() {
  const { token } = useContext(AuthContext);
  const [likedIds, setLikedIds] = useState(() => new Set());

  useEffect(() => {
    if (!token) {
      setLikedIds(new Set());
      return;
    }
    axios
      .get(`${API}/liked-property-ids`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setLikedIds(new Set(res.data || [])))
      .catch(() => {});
  }, [token]);

  const toggleLike = useCallback(
    async (propertyId, e) => {
      if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
      if (e && typeof e.preventDefault === 'function') e.preventDefault();
      if (!token) {
        toast.error('Please log in to save properties.');
        return;
      }
      try {
        const res = await axios.post(
          `${API}/properties/${propertyId}/like`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        );
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (res.data.liked) next.add(propertyId);
          else next.delete(propertyId);
          return next;
        });
        toast.success(res.data.liked ? 'Saved to favorites!' : 'Removed from favorites');
      } catch {
        toast.error('Failed to update favorites');
      }
    },
    [token],
  );

  return { likedIds, toggleLike, isLoggedIn: Boolean(token) };
}

/**
 * Saved services and products (storefront phase 5). The same favourites,
 * extended: rows for gigs live beside rows for properties.
 *
 * Signed out, the heart sends the person to sign in and comes back to
 * `returnPath?save=gig:<id>`; this hook sees that on arrival and finishes
 * the save. Carried in the address rather than in this browser's storage,
 * because a business's own web address signs people in on the main site.
 */
export function useSavedItems() {
  const { token } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation();
  const [savedIds, setSavedIds] = useState(() => new Set());
  const auth = token ? { headers: { Authorization: `Bearer ${token}` } } : null;

  useEffect(() => {
    if (!token) { setSavedIds(new Set()); return; }
    axios.get(`${API}/saved-gig-ids`, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => setSavedIds(new Set(res.data || [])))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const want = params.get('save');
    if (!token || !want || !want.startsWith('gig:')) return;
    const id = want.slice(4);
    params.delete('save');
    const rest = params.toString();
    navigate({ pathname: location.pathname, search: rest ? `?${rest}` : '', hash: location.hash }, { replace: true });
    axios.post(`${API}/gigs/${encodeURIComponent(id)}/save`, { saved: true }, { headers: { Authorization: `Bearer ${token}` } })
      .then(() => {
        setSavedIds((prev) => new Set(prev).add(id));
        toast.success(t('saved.done', 'Saved. You will find it under Saved in your dashboard.'));
      })
      .catch(() => toast.error(t('saved.failed', 'That did not save. Try again.')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, location.search]);

  const toggleSave = useCallback(async (gig, returnPath, e) => {
    if (e && typeof e.stopPropagation === 'function') e.stopPropagation();
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!token) {
      navigate(`/auth/login?redirect=${encodeURIComponent(`${returnPath}?save=gig:${gig.id}`)}`);
      return;
    }
    try {
      const { data } = await axios.post(`${API}/gigs/${encodeURIComponent(gig.id)}/save`, {}, auth);
      setSavedIds((prev) => {
        const next = new Set(prev);
        if (data.saved) next.add(gig.id); else next.delete(gig.id);
        return next;
      });
      toast.success(data.saved ? t('saved.done', 'Saved. You will find it under Saved in your dashboard.') : t('saved.removed', 'Removed from Saved.'));
    } catch {
      toast.error(t('saved.failed', 'That did not save. Try again.'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, navigate]);

  return { savedIds, toggleSave };
}
