import React, { useState, useEffect, useContext } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { API, AuthContext } from '../App';
import { MapPin, Calendar as CalendarIcon, MessageCircle, ArrowLeft, Bed, Bath, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import ImageGallery from '../components/property/ImageGallery';
import { areaLabel } from '../utils/areaNames';
import { serviceLabel } from '../components/property/services/servicesCatalog';

/**
 * Standalone sublease detail page. Renders a sublease as a first-class
 * listing — useful when the underlying property has been deleted (option-b
 * detach behavior) or when the sublease is intrinsically standalone.
 *
 * No booking sidebar here: subleases are chat-first. The lessor confirms
 * dates + price in conversation, then issues a signing link.
 */
const parseLocalDate = (dateStr) => {
  if (!dateStr) return undefined;
  const [y, m, d] = String(dateStr).split('T')[0].split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
};

const SubleaseDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useContext(AuthContext);
  // i18next returns the key when no translation exists, so a `|| 'fallback'`
  // pattern never falls through. This helper detects the unresolved-key case.
  const tf = (key, fallback) => {
    const v = t(key);
    return v === key ? fallback : v;
  };
  const [sublease, setSublease] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await axios.get(`${API}/subleases/${id}`);
        if (!cancelled) setSublease(data);
      } catch {
        if (!cancelled) toast.error(tf('property.notFound', 'Sublease not found'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleContact = () => {
    if (!user) {
      navigate('/auth/login');
      return;
    }
    if (user.id === sublease.subleasor_id) {
      toast.info(tf('sublease.cannotContactSelf', 'This is your own sublease listing.'));
      return;
    }
    // Chat route needs a path param. Use original_property_id even if the
    // property has been deleted — Chat.js scopes by ?with= + sublease_id and
    // doesn't dereference the path id when sublease_id is present.
    const pathId = sublease.original_property_id || sublease.id;
    const params = new URLSearchParams({
      with: sublease.subleasor_id,
      sublease_id: sublease.id,
    });
    navigate(`/chat/${pathId}?${params.toString()}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center text-gray-500" data-testid="sublease-loading">
        {tf('property.loading', 'Loading…')}
      </div>
    );
  }

  if (!sublease) {
    return (
      <div className="container mx-auto px-4 py-16 text-center" data-testid="sublease-not-found">
        <h1 className="text-2xl font-bold mb-3">{tf('property.notFound', 'Sublease not found')}</h1>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-5 py-2 rounded-lg bg-[var(--brand-primary)] text-white hover:bg-[#175757]"
          data-testid="back-home-btn"
        >
          {tf('common.backHome', 'Back to home')}
        </button>
      </div>
    );
  }

  const currencySym = sublease.currency === 'USD' ? '$' : '₪';
  const priceLabel = sublease.price_type === 'flat'
    ? tf('sublease.totalLabel', ' total')
    : ` / ${tf('property.perNight', 'night')}`;

  const fromDate = parseLocalDate(sublease.available_from);
  const toDate = parseLocalDate(sublease.available_to);

  return (
    <div className="container mx-auto px-4 py-6 md:py-10" data-testid="sublease-detail">
      <div className="mb-4">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-[var(--brand-primary)] hover:underline"
          data-testid="back-btn"
        >
          <ArrowLeft size={18} />
          {tf('common.back', 'Back')}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="mb-6">
            <ImageGallery
              media={(sublease.images || []).map((url) => ({ type: 'image', url }))}
              currentIndex={currentImageIndex}
              onIndexChange={setCurrentImageIndex}
              alt={sublease.title}
              apiBase={API}
            />
          </div>

          <div className="flex items-start justify-between gap-4 mb-3">
            <h1
              className="text-3xl md:text-4xl font-bold"
              style={{ fontFamily: 'var(--font-head)' }}
              data-testid="sublease-title"
            >
              {sublease.title || tf('sublease.untitled', 'Sublease')}
            </h1>
            <span className="shrink-0 px-3 py-1 rounded-full text-xs font-bold tracking-wide bg-[var(--gold)] text-[var(--brand-primary)]">
              {tf('property.subleaseRibbon', 'SUBLEASE')}
            </span>
          </div>

          {sublease.area && (
            <div className="flex items-center gap-2 text-gray-600 mb-4" data-testid="sublease-area">
              <MapPin size={16} />
              <span>{areaLabel(sublease.area, t)}</span>
            </div>
          )}

          {(sublease.holiday_tags || []).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5" data-testid="sublease-holiday-tags">
              {sublease.holiday_tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-[rgb(var(--brand-primary-rgb)/<alpha-value>)]/10 text-[var(--brand-primary)]"
                >
                  <Sparkles size={12} />
                  {tag.charAt(0).toUpperCase() + tag.slice(1)}
                </span>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-6 mb-6 text-gray-700">
            {sublease.bedrooms_available != null && (
              <div className="flex items-center gap-2" data-testid="sublease-bedrooms">
                <Bed size={18} />
                <span>{sublease.bedrooms_available} {tf('property.bedroomsShort', 'bd')}</span>
              </div>
            )}
            {sublease.bathrooms != null && (
              <div className="flex items-center gap-2" data-testid="sublease-bathrooms">
                <Bath size={18} />
                <span>{sublease.bathrooms} {tf('property.bathroomsShort', 'ba')}</span>
              </div>
            )}
            {fromDate && toDate && (
              <div className="flex items-center gap-2" data-testid="sublease-dates">
                <CalendarIcon size={18} />
                <span>{format(fromDate, 'MMM d, yyyy')} — {format(toDate, 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>

          {sublease.description && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">{tf('property.about', 'About this place')}</h2>
              <p className="text-gray-700 whitespace-pre-wrap" data-testid="sublease-description">{sublease.description}</p>
            </div>
          )}

          {(sublease.amenities || []).length > 0 && (
            <div className="mb-6" data-testid="sublease-amenities">
              <h2 className="text-lg font-semibold mb-2">{tf('property.amenities', 'Amenities')}</h2>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-y-1.5 text-gray-700">
                {sublease.amenities.map((a) => (
                  <li key={a} className="flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                    {serviceLabel(t, a)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {sublease.notes && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-2">{tf('sublease.hostNotes', 'Notes from the host')}</h2>
              <p className="text-gray-700 whitespace-pre-wrap" data-testid="sublease-notes">{sublease.notes}</p>
            </div>
          )}
        </div>

        <aside className="lg:col-span-1">
          <div className="sticky top-24 bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="mb-4">
              <span className="text-3xl font-bold" data-testid="sublease-price">
                {currencySym}{(sublease.price || 0).toLocaleString()}
              </span>
              <span className="text-gray-500 ml-1">{priceLabel}</span>
            </div>
            {fromDate && toDate && (
              <div className="text-sm text-gray-700 mb-5 flex items-center gap-2">
                <CalendarIcon size={14} />
                {format(fromDate, 'MMM d')} — {format(toDate, 'MMM d, yyyy')}
              </div>
            )}
            <button
              onClick={handleContact}
              className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-[var(--brand-primary)] text-white font-semibold hover:bg-[#175757] transition-colors"
              data-testid="contact-host-btn"
            >
              <MessageCircle size={18} />
              {tf('sublease.contactHost', 'Contact host')}
            </button>
            <p className="text-xs text-gray-500 mt-3 text-center">
              {tf('sublease.contactHint', 'Confirm dates and terms in chat. The host will send a signing link once you agree.')}
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default SubleaseDetail;
