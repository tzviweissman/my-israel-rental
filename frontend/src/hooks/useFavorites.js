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
