/**
 * GigDetail — Fiverr-style service detail page.
 *
 * Left column: gallery + description + FAQs + provider mini-profile.
 * Right column (desktop) / sticky bottom (mobile): pricing tier picker
 * with either a "Book on WhatsApp" deep-link OR an in-platform booking
 * modal — driven by `gig.booking_mode`.
 */
import React, { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { toast } from 'sonner';
import { MessageCircle, Send, Loader2, ArrowLeft, Star } from 'lucide-react';
import { API, AuthContext } from '../App';
import PageMeta from '../components/PageMeta';

const buildWhatsAppUrl = (raw, message) => {
  const digits = (raw || '').replace(/[^\d]/g, '');
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};

const BookingForm = ({ gig, tier, onClose, token }) => {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!email.trim()) return toast.error('Email required');
    setSaving(true);
    try {
      await axios.post(
        `${API}/marketplace/gigs/${gig.id}/book`,
        {
          tier_name: tier.name,
          message,
          contact_email: email,
          contact_phone: phone,
          preferred_date: date || null,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      toast.success('Booking request sent!');
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to send request');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onSubmit={submit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4"
        data-testid="gig-booking-form"
      >
        <h3 className="text-lg font-bold">Request "{tier.name}" — ₪{tier.price.toLocaleString()}</h3>
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Your email" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" data-testid="gig-booking-email" />
        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell the provider what you need…" rows={3} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600">Cancel</button>
          <button type="submit" disabled={saving} className="px-5 py-2 rounded-lg text-sm font-semibold text-white bg-[#1E6A6A]" data-testid="gig-booking-submit">
            {saving ? <Loader2 className="animate-spin" size={14} /> : 'Send request'}
          </button>
        </div>
      </form>
    </div>
  );
};

const GigDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, user } = useContext(AuthContext);
  const [gig, setGig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tier, setTier] = useState(null);
  const [showBook, setShowBook] = useState(false);

  useEffect(() => {
    axios.get(`${API}/marketplace/gigs/${id}`)
      .then((r) => { setGig(r.data); setTier(r.data.tiers?.[0] || null); })
      .catch(() => toast.error('Gig not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: 'var(--nav-h, 68px)' }}>
        <Loader2 className="animate-spin text-[#1E6A6A]" size={28} />
      </div>
    );
  }
  if (!gig) return null;

  const cover = gig.gallery?.[0];
  const sym = tier?.currency === 'USD' ? '$' : '₪';

  const handleBookClick = () => {
    if (!tier) return toast.error('Pick a tier first');
    if (gig.booking_mode === 'whatsapp') {
      if (!gig.whatsapp) return toast.error('Provider has no WhatsApp set');
      const msg = `Hi! I'd like to book your "${gig.title}" — ${tier.name} tier (${sym}${tier.price}) from MyIsraelRental.`;
      window.open(buildWhatsAppUrl(gig.whatsapp, msg), '_blank');
      return;
    }
    if (!token) {
      toast.error('Please sign in to book');
      navigate('/auth');
      return;
    }
    setShowBook(true);
  };

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ paddingTop: 'var(--nav-h, 68px)' }} data-testid="gig-detail-page">
      <PageMeta title={`${gig.title} — MyIsraelRental Services`} description={gig.description?.slice(0, 155) || `Book ${gig.title} on MyIsraelRental.`} path={`/services/gig/${id}`} />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <button onClick={() => navigate('/services')} className="text-sm text-gray-600 flex items-center gap-1 mb-4 hover:text-[#1E6A6A]" data-testid="gig-back">
          <ArrowLeft size={14} /> Back to services
        </button>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-6">
            {/* Cover + gallery */}
            <div className="aspect-video bg-gray-100 rounded-2xl overflow-hidden" style={cover ? { backgroundImage: `url(${cover})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}}>
              {!cover && <div className="w-full h-full flex items-center justify-center text-gray-300">No image</div>}
            </div>
            {gig.gallery?.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {gig.gallery.map((src) => (
                  <div key={src} className="w-24 h-24 shrink-0 rounded-lg bg-gray-100" style={{ backgroundImage: `url(${src})`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
                ))}
              </div>
            )}

            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display' }}>{gig.title}</h1>
              <p className="text-gray-600 mt-1">{gig.provider?.name}{gig.area ? ` · ${gig.area}` : ''}</p>
            </div>

            <div>
              <h2 className="text-lg font-bold mb-2">About this service</h2>
              <p className="text-gray-700 whitespace-pre-line">{gig.description || 'No description provided.'}</p>
            </div>

            {gig.faqs?.length > 0 && (
              <div>
                <h2 className="text-lg font-bold mb-2">FAQs</h2>
                <div className="space-y-3">
                  {gig.faqs.map((f, i) => (
                    <div key={i} className="border border-gray-200 rounded-lg p-3">
                      <p className="font-semibold text-sm">{f.q}</p>
                      <p className="text-sm text-gray-600 mt-1">{f.a}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Provider mini-profile */}
            <div className="border border-gray-200 rounded-2xl p-4 flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gray-200 shrink-0" style={gig.provider?.avatar ? { backgroundImage: `url(${gig.provider.avatar})`, backgroundSize: 'cover' } : {}} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{gig.provider?.name}</p>
                <p className="text-xs text-gray-500">{gig.provider?.tagline || gig.provider?.bio || '\u00A0'}</p>
              </div>
              <button onClick={() => navigate(`/services/provider/${gig.provider?.user_id}`)} className="text-xs font-semibold text-[#1E6A6A] hover:underline" data-testid="gig-view-provider">
                View profile
              </button>
            </div>
          </div>

          {/* Pricing sidebar */}
          <div className="md:sticky md:top-24 h-fit space-y-4">
            <div className="border border-gray-200 rounded-2xl bg-white p-4 space-y-3">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Choose a package</h3>
              {(gig.tiers || []).length === 0 ? (
                <p className="text-sm text-gray-500">No packages listed yet.</p>
              ) : (
                gig.tiers.map((tt) => {
                  const active = tier?.name === tt.name;
                  return (
                    <button
                      key={tt.name}
                      onClick={() => setTier(tt)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${active ? 'border-[#1E6A6A] bg-[#1E6A6A]/5' : 'border-gray-200 hover:border-[#D4AF37]'}`}
                      data-testid={`gig-tier-${tt.name}`}
                    >
                      <div className="flex justify-between items-baseline">
                        <span className="font-semibold text-sm">{tt.name}</span>
                        <span className="font-bold text-gray-900">{tt.currency === 'USD' ? '$' : '₪'}{tt.price.toLocaleString()}</span>
                      </div>
                      {tt.delivery_days && <p className="text-xs text-gray-500 mt-1">Delivered in {tt.delivery_days} days</p>}
                      {tt.description && <p className="text-xs text-gray-600 mt-1">{tt.description}</p>}
                      {tt.features?.length > 0 && (
                        <ul className="text-xs text-gray-600 mt-2 space-y-0.5">
                          {tt.features.map((ft, i) => <li key={i}>• {ft}</li>)}
                        </ul>
                      )}
                    </button>
                  );
                })
              )}
              <button
                onClick={handleBookClick}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold text-white bg-[#1E6A6A] hover:bg-[#0F3A3A] transition-colors"
                data-testid="gig-book-btn"
              >
                {gig.booking_mode === 'whatsapp' ? <><MessageCircle size={14} /> Book on WhatsApp</> : <><Send size={14} /> Send booking request</>}
              </button>
              <p className="text-[11px] text-gray-400 text-center">
                MyIsraelRental never takes a cut — you deal with the provider directly.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showBook && tier && (
        <BookingForm gig={gig} tier={tier} onClose={() => setShowBook(false)} token={token} />
      )}
    </div>
  );
};

export default GigDetail;
